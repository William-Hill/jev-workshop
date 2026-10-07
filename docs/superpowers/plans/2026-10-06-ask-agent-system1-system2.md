# Ask Your Agent: System 1 → System 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local demo and an A/B benchmark for RenderATL attendee questions: **Jev first** (Jev classifies; code answers easy questions from checked facts; an LLM gets the rest) against **LLM only**, measured for fact accuracy, latency, cost, and answer length.

**Architecture:** Pure logic in `src/ask/core/` (no Node or browser APIs), shared by a Node benchmark (`scripts/ask-bench.mjs`) and a browser demo page (`ask.html`). Exact facts (prices, dates, address) live in `src/ask/data/facts.json`, checked against a dated snapshot of the RenderATL guide. Jev and the LLM are called from Node with keys from `.env`; the demo page calls them through the existing proxy routes `/api/jev` and `/api/llm`.

**Tech Stack:** Node 26 (ES modules, `node:test`, `process.loadEnvFile`), `@anthropic-ai/sdk`, the TypeSafe HTTP API (`POST https://api.typesafe.ai/v1/systemone`), Vite 5 for the demo page.

**Spec:** `docs/superpowers/specs/2026-10-06-system1-system2-design.md` (Part A).

**Prerequisite:** Plan `docs/superpowers/plans/2026-10-06-maze-system2.md`, Task 4, Steps 1, 2, and 4: the `claude-api` skill check, the SDK install, and the `/api/llm` proxy route. Task 5 of this plan (the demo page) needs that route. Tasks 1 to 4 do not.

## Global Constraints

- Keep the 24 Playwright tests green (`npm test`). Add Node tests under `tests-node/`, run with `npm run test:ask`.
- Keep `TYPESAFE_API_KEY` and `ANTHROPIC_API_KEY` in `.env` only. No key in browser code, logs, or results.
- Code owns every price, date, URL, and address. Jev never produces a number; it only picks an intent and a ticket.
- Label each answer with its path: `system1` (template from facts) or `system2` (LLM), and record the reason.
- Write docs and comments in ASD-STE100 Simplified Technical English.
- Read the `claude-api` skill before Task 4. Confirm the model ID, the prices, and prompt caching there.
- System 2 model and the LLM-only model are the same: `claude-sonnet-5-5` unless `LLM_MODEL` says otherwise.
- Jev model: pin `jev-1.13.0`.
- Spend cap for each benchmark run: $5. Estimate first; stop if the estimate is higher.
- Tune thresholds on the 70 `tune` questions only. Report final numbers on the 30 `heldout` questions only.
- Mark every synthetic question as synthetic. Real attendee questions, when the user gives them, go in a separate file.

## Review Focus

- A question that mixes two intents ("How much is Gold, and can you draft the email to my boss?"). Expected: System 2, because the writing part needs it. Test in Task 3 (a question labeled `manager_email` with `expect` facts).
- A price question in another language ("¿Cuánto cuesta la entrada?"). Expected: if Jev is unsure, System 2; never a wrong price. Test in Task 2 (two non-English questions in the set) and Task 3.
- The guide changes after the snapshot (a new price). Expected: the fact check fails loudly before any benchmark run. Test in Task 1.
- Jev or the LLM returns an error or times out. Expected: the Jev-first path sends the question to System 2; the LLM error is recorded as a failed answer, not a crash. Test in Task 4.
- A System 1 answer for a question that the facts cannot answer ("Is parking free?"). Expected: `answerable` is low, so System 2 answers. Test in Task 3.

---

### Task 1: Guide snapshot and checked facts

**Files:**
- Create: `src/ask/data/guide.txt` (plain-text snapshot of the guide, with the fetch date on line 1)
- Create: `src/ask/data/facts.json`
- Create: `tests-node/facts.test.mjs`
- Modify: `package.json` (add the `test:ask` script)

**Interfaces:**
- Produces: `facts.json` with this exact shape, used by Tasks 3 to 5:

```json
{
  "source": "https://www.renderatl.com/renderatl-guide",
  "checked": "YYYY-MM-DD",
  "dates": "August 18-19, 2027",
  "venue": "230 John Portman Blvd NW, Building 2, Atlanta, GA 30303",
  "tickets": {
    "general_admission": { "name": "General Admission", "price": "$350", "tier": "Early Bird" },
    "gold": { "name": "Gold", "price": "$800", "tier": "Regular", "adds": "The Commits and Leaders Lounge access" }
  },
  "group_discount": { "min_tickets": 5, "percent": 20, "price_each": "$280" },
  "exec_summit": { "apply": "https://renderatl.typeform.com/to/gj9GSuiV", "cost": "complimentary if approved" },
  "included": ["Main Conference Programming", "Breakout Workshops", "RenderFEST", "Expo & Career Fair", "Atlanta Tech Week access", "Side Events & networking mixers", "Food Truck Park access"],
  "tracks": ["Web Technologies", "AI (Atlanta AI Expo)", "UI/UX Design", "Go-to-Market (GTM Summit)", "OpenJS Node Interactive Summit", "New Relic RUNTIME", "Legal Tech Summit & Track"]
}
```

