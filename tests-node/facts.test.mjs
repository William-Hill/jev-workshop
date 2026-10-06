// Every exact fact that code puts in an answer must appear in the guide snapshot.
// The benchmark runs the same check before it starts (src/ask/core/factcheck.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { factStrings, missingFacts } from "../src/ask/core/factcheck.js";

const guide = fs.readFileSync("src/ask/data/guide.txt", "utf8");
const facts = JSON.parse(fs.readFileSync("src/ask/data/facts.json", "utf8"));

for (const v of factStrings(facts)) {
  test(`the guide contains "${v}"`, () => {
    assert.deepEqual(missingFacts({ ...facts }, guide).filter((m) => m.startsWith(`"${v}"`)), [], `check facts.json against src/ask/data/guide.txt`);
  });
}
