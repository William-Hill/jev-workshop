import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const INTENTS = ["price", "dates_venue", "group_discount", "included", "tracks", "exec_summit", "ticket_choice", "fit", "manager_email", "trip_plan", "other"];
const TICKETS = ["general_admission", "gold", "exec_summit"];
const facts = JSON.parse(fs.readFileSync("src/ask/data/facts.json", "utf8"));
// Answers write the discount as "20%"; facts.json stores the number 20.
const factText = JSON.stringify(facts) + ` ${facts.group_discount.percent}%`;
const rows = fs.readFileSync("src/ask/data/questions.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l));

test("the set has 100 questions with unique ids", () => {
  assert.equal(rows.length, 100);
  assert.equal(new Set(rows.map((r) => r.id)).size, 100);
});

test("the split is 70 tune and 30 heldout", () => {
  assert.equal(rows.filter((r) => r.split === "tune").length, 70);
  assert.equal(rows.filter((r) => r.split === "heldout").length, 30);
});

test("each row has a valid intent, ticket, and expect list", () => {
  for (const r of rows) {
    assert.ok(INTENTS.includes(r.intent), `${r.id}: bad intent ${r.intent}`);
    if (r.intent === "ticket_choice") assert.ok(TICKETS.includes(r.ticket), `${r.id}: ticket_choice needs a ticket`);
    else assert.equal(r.ticket, null, `${r.id}: only ticket_choice has a ticket`);
    assert.ok(Array.isArray(r.expect), `${r.id}: expect must be a list`);
    for (const e of r.expect) assert.ok(factText.includes(e), `${r.id}: "${e}" is not a value in facts.json`);
    assert.equal(r.synthetic, true, `${r.id}: mark synthetic questions`);
  }
});

test("each intent has at least 6 questions, and the held-out split covers each intent", () => {
  for (const i of INTENTS) {
    assert.ok(rows.filter((r) => r.intent === i).length >= 6, `${i}: too few questions`);
    assert.ok(rows.some((r) => r.intent === i && r.split === "heldout"), `${i}: no held-out question`);
  }
});