The values above come from a fetch on 2026-10-04. Step 1 re-fetches the guide; update any value that changed.

- [ ] **Step 1: Fetch the guide snapshot**

```bash
mkdir -p src/ask/data
{ echo "# RenderATL 2027 guide, fetched $(date +%F) from https://www.renderatl.com/renderatl-guide"; \
  curl -sL https://www.renderatl.com/renderatl-guide | python3 -c "import sys,re,html;t=sys.stdin.read();t=re.sub(r'(?s)<(script|style).*?</\1>','',t);t=re.sub(r'<br\s*/?>|</(p|li|h[1-6]|div|tr)>','\n',t);t=re.sub(r'<[^>]+>','',t);t=html.unescape(t);print(re.sub(r'\n\s*\n+','\n\n',t).strip())"; } > src/ask/data/guide.txt
wc -w src/ask/data/guide.txt
```

Expected: about 8,000 to 9,000 words. If it is much less, the page needs JavaScript; then fetch it with the Playwright browser (`page.goto`, `page.innerText("body")`) and save that text instead.

- [ ] **Step 2: Write `facts.json`**

Create `src/ask/data/facts.json` with the shape in **Interfaces**. Read `guide.txt` and correct any value that differs. Set `checked` to today.

- [ ] **Step 3: Write the failing fact test**

Create `tests-node/facts.test.mjs`:

```js
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
  ...facts.tracks.map((t) => t.split(" (")[0]),
];

for (const v of values) {
  test(`the guide contains "${v}"`, () => {
    assert.ok(guide.includes(v), `"${v}" is not in src/ask/data/guide.txt; check facts.json against the guide`);
  });
}
```

In `package.json` `scripts`, add: `"test:ask": "node --test tests-node/"`.

- [ ] **Step 4: Run the test**

Run: `npm run test:ask`
Expected: PASS for every value. If a value fails, the guide text uses a different form (for example `August 18–19, 2027` with an en dash). Change `facts.json` to the exact form in the guide, and run again.

- [ ] **Step 5: Commit**

```bash
git add src/ask/data/guide.txt src/ask/data/facts.json tests-node/facts.test.mjs package.json
git commit -m "Add a dated RenderATL guide snapshot and checked facts for the Ask Your Agent demo"
```

---

### Task 2: The labeled question set

**Files:**
- Create: `src/ask/data/questions.jsonl`
- Create: `tests-node/questions.test.mjs`

**Interfaces:**
- Produces: one JSON object for each line, used by Tasks 3 and 4:

```json
{"id": "q001", "question": "How much is a ticket?", "intent": "price", "ticket": null, "expect": ["$350", "$800"], "split": "tune", "synthetic": true}
```

  - `intent`: one of `price`, `dates_venue`, `group_discount`, `included`, `tracks`, `exec_summit`, `ticket_choice`, `fit`, `manager_email`, `trip_plan`, `other`.
  - `ticket`: for `ticket_choice` only, one of `general_admission`, `gold`, `exec_summit`; else `null`.
  - `expect`: fact strings that a correct answer must contain, copied exactly from `facts.json`; `[]` when no fact is required.
  - `split`: `tune` or `heldout`.

- [ ] **Step 1: Write the questions**

Write 100 questions in `src/ask/data/questions.jsonl` with this distribution (tune / heldout):

