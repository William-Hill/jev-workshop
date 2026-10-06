// Tests for the findings of the final review (2026-10-06).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { decideRoute, ROUTE_THRESHOLDS } from "../src/ask/core/system1.js";
import { answerFromFacts } from "../src/ask/core/templates.js";
import { jevFirst } from "../src/ask/core/pipelines.js";
import { summarize, llmCost } from "../src/ask/core/metrics.js";
import { missingFacts } from "../src/ask/core/factcheck.js";

const facts = JSON.parse(fs.readFileSync("src/ask/data/facts.json", "utf8"));
const guide = fs.readFileSync("src/ask/data/guide.txt", "utf8");
const answers = (intent, p, answerable = 0.9, ticket = { type: "choice", choice: "gold", probabilities: { gold: 0.9 }, confidence: 0.8 }) => {
  const a = { intent: { type: "choice", choice: intent, probabilities: { [intent]: p }, confidence: p }, answerable: { type: "noul", noul: answerable } };
  if (ticket) a.ticket = ticket;
  return a;
};
const jevOf = (a) => async () => ({ answers: a, usage: { input_tokens: 900 } });
const fakeLlm = async () => ({ text: "LLM answer", usage: { input_tokens: 10, output_tokens: 5 } });

test("the tuned thresholds are the defaults: 0.7 and 0.2", () => {
  assert.deepEqual(ROUTE_THRESHOLDS, { minProbability: 0.7, minAnswerable: 0.2 });
  assert.equal(decideRoute(answers("price", 0.9, 0.25)).path, "system1");
  assert.equal(decideRoute(answers("price", 0.9, 0.19)).path, "system2");
});

test("an 'is X included' question about an item that is not in the facts goes to System 2", async () => {
  assert.equal(answerFromFacts("included", null, "is parking included?", facts), null);
  const r = await jevFirst("is parking included?", { jev: jevOf(answers("included", 0.95)), llm: fakeLlm, guide: "G", facts });
  assert.equal(r.path, "system2");
  assert.match(r.route.why, /no fact/);
});

test("a general 'what is included' question still gets the full list", () => {
  assert.match(answerFromFacts("included", null, "what does my badge include?", facts), /RenderFEST/);
});

test("an item word matches at the start of a word only", () => {
  assert.equal(answerFromFacts("included", null, "is wheelchair seating included?", facts), null);
  assert.match(answerFromFacts("included", null, "can we eat lunch there?", facts), /Food Truck Park/);
});

test("Jev answers without a ticket answer do not crash the Jev-first path", async () => {
  const r = await jevFirst("How much is a ticket?", { jev: jevOf(answers("price", 0.95, 0.9, null)), llm: fakeLlm, guide: "G", facts });
  assert.equal(r.path, "system1");
  assert.match(r.answer, /\$350/);
});

test("a template error sends the question to System 2", async () => {
  const r = await jevFirst("6 of us?", { jev: jevOf(answers("group_discount", 0.95)), llm: fakeLlm, guide: "G", facts: { ...facts, group_discount: null } });
  assert.equal(r.path, "system2");
  assert.match(r.route.why, /template failed/);
});

test("summarize counts the rows that have no fact check", () => {
  const rows = [
    { variant: "llm_only", ok: true, checked: true, ms: 1, words: 1 },
    { variant: "llm_only", ok: false, checked: true, ms: 1, words: 1 },
    { variant: "llm_only", ok: true, checked: false, ms: 1, words: 1 },
  ];
  const s = summarize(rows, { jevPerMTok: 0, llmInPerMTok: 0, llmOutPerMTok: 0 }).llm_only;
  assert.equal(s.unchecked, 1);
  assert.equal(s.factAccuracyChecked, 0.5);
});

test("llmCost uses token prices when no reported cost exists (the API backend)", () => {
  assert.equal(llmCost({ llmUsage: { input_tokens: 1e6, output_tokens: 1e6 } }, { llmInPerMTok: 3, llmOutPerMTok: 15 }), 18);
});

test("the fact check finds nothing missing in the snapshot", () => {
  assert.deepEqual(missingFacts(facts, guide), []);
});

test("the fact check finds a changed price next to its ticket name", () => {
  const changed = guide.replaceAll("General Admission, Early Bird, $350", "General Admission, Early Bird, $400");
  assert.ok(missingFacts(facts, changed).some((m) => /General Admission, Early Bird, \$350/.test(m)));
});

test("the fact check covers the tier, the group size, and the Gold note", () => {
  const m = missingFacts({ ...facts, group_discount: { ...facts.group_discount, min_tickets: 7 }, tickets: { ...facts.tickets, gold: { ...facts.tickets.gold, tier: "Late" } } }, guide);
  assert.ok(m.some((x) => /7 or more/.test(x)));
  assert.ok(m.some((x) => /Gold, Late/.test(x)));
});
