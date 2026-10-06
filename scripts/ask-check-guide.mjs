// Fetches the live RenderATL guide and checks facts.json against it.
//   npm run check:guide
// Run it before the workshop. Exit code 1 means that a fact changed: update guide.txt and facts.json.
import fs from "node:fs";
import { missingFacts } from "../src/ask/core/factcheck.js";

const facts = JSON.parse(fs.readFileSync("src/ask/data/facts.json", "utf8"));
const res = await fetch(facts.source, { signal: AbortSignal.timeout(15000) });
if (!res.ok) { console.error(`${facts.source}: HTTP ${res.status}`); process.exit(2); }
const text = (await res.text()).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")
  .replace(/&amp;/g, "&").replace(/&#x27;|&#39;|&rsquo;/g, "'").replace(/&nbsp;/g, " ");
const missing = missingFacts(facts, text);
if (missing.length) { console.error(`The live guide does not match facts.json (checked ${facts.checked}):\n${missing.join("\n")}`); process.exit(1); }
console.log(`The live guide matches facts.json (${facts.source}).`);
