import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { llmOnly, jevFirst } from "../src/ask/core/pipelines.js";
import { checkFacts, summarize } from "../src/ask/core/metrics.js";
import { cliArgs } from "../scripts/ask-clients.mjs";

const facts = JSON.parse(fs.readFileSync("src/ask/data/facts.json", "utf8"));
const guide = "GUIDE TEXT";
const jevAnswer = (intent, p, answerable = 0.9) => async () => ({
  model: "jev-1.13.0",
  answers: {
    intent: { type: "choice", choice: intent, probabilities: { [intent]: p }, confidence: p },
    answerable: { type: "noul", noul: answerable },
    ticket: { type: "choice", choice: "gold", probabilities: { gold: 0.9 }, confidence: 0.8 },
  },
  usage: { input_tokens: 900, output_tokens: 40 },
});
const fakeLlm = async ({ prompt }) => ({ text: `LLM answer to: ${prompt.slice(-30)}`, usage: { input_tokens: 12000, output_tokens: 150 }, model: "llm-test" });

test("Jev first: a clear price question is answered from facts without the LLM", async () => {
  let llmCalls = 0;
  const r = await jevFirst("How much is a ticket?", { jev: jevAnswer("price", 0.95), llm: async (x) => { llmCalls++; return fakeLlm(x); }, guide, facts });
  assert.equal(r.path, "system1");
  assert.match(r.answer, /\$350/);
  assert.equal(llmCalls, 0);
});

test("Jev first: a trip plan goes to the LLM with the intent as a hint", async () => {
  let seen = null;
  const r = await jevFirst("Plan my trip", { jev: jevAnswer("trip_plan", 0.95), llm: async (x) => { seen = x; return fakeLlm(x); }, guide, facts });
  assert.equal(r.path, "system2");
  assert.match(seen.prompt, /trip_plan/);
  assert.match(seen.system, /GUIDE TEXT/);
});

test("Jev first: the Jev request carries the facts", async () => {
  let body = null;
  await jevFirst("How much?", { jev: async (b) => { body = b; return jevAnswer("price", 0.95)(); }, llm: fakeLlm, guide, facts });
  assert.deepEqual(body.state.facts.summits, facts.summits);
});

test("Jev first: a Jev error sends the question to the LLM", async () => {
  const r = await jevFirst("How much?", { jev: async () => { throw new Error("HTTP 529"); }, llm: fakeLlm, guide, facts });
  assert.equal(r.path, "system2");
  assert.match(r.route.why, /Jev failed/);
});

test("an LLM error is a failed answer, not a crash", async () => {
  const r = await llmOnly("How much?", { llm: async () => { throw new Error("timeout"); }, guide });
  assert.equal(r.answer, "");
  assert.match(r.error, /timeout/);
});

test("checkFacts needs every expected string, ignoring case and spaces", () => {
  assert.equal(checkFacts("General Admission is $350.", ["$350"]), true);
  assert.equal(checkFacts("It costs 350 dollars.", ["$350"]), false);
  assert.equal(checkFacts("anything", []), true);
});

test("summarize gives accuracy, latency percentiles, cost, and words for each path", () => {
  const rows = [
    { variant: "llm_only", ms: 2000, ok: true, words: 120, jevUsage: null, llmUsage: { input_tokens: 12000, output_tokens: 150 } },
    { variant: "jev_first", path: "system1", ms: 200, ok: true, words: 20, intentOk: true, jevUsage: { input_tokens: 900 }, llmUsage: null },
  ];
  const s = summarize(rows, { jevPerMTok: 0.042, llmInPerMTok: 3, llmOutPerMTok: 15 });
  assert.equal(s.llm_only.factAccuracy, 1);
  assert.equal(s.jev_first.system2Share, 0);
  assert.ok(s.llm_only.costPer1000 > s.jev_first.costPer1000);
});

test("summarize uses the reported LLM cost (costUsd) when it exists", () => {
  const rows = [{ variant: "llm_only", ms: 1, ok: true, words: 1, llmUsage: { input_tokens: 1e6, output_tokens: 0 }, llmCostUsd: 0.01 }];
  const s = summarize(rows, { jevPerMTok: 0.042, llmInPerMTok: 3, llmOutPerMTok: 15 });
  assert.equal(s.llm_only.costPer1000, 10);
});

test("the claude -p call loads no user settings and no tools", () => {
  const a = cliArgs({ system: "S", model: "sonnet" });
  const at = (flag) => a[a.indexOf(flag) + 1];
  assert.equal(at("--setting-sources"), "");
  assert.equal(at("--tools"), "");
  assert.equal(at("--system-prompt"), "S");
  assert.ok(a.includes("--no-session-persistence"));
});
