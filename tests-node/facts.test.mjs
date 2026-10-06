// Every exact fact that code puts in an answer must appear in the guide snapshot.
// If the guide changes, this test fails before any benchmark runs.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const guide = fs.readFileSync("src/ask/data/guide.txt", "utf8").replace(/\s+/g, " ");
const facts = JSON.parse(fs.readFileSync("src/ask/data/facts.json", "utf8"));
const values = [
  facts.dates, facts.venue,
  facts.tickets.general_admission.price, facts.tickets.gold.price,
  facts.group_discount.price_each, `${facts.group_discount.percent}%`,
  facts.exec_summit.name, facts.exec_summit.apply, facts.exec_summit.cost,
  ...facts.tracks, ...facts.summits, ...facts.included,
];

for (const v of values) {
  test(`the guide contains "${v}"`, () => {
    assert.ok(guide.includes(v), `"${v}" is not in src/ask/data/guide.txt; check facts.json against the guide`);
  });
}
