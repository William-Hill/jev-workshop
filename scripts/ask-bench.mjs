// A/B benchmark: each question goes through LLM only and through Jev first.
//   node scripts/ask-bench.mjs --split tune --llm off                 (Jev routing only, no LLM calls)
//   node scripts/ask-bench.mjs --split heldout --min-probability 0.7  (the full A/B)
// LLM_BACKEND=claude-cli (default without ANTHROPIC_API_KEY) or anthropic; see scripts/ask-clients.mjs.
import fs from "node:fs";
import { jev, llm, LLM_MODEL, LLM_BACKEND } from "./ask-clients.mjs";
import { llmOnly, jevFirst } from "../src/ask/core/pipelines.js";
import { buildJevRequest, decideRoute } from "../src/ask/core/system1.js";
import { checkFacts, summarize } from "../src/ask/core/metrics.js";

const arg = (name, def) => { const i = process.argv.indexOf("--" + name); return i > 0 ? process.argv[i + 1] : def; };
const split = arg("split", "tune");
const useLlm = arg("llm", "on") === "on";
const limit = Number(arg("limit", 1000));
const thresholds = { minProbability: Number(arg("min-probability", 0.7)), minAnswerable: Number(arg("min-answerable", 0.5)) };
const CAP_USD = 5;

// Jev: TypeSafe models page. The API backend needs the LLM prices from the claude-api skill.
const PRICES = { jevPerMTok: 0.042, llmInPerMTok: Number(process.env.LLM_IN_PER_MTOK || 0), llmOutPerMTok: Number(process.env.LLM_OUT_PER_MTOK || 0) };
if (useLlm && LLM_BACKEND === "anthropic" && !(PRICES.llmInPerMTok > 0 && PRICES.llmOutPerMTok > 0)) {
  console.error("Set LLM_IN_PER_MTOK and LLM_OUT_PER_MTOK (dollars per million tokens) from the claude-api skill.");
  process.exit(2);
}

const facts = JSON.parse(fs.readFileSync("src/ask/data/facts.json", "utf8"));
const guide = fs.readFileSync("src/ask/data/guide.txt", "utf8");
const questions = fs.readFileSync("src/ask/data/questions.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l))
  .filter((q) => q.split === split).slice(0, limit);
console.log(`${questions.length} ${split} questions; LLM ${useLlm ? `${LLM_BACKEND} ${LLM_MODEL}` : "off"}; thresholds ${JSON.stringify(thresholds)}`);

const rows = [];
const words = (s) => (s ? s.trim().split(/\s+/).length : 0);
let llmCalls = 0, llmSpend = 0;
const track = (r) => { if (r.llmUsage || r.error) { llmCalls++; llmSpend += r.llmCostUsd || 0; } };
const capCheck = () => {
  // After the first LLM call, project the spend for the whole run (about 1.5 LLM calls for each question).
  if (llmCalls === 1) {
    const projected = llmSpend * questions.length * 1.5;
    console.log(`projected LLM spend about $${projected.toFixed(2)} (${LLM_BACKEND === "claude-cli" ? "estimate reported by claude -p; on a subscription it counts against usage limits" : "API"})`);
    if (projected > CAP_USD) { console.error(`Over the $${CAP_USD} cap. Stop.`); process.exit(3); }
  }
};

for (const q of questions) {
  let a = null;
  if (useLlm) {
    a = await llmOnly(q.question, { llm, guide });
    track(a); capCheck();
    rows.push({ id: q.id, intent: q.intent, variant: "llm_only", ...a, ok: !a.error && checkFacts(a.answer, q.expect), words: words(a.answer) });
  }
  let b;
  if (useLlm) {
    b = await jevFirst(q.question, { jev, llm, guide, facts, thresholds });
    track(b);
  } else {
    // Jev routing only: no LLM; System 2 rows count as "not answered here".
    const t0 = performance.now();
    try {
      const resp = await jev(buildJevRequest(q.question, facts));
      const route = decideRoute(resp.answers, thresholds);
      const { answerFromFacts } = await import("../src/ask/core/templates.js");
      b = { path: route.path, route, jev: resp.answers, jevUsage: resp.usage, answer: route.path === "system1" ? answerFromFacts(route.intent, resp.answers.ticket.choice, q.question, facts) : "" };
    } catch (err) {
      b = { path: "system2", route: { intent: null, why: `Jev failed: ${err.message}` }, answer: "", error: err.message };
    }
    b.ms = Math.round(performance.now() - t0);
  }
  const intentOk = Boolean(b.route && b.route.intent === q.intent);
  const ticketOk = q.intent !== "ticket_choice" || (b.jev && b.jev.ticket && b.jev.ticket.choice === q.ticket);
  rows.push({ id: q.id, intent: q.intent, variant: "jev_first", ...b, ok: !b.error && (b.path === "system1" || useLlm) && checkFacts(b.answer, q.expect), words: words(b.answer), intentOk, ticketOk });
  const last = rows.at(-1);
  console.log(`${q.id} ${q.intent.padEnd(15)}${a ? ` llm ${a.ms} ms ${rows.at(-2).ok ? "ok  " : "MISS"} |` : ""} jev ${b.path} ${b.ms} ms ${last.ok ? "ok  " : "MISS"} intent ${b.route && b.route.intent}${intentOk ? "" : " (WRONG)"} p=${b.route && b.route.probability}`);
}

const summary = { split, thresholds, llm: useLlm ? `${LLM_BACKEND} ${LLM_MODEL}` : "off", jevModel: "jev-1.13.0", llmCalls, llmSpendUsd: Math.round(llmSpend * 100) / 100, prices: PRICES, ...summarize(rows, PRICES) };
if (summary.jev_first) summary.jev_first.ticketAccuracy = rows.filter((r) => r.variant === "jev_first" && r.intent === "ticket_choice" && r.ticketOk).length / (rows.filter((r) => r.variant === "jev_first" && r.intent === "ticket_choice").length || 1);
console.log(JSON.stringify(summary, null, 2));
fs.mkdirSync("ask-results", { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
fs.writeFileSync(`ask-results/${split}-${useLlm ? "ab" : "jev"}-${stamp}.json`, JSON.stringify({ summary, rows }, null, 2));
console.log(`Results: ask-results/${split}-${useLlm ? "ab" : "jev"}-${stamp}.json`);