| Intent | Count | Rules for the questions |
|---|---|---|
| `price` | 12 (8/4) | Vary the words: "cost", "how much", "price of Gold", "cheapest pass". `expect` the price(s) asked for. |
| `dates_venue` | 10 (7/3) | "when", "where", "what dates", "which building". `expect` the date or the address asked for. |
| `group_discount` | 8 (6/2) | Team sizes 3 to 15. A team of 5 or more: `expect` `20%` and `$280`. Under 5: `expect` `5`. |
| `included` | 8 (6/2) | Ask about one item (concert, career fair, food, Atlanta Tech Week). `expect` [] (the item name is checked by the template). |
| `tracks` | 8 (6/2) | Ask about one topic (observability, design, legal, Node). `expect` the track name. |
| `exec_summit` | 6 (4/2) | `expect` `complimentary if approved`. |
| `ticket_choice` | 12 (8/4) | Describe a person (a student, a VP, a team lead of 12). Set `ticket`. `expect` the price of that ticket, or [] for `exec_summit`. |
| `fit` | 10 (7/3) | "Is it worth it for a junior designer?" `expect` []. |
| `manager_email` | 8 (6/2) | Two of them also ask for a price: `expect` that price. |
| `trip_plan` | 8 (6/2) | `expect` `August 18-19, 2027` (in the guide's exact form). |
| `other` | 10 (7/3) | Parking, hotels, refunds, code of conduct, and 2 questions in Spanish (one about price). `expect` []. |

Rules:
- Write like attendees: short, informal, some typos. No question may copy the wording of a criterion in Task 3.
- Number the ids `q001` to `q100`. Set `"synthetic": true` on each line.

- [ ] **Step 2: Write the validator test**

Create `tests-node/questions.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const INTENTS = ["price", "dates_venue", "group_discount", "included", "tracks", "exec_summit", "ticket_choice", "fit", "manager_email", "trip_plan", "other"];
const TICKETS = ["general_admission", "gold", "exec_summit"];
const facts = JSON.parse(fs.readFileSync("src/ask/data/facts.json", "utf8"));
const factText = JSON.stringify(facts);
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
```

- [ ] **Step 3: Run the tests**

Run: `npm run test:ask`
Expected: PASS. Fix the data, not the test, if one fails.

- [ ] **Step 4: Commit**

```bash
git add src/ask/data/questions.jsonl tests-node/questions.test.mjs
git commit -m "Add 100 labeled synthetic attendee questions (70 tune, 30 held out)"
```

---

### Task 3: System 1 core: the Jev request, the route rule, and the templates

**Files:**
- Create: `src/ask/core/system1.js`
- Create: `src/ask/core/templates.js`
- Create: `tests-node/system1.test.mjs`

**Interfaces:**
- Consumes: `facts.json` (Task 1).
- Produces (used by Tasks 4 and 5):
  - `buildJevRequest(question: string) -> { model, state, questions }`
  - `decideRoute(answers, { minProbability = 0.7, minAnswerable = 0.5 }) -> { path: "system1" | "system2", intent: string, probability: number, why: string }`
  - `answerFromFacts(intent: string, ticket: string | null, question: string, facts) -> string`
  - `SYSTEM2_INTENTS: Set<string>`

- [ ] **Step 1: Write the failing tests**

Create `tests-node/system1.test.mjs`:

```js
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
  const d = decideRoute(answers("price", 0.92));
  assert.equal(d.path, "system1");
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
  assert.match(answerFromFacts("dates_venue", null, "when?", facts), new RegExp(facts.dates));
  assert.match(answerFromFacts("ticket_choice", "gold", "I lead a team", facts), /Gold.*\$800/);
  assert.match(answerFromFacts("exec_summit", null, "exec?", facts), /complimentary if approved/);
});

test("a template for a System 2 intent is an error", () => {
  assert.throws(() => answerFromFacts("trip_plan", null, "plan", facts), /System 2/);
});
```

Run: `npm run test:ask`
Expected: FAIL ("Cannot find module '../src/ask/core/system1.js'").

- [ ] **Step 2: Write `system1.js`**

Create `src/ask/core/system1.js`:

```js
// System 1 for attendee questions: one Jev request with three questions about the same state.
// Jev picks an intent, says if the checked facts can answer, and picks a ticket.
// Code decides the route. Jev never writes an answer or a number.

export const JEV_MODEL = "jev-1.13.0";

export const SYSTEM2_INTENTS = new Set(["fit", "manager_email", "trip_plan", "other"]);

// Rule 1 of the talk: write the exact condition in each option. Jev does not see the keys.
const INTENT_CRITERIA = {
  price: "The question asks what a RenderATL 2027 ticket costs, or which ticket is the cheapest. It does not ask which ticket fits the person.",
  dates_venue: "The question asks when RenderATL 2027 takes place, or the address or building of the venue.",
  group_discount: "The question asks about a discount or a price for a group, a team, or several tickets.",
  included: "The question asks if the badge or ticket includes a specific thing, for example the concert, workshops, food, the career fair, or Atlanta Tech Week events.",
  tracks: "The question asks if the conference has talks or a track about a topic, for example AI, design, observability, Node, legal tech, or go-to-market.",
  exec_summit: "The question asks about the Executive Summit: who can attend, how to apply, or what it costs.",
  ticket_choice: "The question describes the person (role, experience, team, goals) and asks which ticket they should buy.",
  fit: "The question asks if attending RenderATL is worth it or a good fit for the person, which needs a judgment about their goals.",
  manager_email: "The question asks for help to convince a manager or employer to pay, for example a draft email or arguments.",
  trip_plan: "The question asks for help to plan the trip: schedule, days, travel, budget, or what to do in Atlanta.",
  other: "The question is about anything else: parking, hotels, refunds, policies, the code of conduct, or a topic not listed in the other options.",
};

const TICKET_CRITERIA = {
  general_admission: "General Admission: for engineers, developers, designers, AI builders, founders, students, and community attendees.",
  gold: "Gold: everything in General Admission plus The Commits and the Leaders Lounge; for engineering leaders and managers who want the leader programming.",
  exec_summit: "Executive Summit: for senior executives (VP, CTO, CEO level); it needs a separate application.",
};

export function buildJevRequest(question) {
  return {
    model: JEV_MODEL,
    state: { question },
    questions: {
      intent: { type: "choice", instructions: "Which topic does the attendee question in `question` ask about?", criteria: INTENT_CRITERIA },
      answerable: {
        type: "noul",
        instructions: "Can the question in `question` be answered completely with only these facts about RenderATL 2027: ticket prices, the dates, the venue address, the group discount, what the badge includes, the list of tracks, and how to apply to the Executive Summit?",
        criteria: { true: "These facts answer the whole question.", false: "The question needs other information, advice, or writing." },
      },
      ticket: { type: "choice", instructions: "Which RenderATL 2027 ticket fits the person described in `question` best?", criteria: TICKET_CRITERIA },
    },
  };
}

export function decideRoute(answers, { minProbability = 0.7, minAnswerable = 0.5 } = {}) {
  const intent = answers.intent.choice;
  const probability = answers.intent.probabilities[intent] ?? 0;
  if (SYSTEM2_INTENTS.has(intent)) return { path: "system2", intent, probability, why: `intent "${intent}" needs writing or judgment` };
  if (probability < minProbability) return { path: "system2", intent, probability, why: `intent probability ${probability} is below ${minProbability}` };
  if (answers.answerable.noul < minAnswerable) return { path: "system2", intent, probability, why: `answerable ${answers.answerable.noul} is below ${minAnswerable}` };
  return { path: "system1", intent, probability, why: `intent "${intent}" at probability ${probability}` };
}
```

- [ ] **Step 3: Write `templates.js`**

Create `src/ask/core/templates.js`:

```js
// System 1 answers. Code writes every answer from facts.json, so every number is exact.

export function answerFromFacts(intent, ticket, question, f) {
  const ga = f.tickets.general_admission, gold = f.tickets.gold, g = f.group_discount;
  switch (intent) {
    case "price":
      return `${ga.name} is ${ga.price} (${ga.tier}). ${gold.name} is ${gold.price} (${gold.tier}) and adds ${gold.adds}. Source: ${f.source}`;
    case "dates_venue":
      return `RenderATL 2027 is on ${f.dates} at ${f.venue}.`;
    case "group_discount":
      return `Groups of ${g.min_tickets} or more ${ga.name} tickets get ${g.percent}% off: ${g.price_each} each at the ${ga.tier} rate.`;
    case "included": {
      const q = question.toLowerCase();
      const hit = f.included.find((item) => q.includes(item.toLowerCase().split(" ")[0]));
      return hit
        ? `Yes. The badge includes ${hit}. It also includes: ${f.included.filter((i) => i !== hit).join(", ")}.`
        : `The badge includes: ${f.included.join(", ")}.`;
    }
    case "tracks":
      return `The tracks are: ${f.tracks.join("; ")}. All are included with the badge.`;
    case "exec_summit":
      return `The Executive Summit needs a separate application (${f.exec_summit.apply}). It is ${f.exec_summit.cost}.`;
    case "ticket_choice":
      if (ticket === "gold") return `${gold.name} (${gold.price}) fits best: it adds ${gold.adds} to everything in ${ga.name}.`;
      if (ticket === "exec_summit") return `Apply to the Executive Summit (${f.exec_summit.apply}); it is ${f.exec_summit.cost}. Buy ${ga.name} (${ga.price}) for the rest of the conference.`;
      return `${ga.name} (${ga.price}, ${ga.tier}) fits best. It includes the full conference, the workshops, and RenderFEST.`;
    default:
      throw new Error(`Intent "${intent}" is a System 2 intent; it has no template`);
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `npm run test:ask`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ask/core/system1.js src/ask/core/templates.js tests-node/system1.test.mjs
git commit -m "Add the System 1 core for attendee questions: Jev request, route rule, and fact templates"
```

---

### Task 4: The two pipelines and the A/B benchmark

**Files:**
- Create: `src/ask/core/pipelines.js`
- Create: `src/ask/core/metrics.js`
- Create: `scripts/ask-clients.mjs`
- Create: `scripts/ask-bench.mjs`
- Create: `tests-node/pipelines.test.mjs`
- Modify: `.gitignore` (add `/ask-results/`)

**Interfaces:**
- Consumes: Task 3 exports; `facts.json`; `guide.txt`.
- Produces:
  - `llmOnly(question, { llm, guide }) -> Promise<Result>`
  - `jevFirst(question, { jev, llm, guide, facts, thresholds }) -> Promise<Result>`
  - `Result = { path: "llm_only" | "system1" | "system2", answer: string, ms: number, jev?: object, route?: object, llmUsage?: object, jevUsage?: object, error?: string }`
  - `jev(body) -> Promise<response>` and `llm({ system, prompt, max_tokens }) -> Promise<{ text, usage, model }>` (clients; injectable in tests)
  - `checkFacts(answer, expect) -> boolean`, `summarize(rows, prices) -> object`

- [ ] **Step 1: Write the failing tests**

Create `tests-node/pipelines.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { llmOnly, jevFirst } from "../src/ask/core/pipelines.js";
import { checkFacts, summarize } from "../src/ask/core/metrics.js";

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
```

Note: the prices in this test are test values only. The benchmark reads the real prices from the `claude-api` skill (Step 5).

Run: `npm run test:ask`
Expected: FAIL ("Cannot find module '../src/ask/core/pipelines.js'").

- [ ] **Step 2: Write `pipelines.js`**

Create `src/ask/core/pipelines.js`:

```js
// The two paths of the A/B test. Both use the same LLM and the same guide text.
import { buildJevRequest, decideRoute } from "./system1.js";
import { answerFromFacts } from "./templates.js";

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

function systemPrompt(guide) {
  return [
    "You answer questions from people who think about attending RenderATL 2027.",
    "Use only the guide below for facts. Copy prices, dates, and addresses exactly as the guide writes them.",
    "If the guide does not answer the question, say so in one sentence.",
    "<guide>", guide, "</guide>",
  ].join("\n");
}

async function callLlm(llm, guide, prompt) {
  try {
    const r = await llm({ system: systemPrompt(guide), prompt, max_tokens: 600 });
    return { answer: r.text, llmUsage: r.usage, model: r.model };
  } catch (err) {
    return { answer: "", error: String((err && err.message) || err) };
  }
}

export async function llmOnly(question, { llm, guide }) {
  const t0 = now();
  const r = await callLlm(llm, guide, question);
  return { path: "llm_only", ...r, ms: Math.round(now() - t0) };
}

export async function jevFirst(question, { jev, llm, guide, facts, thresholds = {} }) {
  const t0 = now();
  let response = null, route;
  try {
    response = await jev(buildJevRequest(question));
    route = decideRoute(response.answers, thresholds);
  } catch (err) {
    route = { path: "system2", intent: null, probability: 0, why: `Jev failed: ${String((err && err.message) || err)}` };
  }
  if (route.path === "system1") {
    const ticket = response.answers.ticket.choice;
    const answer = answerFromFacts(route.intent, ticket, question, facts);
    return { path: "system1", answer, route, jev: response.answers, jevUsage: response.usage, ms: Math.round(now() - t0) };
  }
  const hint = route.intent ? `\n\n(Topic of this question, from a classifier: ${route.intent}.)` : "";
  const r = await callLlm(llm, guide, question + hint);
  return { path: "system2", ...r, route, jev: response && response.answers, jevUsage: response && response.usage, ms: Math.round(now() - t0) };
}
```

- [ ] **Step 3: Write `metrics.js`**

Create `src/ask/core/metrics.js`:

```js
// Scores for the A/B test.
const norm = (s) => String(s).toLowerCase().replace(/\s+/g, " ");

export function checkFacts(answer, expect) {
  const a = norm(answer);
  return expect.every((e) => a.includes(norm(e)));
}

const pct = (xs, p) => { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };

export function summarize(rows, prices) {
  const out = {};
  for (const variant of ["llm_only", "jev_first"]) {
    const r = rows.filter((x) => x.variant === variant);
    if (!r.length) continue;
    const ms = r.map((x) => x.ms);
    const cost = r.reduce((sum, x) => sum
      + ((x.jevUsage && x.jevUsage.input_tokens) || 0) * prices.jevPerMTok / 1e6
      + ((x.llmUsage && x.llmUsage.input_tokens) || 0) * prices.llmInPerMTok / 1e6
      + ((x.llmUsage && x.llmUsage.output_tokens) || 0) * prices.llmOutPerMTok / 1e6, 0);
    out[variant] = {
      n: r.length,
      factAccuracy: r.filter((x) => x.ok).length / r.length,
      msMean: Math.round(ms.reduce((a, b) => a + b, 0) / r.length),
      msP50: pct(ms, 0.5),
      msP95: pct(ms, 0.95),
      costPer1000: Math.round(cost / r.length * 1000 * 100) / 100,
      wordsMean: Math.round(r.reduce((a, x) => a + x.words, 0) / r.length),
      errors: r.filter((x) => x.error).length,
    };
    if (variant === "jev_first") {
      out[variant].system2Share = r.filter((x) => x.path === "system2").length / r.length;
      out[variant].intentAccuracy = r.filter((x) => x.intentOk).length / r.length;
    }
  }
  return out;
}
```

- [ ] **Step 4: Run the tests**

Run: `npm run test:ask`
Expected: all PASS.

- [ ] **Step 5: Write the Node clients and the benchmark**

First read the `claude-api` skill and copy the model's input and output prices into `PRICES` below. If the skill recommends prompt caching for a long, fixed system prompt, add `cache_control` to the guide block in `llm()` and record the cached tokens; apply it to both paths.

Create `scripts/ask-clients.mjs`:

```js
// Node clients for the A/B benchmark. Keys come from .env and stay in this process.
import Anthropic from "@anthropic-ai/sdk";

process.loadEnvFile(".env");
const TYPESAFE_URL = "https://api.typesafe.ai/v1/systemone";

export async function jev(body) {
  const res = await fetch(TYPESAFE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Jev HTTP ${res.status}`);
  return res.json();
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 60000 });
export const LLM_MODEL = process.env.LLM_MODEL || "claude-sonnet-5-5";

