import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildJevRequest, decideRoute, SYSTEM2_INTENTS } from "../src/ask/core/system1.js";
import { answerFromFacts } from "../src/ask/core/templates.js";

const facts = JSON.parse(fs.readFileSync("src/ask/data/facts.json", "utf8"));
const answers = (intent, p, answerable = 0.9, ticket = "general_admission") => ({
  intent: { type: "choice", choice: intent, probabilities: { [intent]: p }, confidence: p },
  answerable: { type: "noul", noul: answerable },
  ticket: { type: "choice", choice: ticket, probabilities: { [ticket]: 0.9 }, confidence: 0.8 },
});

test("the request pins the model and asks three questions about one state", () => {
  const r = buildJevRequest("How much is Gold?");
  assert.equal(r.model, "jev-1.13.0");
  assert.deepEqual(r.state, { question: "How much is Gold?" });
  assert.deepEqual(Object.keys(r.questions).sort(), ["answerable", "intent", "ticket"]);
  assert.equal(Object.keys(r.questions.intent.criteria).length, 11);
});

test("a clear fact question stays in System 1", () => {
  assert.equal(decideRoute(answers("price", 0.92)).path, "system1");
});

test("writing and judgment intents go to System 2", () => {
  for (const i of SYSTEM2_INTENTS) assert.equal(decideRoute(answers(i, 0.99)).path, "system2");
});

test("a low intent probability goes to System 2", () => {
  assert.equal(decideRoute(answers("price", 0.55)).path, "system2");
});

test("a question that the facts cannot answer goes to System 2", () => {
  const d = decideRoute(answers("included", 0.9, 0.2));
  assert.equal(d.path, "system2");
  assert.match(d.why, /answerable/);
});

test("templates take every number from facts.json", () => {
  assert.match(answerFromFacts("price", null, "How much?", facts), /\$350/);
  assert.match(answerFromFacts("group_discount", null, "6 of us", facts), /20%.*\$280/);
  assert.match(answerFromFacts("group_discount", null, "8 gold tickets", facts), /Gold tickets are not eligible/);
  assert.ok(answerFromFacts("dates_venue", null, "when?", facts).includes(facts.dates));
  assert.match(answerFromFacts("ticket_choice", "gold", "I lead a team", facts), /Gold.*\$800/);
  assert.match(answerFromFacts("exec_summit", null, "exec?", facts), /complimentary if approved/);
  assert.match(answerFromFacts("tracks", null, "observability?", facts), /New Relic RUNTIME/);
});

test("the included template names the item that the question asks about", () => {
  assert.match(answerFromFacts("included", null, "does my ticket include the concert?", facts), /^Yes\. The badge includes RenderFEST/);
  assert.match(answerFromFacts("included", null, "do i get food with the badge", facts), /^Yes\. The badge includes Food Truck Park/);
});

test("a template for a System 2 intent is an error", () => {
  assert.throws(() => answerFromFacts("trip_plan", null, "plan", facts), /System 2/);
});