export async function llm({ system, prompt, max_tokens }) {
  const msg = await anthropic.messages.create({ model: LLM_MODEL, max_tokens, system, messages: [{ role: "user", content: prompt }] });
  return { text: msg.content.filter((c) => c.type === "text").map((c) => c.text).join(""), usage: msg.usage, model: msg.model };
}
```

Create `scripts/ask-bench.mjs`:

```js
// A/B benchmark: each question goes through LLM only and through Jev first.
//   node scripts/ask-bench.mjs --split tune
//   node scripts/ask-bench.mjs --split heldout --min-probability 0.7
import fs from "node:fs";
import { jev, llm, LLM_MODEL } from "./ask-clients.mjs";
import { llmOnly, jevFirst } from "../src/ask/core/pipelines.js";
import { checkFacts, summarize } from "../src/ask/core/metrics.js";

// Copy these from the claude-api skill before the first run. Jev: TypeSafe models page.
const PRICES = { jevPerMTok: 0.042, llmInPerMTok: Number(process.env.LLM_IN_PER_MTOK), llmOutPerMTok: Number(process.env.LLM_OUT_PER_MTOK) };
if (!Number.isFinite(PRICES.llmInPerMTok) || !Number.isFinite(PRICES.llmOutPerMTok)) {
  console.error("Set LLM_IN_PER_MTOK and LLM_OUT_PER_MTOK (dollars per million tokens) from the claude-api skill.");
  process.exit(2);
}
const arg = (name, def) => { const i = process.argv.indexOf("--" + name); return i > 0 ? process.argv[i + 1] : def; };
const split = arg("split", "tune");
const thresholds = { minProbability: Number(arg("min-probability", 0.7)), minAnswerable: Number(arg("min-answerable", 0.5)) };

const facts = JSON.parse(fs.readFileSync("src/ask/data/facts.json", "utf8"));
const guide = fs.readFileSync("src/ask/data/guide.txt", "utf8");
const questions = fs.readFileSync("src/ask/data/questions.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((q) => q.split === split);

// Spend estimate before any call: the guide is in every LLM call.
const guideTokens = Math.round(guide.split(/\s+/).length * 1.4);
const estimate = questions.length * (guideTokens * PRICES.llmInPerMTok + 600 * PRICES.llmOutPerMTok) / 1e6 * 1.8;
console.log(`${questions.length} questions, guide about ${guideTokens} tokens, estimated cost $${estimate.toFixed(2)} (both paths)`);
if (estimate > 5) { console.error("Estimate is over the $5 cap. Stop."); process.exit(3); }

const rows = [];
const words = (s) => (s ? s.trim().split(/\s+/).length : 0);
for (const q of questions) {
  const a = await llmOnly(q.question, { llm, guide });
  rows.push({ id: q.id, intent: q.intent, variant: "llm_only", ...a, ok: !a.error && checkFacts(a.answer, q.expect), words: words(a.answer) });
  const b = await jevFirst(q.question, { jev, llm, guide, facts, thresholds });
  const intentOk = b.route && b.route.intent === q.intent;
  rows.push({ id: q.id, intent: q.intent, variant: "jev_first", ...b, ok: !b.error && checkFacts(b.answer, q.expect), words: words(b.answer), intentOk });
  console.log(`${q.id} ${q.intent.padEnd(15)} llm ${a.ms} ms ${rows.at(-2).ok ? "ok" : "MISS"} | jev ${b.path} ${b.ms} ms ${rows.at(-1).ok ? "ok" : "MISS"}${intentOk ? "" : ` (intent ${b.route && b.route.intent})`}`);
}

const summary = { split, thresholds, llmModel: LLM_MODEL, jevModel: "jev-1.13.0", prices: PRICES, ...summarize(rows, PRICES) };
console.log(JSON.stringify(summary, null, 2));
fs.mkdirSync("ask-results", { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
fs.writeFileSync(`ask-results/${split}-${stamp}.json`, JSON.stringify({ summary, rows }, null, 2));
console.log(`Results: ask-results/${split}-${stamp}.json`);
```

Add `/ask-results/` to `.gitignore`.

- [ ] **Step 6: Run on the tune split (needs both keys)**

```bash
LLM_IN_PER_MTOK=<from skill> LLM_OUT_PER_MTOK=<from skill> node scripts/ask-bench.mjs --split tune
```

Expected: 70 lines, then a summary. If the cost estimate is over $5, stop and report to the user.

- [ ] **Step 7: Tune the thresholds on the tune split only**

Read the misses in the result file. Try `--min-probability` 0.5, 0.6, 0.7, 0.8 on the tune split with Jev only (comment out the `llmOnly` call to save cost while you tune). Pick the value with the best fact accuracy for `jev_first`. Write the chosen value and the reason in the results doc (Task 6).

- [ ] **Step 8: Run the held-out split once**

```bash
LLM_IN_PER_MTOK=<from skill> LLM_OUT_PER_MTOK=<from skill> node scripts/ask-bench.mjs --split heldout --min-probability <chosen>
```

Expected: 30 lines and a summary. Do not change any threshold after this run.

- [ ] **Step 9: Commit**

```bash
git add src/ask/core/pipelines.js src/ask/core/metrics.js scripts/ask-clients.mjs scripts/ask-bench.mjs tests-node/pipelines.test.mjs .gitignore
git commit -m "Add the Jev-first and LLM-only pipelines and the A/B benchmark for attendee questions"
```

---

### Task 5: The demo page

**Files:**
- Create: `ask.html`
- Create: `src/ask/app.js`, `src/ask/app.css`
- Modify: `vite.config.js` (add `ask.html` as a second build input)
- Test: `tests/ask.spec.js`

**Interfaces:**
- Consumes: `/api/jev` (exists), `/api/llm` (prerequisite), Task 3 and Task 4 core modules, `src/ask/data/*`.
- Produces: `http://127.0.0.1:5173/ask.html`: one question box; two columns, "Jev first" and "LLM only", each with the answer, the latency, and the word count; the Jev column also shows the intent probabilities, the path (`SYSTEM 1` or `SYSTEM 2`), and the reason.

- [ ] **Step 1: Write the failing test**

Create `tests/ask.spec.js`:

```js
import { test, expect } from "@playwright/test";

test("the demo answers a price question in System 1 and shows the LLM-only answer beside it", async ({ page }) => {
  await page.route("**/api/jev", (route) => route.fulfill({ json: {
    model: "jev-1.13.0",
    answers: {
      intent: { type: "choice", choice: "price", probabilities: { price: 0.93, other: 0.07 }, confidence: 0.9 },
      answerable: { type: "noul", noul: 0.95 },
      ticket: { type: "choice", choice: "general_admission", probabilities: { general_admission: 0.8 }, confidence: 0.7 },
    },
    usage: { input_tokens: 900, output_tokens: 40 },
  } }));
  await page.route("**/api/llm", (route) => route.fulfill({ json: { text: "A General Admission ticket costs $350.", model: "llm-test", usage: { input_tokens: 12000, output_tokens: 20 }, ms: 1800 } }));
  await page.goto("/ask.html");
  await page.fill("#question", "How much is a ticket?");
  await page.click("#ask");
  await expect(page.locator("#jev-path")).toHaveText("SYSTEM 1");
  await expect(page.locator("#jev-answer")).toContainText("$350");
  await expect(page.locator("#llm-answer")).toContainText("$350");
  await expect(page.locator("#jev-bars li")).toHaveCount(2);
});
```

Run: `npx playwright test tests/ask.spec.js`
Expected: FAIL (`/ask.html` does not exist).

- [ ] **Step 2: Write the page**

Create `ask.html`:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ask RenderATL: System 1 and System 2</title>
<link rel="stylesheet" href="./styles.css">
<link rel="stylesheet" href="./src/ask/app.css">
</head>
<body>
  <main class="ask">
    <h1 class="disp">Ask RenderATL</h1>
    <form id="form" class="ask-form">
      <label for="question" class="mono">Your question</label>
      <input id="question" autocomplete="off" placeholder="How much is a ticket?">
      <button id="ask" class="btn-sm disp" type="submit">Ask</button>
    </form>
    <section class="ask-cols">
      <article class="ask-col">
        <h2 class="mono">Jev first <span id="jev-path" class="ask-path"></span></h2>
        <p id="jev-meta" class="mono"></p>
        <ul id="jev-bars" class="ask-bars"></ul>
        <p id="jev-why" class="mono"></p>
        <div id="jev-answer" class="ask-answer"></div>
      </article>
      <article class="ask-col">
        <h2 class="mono">LLM only</h2>
        <p id="llm-meta" class="mono"></p>
        <div id="llm-answer" class="ask-answer"></div>
      </article>
    </section>
  </main>
  <script type="module" src="./src/ask/app.js"></script>
</body>
</html>
```

Create `src/ask/app.js`:

```js
// The demo page. Both paths run in parallel, through the local server routes.
import facts from "./data/facts.json";
import guideText from "./data/guide.txt?raw";
import { llmOnly, jevFirst } from "./core/pipelines.js";

const $ = (id) => document.getElementById(id);
const words = (s) => (s ? s.trim().split(/\s+/).length : 0);

async function jev(body) {
  const res = await fetch("/api/jev", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Jev HTTP ${res.status}`);
  return res.json();
}
async function llm(body) {
  const res = await fetch("/api/llm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
  return res.json();
}

function showJev(r) {
  $("jev-path").textContent = r.path === "system1" ? "SYSTEM 1" : "SYSTEM 2";
  $("jev-path").dataset.path = r.path;
  $("jev-meta").textContent = `${r.ms} ms · ${words(r.answer)} words`;
  $("jev-why").textContent = r.route ? r.route.why : "";
  $("jev-answer").textContent = r.answer || r.error || "";
  const bars = $("jev-bars");
  bars.innerHTML = "";
  const probs = (r.jev && r.jev.intent && r.jev.intent.probabilities) || {};
  for (const [name, p] of Object.entries(probs).sort((a, b) => b[1] - a[1]).slice(0, 4)) {
    const li = document.createElement("li");
    li.textContent = `${name} ${Math.round(p * 100)}%`;
    li.style.setProperty("--p", String(p));
    bars.appendChild(li);
  }
}

function showLlm(r) {
  $("llm-meta").textContent = `${r.ms} ms · ${words(r.answer)} words`;
  $("llm-answer").textContent = r.answer || r.error || "";
}

$("form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const q = $("question").value.trim();
  if (!q) return;
  for (const id of ["jev-path", "jev-meta", "jev-why", "jev-answer", "llm-meta", "llm-answer"]) $(id).textContent = "…";
  $("jev-bars").innerHTML = "";
  const [a, b] = [jevFirst(q, { jev, llm, guide: guideText, facts }), llmOnly(q, { llm, guide: guideText })];
  a.then(showJev);
  b.then(showLlm);
});
```

Create `src/ask/app.css`:

```css
.ask{max-width:1100px;margin:32px auto;padding-inline:16px;display:flex;flex-direction:column;gap:20px}
.ask-form{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.ask-form input{flex:1 1 320px;min-width:0;font:inherit;font-size:18px;padding:10px;border:2px solid #2b292d;background:#fff7cf}
.ask-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px}
.ask-col{border:2px solid #2b292d;background:#fff7cf;box-shadow:6px 6px 0 #2b292d;padding:16px;min-width:0}
.ask-col h2{margin:0 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:.1em;color:#711b43}
.ask-path{margin-left:8px;padding:2px 6px;border:2px solid #2b292d;background:#ff88df;color:#2b292d}
.ask-path[data-path="system2"]{background:#015a55;color:#fcf9ee}
.ask-bars{list-style:none;margin:0 0 8px;padding:0;display:flex;flex-direction:column;gap:4px;font:12px/1.4 "JetBrains Mono",monospace}
.ask-bars li{background:linear-gradient(90deg,#ff88df calc(var(--p)*100%),#fcf9ee 0);border:1.5px solid #2b292d;padding:2px 6px}
.ask-answer{white-space:pre-wrap;font-size:16px;line-height:1.5}
```

In `vite.config.js`, inside `build.rollupOptions`, add:

```js
      input: { main: "index.html", ask: "ask.html" },
```

- [ ] **Step 3: Run the tests**

Run: `npx playwright test tests/ask.spec.js` then `npm test`
Expected: PASS; all tests PASS.

- [ ] **Step 4: Try it with the real services (needs both keys)**

Run `npm run dev`, open `http://127.0.0.1:5173/ask.html`, and ask: "How much is a ticket?", "We are 7 engineers, is there a deal?", "Help me convince my manager", "Is parking free?". Expected: the first two are `SYSTEM 1` in well under a second; the last two are `SYSTEM 2`.

- [ ] **Step 5: Commit**

```bash
git add ask.html src/ask/app.js src/ask/app.css vite.config.js tests/ask.spec.js
git commit -m "Add the Ask RenderATL demo page: Jev first beside LLM only"
```

---

### Task 6: Record the results and rebuild the talk around the pivot

**Files:**
- Create: `docs/research/ask-agent-ab.md`
- Modify: `docs/HANDOFF.md`
- Modify: `docs/presentation/jev-workshop.html`

- [ ] **Step 1: Write the results doc**

Create `docs/research/ask-agent-ab.md` with:
- The setup: models (Jev `jev-1.13.0`, the LLM ID), the guide snapshot date, 100 synthetic questions (70 tune, 30 held out), the thresholds and how they were chosen.
- The held-out table, one row for each path: fact accuracy, mean / p50 / p95 latency, cost for 1,000 questions, mean words, errors; for Jev first also intent accuracy and the System 2 share.
- A table for each intent: fact accuracy for each path.
- Every miss of the Jev-first path on the held-out split, with the question, the route, and the cause.
- Limits: synthetic questions, one guide snapshot, one LLM, list prices.

- [ ] **Step 2: Update the handoff**

In `docs/HANDOFF.md`, add a section "Ask Your Agent demo" with the commands (`npm run test:ask`, `node scripts/ask-bench.mjs`, `/ask.html`) and the held-out table.

- [ ] **Step 3: Rebuild the case-study part of the deck**

In `docs/presentation/jev-workshop.html`:
1. Add a slide after the "four tools" slide: "Assistance against automation" (the TypeSafe CEO's idea, `docs/research/jev-research.md` section 7d).
2. Replace the maze case slides (the screenshot slide and the results slide) with: one slide for the demo page (a screenshot of `ask.html` with a System 1 answer), and one slide with the held-out A/B table.
3. Move the maze to one slide titled "Hackathon: practice on a game", before the "Your turn" slide. Keep its seeded result line in the notes.
4. Update the final slide and the hackathon slide for the two tracks: the maze, and the attendee questions.
5. Run the overflow check from the earlier deck work (all slides, content above the bottom rail at 806 px), and publish.

- [ ] **Step 4: Commit**

```bash
git add docs/research/ask-agent-ab.md docs/HANDOFF.md docs/presentation/jev-workshop.html
git commit -m "Record the Ask Your Agent A/B results and rebuild the deck around the pivot"
```
