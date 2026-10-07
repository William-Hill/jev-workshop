# Maze System 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a System 2 step to the RenderMaze Jev player: when Jev is unsure or every direction is dangerous, code hands the decision to a slower System 2 (a code planner, or an LLM), and the benchmark measures the result on held-out seeds.

**Architecture:** The Jev player (`src/jev/player.js`) gets two optional variant hooks, `shouldEscalate()` and `system2()`. Two new variants extend `level2d`: one with a code look-ahead planner, one with an LLM call through a new server route `/api/llm` in the existing Vite proxy. Each System 2 decision is labeled `system2` in the log and `SYSTEM 2` on the panel.

**Tech Stack:** Phaser 3 game (unchanged), Vite 5 dev server with the proxy plugin `src/jev/proxy.node.js`, Playwright tests, `@anthropic-ai/sdk` in the Node proxy only.

**Spec:** `docs/superpowers/specs/2026-10-06-system1-system2-design.md` (Part B).

## Global Constraints

- Keep the 24 Playwright tests green (`npm test`). The Jev player stays off by default.
- Keep `TYPESAFE_API_KEY` and `ANTHROPIC_API_KEY` in `.env` only. No key in browser code, logs, or results.
- Keep the game rules unchanged: do not edit `src/main.js`. Jev code goes in `src/jev/`.
- Label each decision that code made in place of Jev. A System 2 decision has `source: "system2"` and a `reason`.
- Write docs and comments in ASD-STE100 Simplified Technical English.
- Read the `claude-api` skill before Task 4. Confirm the model ID and the price there.
- Default System 2 model: `claude-sonnet-5-5`; override with `LLM_MODEL` in `.env`.
- Spend cap for each benchmark run: $5.
- Benchmark seeds: tune on 1000–1029; report final numbers on the held-out seeds 5000–5029 only.

## Review Focus

- The LLM answers with text that is not a legal direction ("I would go north"). Expected: code rejects it, uses the Jev move, and labels the entry `FALLBACK` with the reason. Test in Task 4.
- `/api/llm` is called with no `ANTHROPIC_API_KEY`. Expected: HTTP 503 with a clear JSON error, and the game continues with the Jev move. Test in Task 4.
- A System 2 call takes longer than the game timeout. Expected: in wait mode the game stays stopped until the answer or the timeout, then it continues; it never freezes. Test in Task 2.
- Power mode is on when the escalation rule fires. Expected: no escalation for "all directions dangerous", because no direction is dangerous in power mode. Test in Task 2.
- The score code receives the new source `system2`. Expected: no `NaN` in the score; `system2` counts as a Jev-side decision. Test in Task 2.

---

### Task 1: Held-out baseline on new seeds

This is the pending check from the second deck review. It shows whether the 67% for `level2d` holds on seeds that no version was tuned on.

**Files:**
- Modify: `docs/research/question-design-finding.md` (add a section at the top)
- Modify: `docs/research/data/maze-benchmarks/` (copy the new summaries)

**Interfaces:**
- Consumes: `npm run bench -- --variant <name> --difficulty normal --games 30 --seed 5000`
- Produces: the held-out numbers that later tasks compare against.

- [ ] **Step 1: Run the four held-out benchmarks, one background task each**

```bash
for v in code-only questions level2c level2d; do
  npm run bench --silent -- --variant $v --difficulty normal --games 30 --seed 5000 \
    | grep -iE '"wins"|mean_lives_lost|input_tokens|error|Results'
done
```

Expected: four `Results:` lines. Each Jev run uses about 1 to 3.5 million input tokens (about $0.05 to $0.15). Run each variant as its own background task, because a full set can take more than 2 hours.

- [ ] **Step 2: Compute intervals and paired tests**

Run this script from the repository root (save it as `scripts/compare-seeds.mjs`, so later tasks can use it):

```js
// Compare variants that played the same seeds: wins, a 95% Wilson interval, and exact McNemar tests.
import fs from "node:fs";
const [base, ...variants] = process.argv.slice(2); // base seed, then variant names
const load = (v) => {
  const f = fs.readdirSync("bench-results").filter((x) => x.startsWith(v + "-normal-") && x.endsWith(".json")).sort()
    .map((x) => JSON.parse(fs.readFileSync("bench-results/" + x))).filter((r) => r.summary.seed_base === Number(base)).pop();
  if (!f) throw new Error(`No run of ${v} with seed ${base}`);
  return Object.fromEntries(f.games.map((g) => [g.seed, g]));
};
const wilson = (k, n) => { const z = 1.96, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [(c - m) / d, (c + m) / d].map((x) => Math.round(x * 100)); };
const choose = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; };
const R = Object.fromEntries(variants.map((v) => [v, load(v)]));
for (const v of variants) {
  const g = Object.values(R[v]); const k = g.filter((x) => x.result === "won").length;
  console.log(`${v.padEnd(20)} won ${k} of ${g.length}, 95% interval ${wilson(k, g.length).join("-")}%, lives lost ${(g.reduce((a, x) => a + 3 - x.lives, 0) / g.length).toFixed(2)}`);
}
for (let i = 0; i < variants.length; i++) for (let j = i + 1; j < variants.length; j++) {
  const a = variants[i], b = variants[j]; let ab = 0, ba = 0;
  for (const s of Object.keys(R[a])) { if (!R[b][s]) continue; const wa = R[a][s].result === "won", wb = R[b][s].result === "won"; if (wa && !wb) ab++; if (wb && !wa) ba++; }
  const m = ab + ba; let p = 0; for (let x = 0; x <= Math.min(ab, ba); x++) p += choose(m, x) * 0.5 ** m;
  console.log(`  ${a} vs ${b}: only ${a} won ${ab}, only ${b} won ${ba}, exact p ${m ? Math.min(1, 2 * p).toFixed(3) : "n/a"}`);
}
```

Run: `node scripts/compare-seeds.mjs 5000 code-only questions level2c level2d`
Expected: four result lines and six comparison lines.

- [ ] **Step 3: Record the result**

Add a section at the top of `docs/research/question-design-finding.md` titled `## Held-out seeds 5000–5029 (date)`, with the table from Step 2 and one sentence for each comparison. Copy the four summary files to `docs/research/data/maze-benchmarks/`.

- [ ] **Step 4: Commit**

```bash
git add scripts/compare-seeds.mjs docs/research/question-design-finding.md docs/research/data/maze-benchmarks
git commit -m "Measure code-only, the first question, level2c, and level2d on held-out seeds 5000-5029"
```

---

### Task 2: System 2 hooks in the player, the score, and the panel

**Files:**
- Modify: `src/jev/player.js` (function `decide`)
- Modify: `src/jev/score.js` (function `empty`, method `record`)
- Modify: `src/jev/panel.js` (`LABEL`), `src/jev/panel.css`
- Test: `tests/jev.spec.js`
- Create: `src/jev/variants/test-s2.js` (a variant that exists only for the tests)

**Interfaces:**
- Consumes: the variant module API from `src/jev/questions.js`.
- Produces: two optional variant exports that Tasks 3 and 4 use:
  - `shouldEscalate(answers, snapshot, result) -> { escalate: boolean, why: string }`
  - `async system2(snapshot, scene) -> { choice: string, reason: string, model?: string, usage?: object }`
  - A log entry with `source: "system2"`, `jev_choice`, `reason`, `system2: { ms, model, usage }`.

- [ ] **Step 1: Write the test variant**

Create `src/jev/variants/test-s2.js`:

```js
// Test only: escalate every Jev decision, and let System 2 pick the last legal option.
export * from "./level2d.js";

export function shouldEscalate() {
  return { escalate: true, why: "test: always escalate" };
}

export async function system2(snapshot) {
  const options = Object.keys(snapshot.options);
  return { choice: options[options.length - 1], reason: "test: last option", model: "test" };
}
```

- [ ] **Step 2: Write the failing tests**

Add to `tests/jev.spec.js`, before the JSONL download test:

```js
test("System 2: an escalated decision uses the System 2 choice and the SYSTEM 2 label", async ({ page }) => {
  await mockJev(page, (options) => options[0]);
  await bootJev(page, "&variant=test-s2");
  await enterPlaying(page);
  const entry = await firstDecision(page);
  expect(entry.source).toBe("system2");
  expect(entry.choice).toBe(entry.options[entry.options.length - 1]);
  expect(entry.jev_choice).toBe(entry.options[0]);
  expect(entry.reason).toContain("test: always escalate");
  await expect(page.locator('.jevpanel [data-jev="source"]')).toHaveText("SYSTEM 2");
  const s = await page.evaluate(() => window.__jev.score.summary());
  expect(Number.isNaN(s.points)).toBe(false);
  expect(s.decisions.system2).toBeGreaterThanOrEqual(1);
});

test("System 2: an illegal System 2 answer falls back to the Jev move", async ({ page }) => {
  await mockJev(page, (options) => options[0]);
  await bootJev(page, "&variant=test-s2");
  await page.evaluate(() => {
    // Replace the test System 2 with one that answers an illegal direction.
    window.__jev.overrideSystem2 = async () => ({ choice: "north", reason: "bad" });
  });
  await enterPlaying(page);
  const entry = await firstDecision(page);
  expect(entry.source).toBe("fallback");
  expect(entry.reason).toContain("System 2");
  expect(entry.choice).toBe(entry.options[0]);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx playwright test tests/jev.spec.js -g "System 2"`
Expected: both FAIL (the source is `jev`, and the panel shows `JEV`).

- [ ] **Step 4: Add the hook in `decide()`**

In `src/jev/player.js`, inside the `try` block of `decide()`, replace the lines from `const result = variant.combine(answers, snapshot);` to the end of the `if (result.reason || result.choice !== move.choice) { ... }` block with:

```js
      const result = variant.combine(answers, snapshot);
      if (!result || !options.includes(result.choice)) throw new Error(`combine() returned "${result && result.choice}", which is not legal`);
      entry.choice = result.choice;
      if (result.reason || result.choice !== move.choice) {
        // CODE DECISION: the attendee code changed the move of Jev.
        entry.source = "override";
        entry.reason = result.reason || "combine() changed the move";
      }

      // SYSTEM 2: code decides from the Jev answer whether a slower system takes the decision.
      const gate = variant.shouldEscalate ? variant.shouldEscalate(answers, snapshot, result) : { escalate: false };
      const system2 = jev.overrideSystem2 || variant.system2;
      if (gate.escalate && system2) {
        const s2Started = performance.now();
        let s2;
        try {
          s2 = await system2(snapshot, scene);
        } catch (err) {
          s2 = { choice: null, reason: String((err && err.message) || err) };
        }
        entry.system2 = { ms: Math.round(performance.now() - s2Started), model: s2.model || null, usage: s2.usage || null };
        if (options.includes(s2.choice)) {
          entry.source = "system2";
          entry.choice = s2.choice;
          entry.reason = `${gate.why}; ${s2.reason}`;
        } else {
          // CODE DECISION: System 2 failed, so code keeps the Jev move.
          entry.source = "fallback";
          entry.reason = `System 2 answer "${s2.choice}" is not legal (${s2.reason}); kept the Jev move`;
        }
      }
```

The existing `catch` and the code after it stay the same. Note: `entry.choice` keeps the Jev move when System 2 fails, because it was set before the System 2 call.

- [ ] **Step 5: Count the new source in the score**

In `src/jev/score.js`, change `empty()` and `record()`:

```js
function empty() {
  return {
    decisions: { jev: 0, override: 0, system2: 0, fallback: 0, code: 0 },
    collected: { jev: 0, fallback: 0 },
    lives_lost: { jev: 0, fallback: 0 },
  };
}
```

```js
    record(source) {
      stats.decisions[source] = (stats.decisions[source] || 0) + 1;
      if (source === "jev" || source === "override" || source === "system2") owner = "jev";
      else if (source === "fallback") owner = "fallback";
    },
```

In `summary()`, change `const asked = d.jev + d.override + d.fallback;` to `const asked = d.jev + d.override + d.system2 + d.fallback;` and change the share to `(d.jev + d.override + d.system2) / asked`.

- [ ] **Step 6: Add the panel label**

In `src/jev/panel.js`, change `LABEL` to:

```js
const LABEL = { jev: "JEV", override: "OVERRIDE", system2: "SYSTEM 2", fallback: "FALLBACK", code: "CODE" };
```

In `src/jev/panel.css`, add:

```css
.jevpanel[data-source="system2"] .jev-source{background:#015a55;color:#fcf9ee}
.jev-log li[data-source="system2"]{color:#015a55;font-weight:700}
```

- [ ] **Step 7: Run the tests**

Run: `npx playwright test tests/jev.spec.js -g "System 2"` then `npm test`
Expected: the 2 new tests PASS; all 26 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/jev/player.js src/jev/score.js src/jev/panel.js src/jev/panel.css src/jev/variants/test-s2.js tests/jev.spec.js
git commit -m "Add System 2 hooks to the Jev player, with a SYSTEM 2 label and score support"
```

---

### Task 3: System 2 as a code planner (`level2d-s2search`)

**Files:**
- Create: `src/jev/system2/search.js`
- Create: `src/jev/variants/level2d-s2search.js`
- Create: `src/jev/variants/escalate.js` (the shared escalation rule)
- Test: `tests/jev.spec.js`

**Interfaces:**
- Consumes: Task 2 hooks; `DIRS`, `OPPOSITE` from `src/jev/snapshot.js`; the scene API (`scene.tiles`, `scene.canMove`, `scene.enemies`, `scene.player`).
- Produces: `planMove(scene, tile, options, horizon) -> { choice, reason, scores }`; `shouldEscalate` in `escalate.js`, used by Task 4 too.

- [ ] **Step 1: Write the shared escalation rule**

Create `src/jev/variants/escalate.js`:

```js
// The escalation rule for the maze: code decides when System 2 takes the decision.
// 1. Jev is unsure: the confidence of "move" is below LOW_CONFIDENCE.
// 2. Every direction is dangerous (power mode off), so a mistake costs a life.
export const LOW_CONFIDENCE = 0.5;

function dangerous(option, snapshot) {
  if (snapshot.power_seconds_left > 0 || option.steps_to_blocker === null) return false;
  if (option.steps_to_blocker <= 3) return true;
  return option.blocker_approaching && option.steps_to_blocker <= 6;
}

export function shouldEscalate(answers, snapshot) {
  const names = Object.keys(snapshot.options);
  if (names.length < 2) return { escalate: false, why: "" };
  if (answers.move.confidence < LOW_CONFIDENCE) return { escalate: true, why: `Jev confidence ${answers.move.confidence} is below ${LOW_CONFIDENCE}` };
  if (names.every((n) => dangerous(snapshot.options[n], snapshot))) return { escalate: true, why: "every direction is dangerous" };
  return { escalate: false, why: "" };
}
```

- [ ] **Step 2: Write the planner**

Create `src/jev/system2/search.js`:

```js
// System 2 as deliberate search: for each option, simulate the runner and the blockers
// for a few steps, and score how long the runner survives and how soon it collects.
// Blockers that chase move one tile toward the runner each step; other blockers keep
// their heading when they can. This is a prediction, not the game code.
import { DIRS } from "../snapshot.js";

const key = (t) => t.row + "," + t.col;

function stepToward(scene, from, target) {
  let best = null;
  for (const d of Object.values(DIRS)) {
    if (!scene.canMove(from.row, from.col, d)) continue;
    const n = { row: from.row + d.row, col: from.col + d.col };
    const dist = Math.abs(n.row - target.row) + Math.abs(n.col - target.col);
    if (!best || dist < best.dist) best = { n, dist };
  }
  return best ? best.n : from;
}

function stepAhead(scene, b) {
  if (b.dir && scene.canMove(b.row, b.col, b.dir)) return { row: b.row + b.dir.row, col: b.col + b.dir.col, dir: b.dir };
  for (const d of Object.values(DIRS)) if (scene.canMove(b.row, b.col, d)) return { row: b.row + d.row, col: b.col + d.col, dir: d };
  return b;
}

export function planMove(scene, tile, options, horizon = 8) {
  const now = scene.time.now;
  const blockers0 = scene.enemies.filter((e) => !(e.eatenUntil > now)).map((e) => ({ row: e.row, col: e.col, dir: e.dir, chase: e.strategy === "chase" }));
  const powered = scene.powerUntil > now;
  const scores = {};
  for (const name of options) {
    let runner = { row: tile.row + DIRS[name].row, col: tile.col + DIRS[name].col };
    let heading = DIRS[name];
    let blockers = blockers0.map((b) => ({ ...b }));
    let survived = 0, collected = 0;
    const eaten = new Set();
    for (let s = 1; s <= horizon; s++) {
      blockers = blockers.map((b) => (b.chase ? { ...stepToward(scene, b, runner), chase: true } : { ...stepAhead(scene, b), chase: false }));
      if (!powered && blockers.some((b) => b.row === runner.row && b.col === runner.col)) break;
      survived = s;
      const ch = scene.tiles[runner.row][runner.col];
      if ((ch === "." || ch === "o") && !eaten.has(key(runner))) { collected++; eaten.add(key(runner)); }
      // The runner keeps its heading; at a wall it turns to the first open direction that is not a reverse.
      if (!scene.canMove(runner.row, runner.col, heading)) {
        heading = Object.values(DIRS).find((d) => scene.canMove(runner.row, runner.col, d) && !(d.row === -heading.row && d.col === -heading.col)) || heading;
      }
      if (scene.canMove(runner.row, runner.col, heading)) runner = { row: runner.row + heading.row, col: runner.col + heading.col };
    }
    scores[name] = survived * 10 + collected;
  }
  const choice = options.slice().sort((a, b) => scores[b] - scores[a])[0];
  return { choice, reason: `look-ahead ${horizon} steps: ${options.map((o) => `${o} ${scores[o]}`).join(", ")}`, scores };
}
```

- [ ] **Step 3: Write the variant**

Create `src/jev/variants/level2d-s2search.js`:

```js
// level2d with System 2 as a code planner. When the escalation rule fires, code looks
// ahead 8 steps for each option and picks the safest one.
// Load it with /?jev=1&variant=level2d-s2search
export * from "./level2d.js";
export { shouldEscalate } from "./escalate.js";
import { planMove } from "../system2/search.js";

export async function system2(snapshot, scene) {
  const r = planMove(scene, snapshot.tile, Object.keys(snapshot.options), 8);
  return { choice: r.choice, reason: r.reason, model: "code look-ahead" };
}
```

- [ ] **Step 4: Write the test**

Add to `tests/jev.spec.js`:

```js
test("System 2 search: a low-confidence Jev answer goes to the code planner", async ({ page }) => {
  await page.route("**/api/jev", async (route) => {
    const body = route.request().postDataJSON();
    const options = Object.keys(body.questions.move.criteria);
    const probabilities = Object.fromEntries(options.map((n) => [n, 1 / options.length]));
    await route.fulfill({ json: { model: "jev-test", answers: { move: { type: "choice", choice: options[0], confidence: 0.3, probabilities } }, usage: { input_tokens: 1, output_tokens: 1 } } });
  });
  await bootJev(page, "&variant=level2d-s2search");
  await enterPlaying(page);
  const entry = await firstDecision(page);
  expect(entry.source).toBe("system2");
  expect(entry.reason).toContain("look-ahead 8 steps");
  expect(entry.options).toContain(entry.choice);
});
```

- [ ] **Step 5: Run the tests**

Run: `npx playwright test tests/jev.spec.js -g "System 2"` then `npm test`
Expected: all PASS.

- [ ] **Step 6: Tune on seeds 1000–1029, then measure on 5000–5029**

```bash
npm run bench --silent -- --variant level2d-s2search --difficulty normal --games 30 --seed 1000
npm run bench --silent -- --variant level2d-s2search --difficulty normal --games 30 --seed 5000
node scripts/compare-seeds.mjs 5000 code-only level2d level2d-s2search
```

Expected: results for both seed sets. Only change `LOW_CONFIDENCE` or the horizon after the seed-1000 run; never after the seed-5000 run.

- [ ] **Step 7: Commit**

```bash
git add src/jev/system2/search.js src/jev/variants/escalate.js src/jev/variants/level2d-s2search.js tests/jev.spec.js
git commit -m "Add level2d-s2search: a code look-ahead planner as System 2"
```

---

### Task 4: System 2 as an LLM (`level2d-s2llm`) and the `/api/llm` route

**Files:**
- Modify: `src/jev/proxy.node.js` (add the `/api/llm` route)
- Modify: `package.json` (add `@anthropic-ai/sdk`)
- Modify: `.env.example` (document `ANTHROPIC_API_KEY`, `LLM_MODEL`)
- Create: `src/jev/system2/llm.js`
- Create: `src/jev/variants/level2d-s2llm.js`
- Test: `tests/jev.spec.js`

**Interfaces:**
- Consumes: Task 2 hooks; `shouldEscalate` from `src/jev/variants/escalate.js`.
- Produces: `POST /api/llm` with body `{ system: string, prompt: string, max_tokens: number }` → `{ text, model, usage: { input_tokens, output_tokens }, ms }`, or HTTP 503 `{ error }` when the key is missing. Plan A Task 4 reuses this route.

- [ ] **Step 1: Read the `claude-api` skill**

Invoke the skill. Confirm: the model ID `claude-sonnet-5-5` (or the current recommended one), the SDK call shape, and the input and output prices for each million tokens. Write the prices into the constant in Step 4.

- [ ] **Step 2: Install the SDK**

Run: `npm install @anthropic-ai/sdk`
Expected: `package.json` lists `@anthropic-ai/sdk` in `dependencies`.

- [ ] **Step 3: Write the failing tests**

Add to `tests/jev.spec.js`:

```js
test("System 2 LLM: the LLM direction is used and labeled SYSTEM 2", async ({ page }) => {
  await page.route("**/api/jev", async (route) => {
    const body = route.request().postDataJSON();
    const options = Object.keys(body.questions.move.criteria);
    const probabilities = Object.fromEntries(options.map((n) => [n, 1 / options.length]));
    await route.fulfill({ json: { model: "jev-test", answers: { move: { type: "choice", choice: options[0], confidence: 0.2, probabilities } }, usage: { input_tokens: 1, output_tokens: 1 } } });
  });
  await page.route("**/api/llm", async (route) => {
    const { prompt } = route.request().postDataJSON();
    const legal = prompt.match(/Legal moves: ([a-z, ]+)/)[1].split(", ");
    await route.fulfill({ json: { text: legal[legal.length - 1], model: "llm-test", usage: { input_tokens: 10, output_tokens: 1 }, ms: 5 } });
  });
  await bootJev(page, "&variant=level2d-s2llm");
  await enterPlaying(page);
  const entry = await firstDecision(page);
  expect(entry.source).toBe("system2");
  expect(entry.choice).toBe(entry.options[entry.options.length - 1]);
  expect(entry.system2.model).toBe("llm-test");
});

test("System 2 LLM: a missing key (503) keeps the Jev move and labels FALLBACK", async ({ page }) => {
  await page.route("**/api/jev", async (route) => {
    const body = route.request().postDataJSON();
    const options = Object.keys(body.questions.move.criteria);
    const probabilities = Object.fromEntries(options.map((n) => [n, 1 / options.length]));
    await route.fulfill({ json: { model: "jev-test", answers: { move: { type: "choice", choice: options[0], confidence: 0.2, probabilities } }, usage: { input_tokens: 1, output_tokens: 1 } } });
  });
  await page.route("**/api/llm", (route) => route.fulfill({ status: 503, json: { error: "ANTHROPIC_API_KEY is not set in .env." } }));
  await bootJev(page, "&variant=level2d-s2llm");
  await enterPlaying(page);
  const entry = await firstDecision(page);
  expect(entry.source).toBe("fallback");
  expect(entry.reason).toContain("System 2");
  expect(entry.choice).toBe(entry.options[0]);
});
```

Run: `npx playwright test tests/jev.spec.js -g "System 2 LLM"`
Expected: FAIL ("The variant "level2d-s2llm" does not exist").

- [ ] **Step 4: Add the `/api/llm` route to the proxy**

In `src/jev/proxy.node.js`, add at the top:

```js
import Anthropic from "@anthropic-ai/sdk";

const LLM_ROUTE = "/api/llm";
const LLM_TIMEOUT_MS = 30000;
```

Inside `jevProxy()`, after `let model = "";`, add:

```js
  let anthropicKey = "";
  let llmModel = "claude-sonnet-5-5";

  // POST /api/llm { system, prompt, max_tokens } -> { text, model, usage, ms }
  async function llmHandler(req, res) {
    if (req.method !== "POST") return send(res, 405, { error: "Use POST." });
    if (!anthropicKey) return send(res, 503, { error: "ANTHROPIC_API_KEY is not set in .env." });
    try {
      const body = JSON.parse((await readBody(req)).toString("utf8"));
      const client = new Anthropic({ apiKey: anthropicKey, timeout: LLM_TIMEOUT_MS });
      const started = Date.now();
      const msg = await client.messages.create({
        model: llmModel,
        max_tokens: Math.min(Number(body.max_tokens) || 300, 2000),
        system: String(body.system || ""),
        messages: [{ role: "user", content: String(body.prompt || "") }],
      });
      const text = msg.content.filter((c) => c.type === "text").map((c) => c.text).join("");
      send(res, 200, { text, model: msg.model, usage: msg.usage, ms: Date.now() - started });
    } catch (err) {
      send(res, 502, { error: String(err.message || err) });
    }
  }
```

In the `config()` hook, change the `loadEnv` prefixes to `["TYPESAFE_", "JEV_", "ANTHROPIC_", "LLM_"]` and add:

```js
      anthropicKey = env.ANTHROPIC_API_KEY || "";
      llmModel = env.LLM_MODEL || llmModel;
```

In `configureServer` and `configurePreviewServer`, add `server.middlewares.use(LLM_ROUTE, llmHandler);` after the existing line.

In `.env.example`, add:

```text
# Optional: System 2 and the LLM-only path. The key stays on the server.
# ANTHROPIC_API_KEY=
# LLM_MODEL=claude-sonnet-5-5
```

- [ ] **Step 5: Write the browser client**

Create `src/jev/system2/llm.js`:

```js
// System 2 as an LLM. The browser calls /api/llm on the local server; the key stays there.
// The LLM gets an ASCII map and the legal moves, and must answer with one word.
// Code validates the answer in player.js; an illegal answer keeps the Jev move.

function asciiMap(scene, tile) {
  const now = scene.time.now;
  const rows = scene.tiles.map((r) => r.map((c) => (c === "#" ? "#" : c === "." ? "." : c === "o" ? "o" : " ")));
  scene.enemies.filter((e) => !(e.eatenUntil > now)).forEach((e) => { rows[e.row][e.col] = e.strategy === "chase" ? "C" : e.strategy === "patrol" ? "P" : "W"; });
  rows[tile.row][tile.col] = "R";
  return rows.map((r) => r.join("")).join("\n");
}

export async function askLlm(snapshot, scene) {
  const legal = Object.keys(snapshot.options);
  const facts = legal.map((n) => {
    const o = snapshot.options[n];
    return `${n}: nearest blocker ${o.steps_to_blocker ?? "none"} steps${o.blocker_approaching ? " (approaching)" : ""}, nearest collectible ${o.steps_to_collectible ?? "none"} steps`;
  }).join("\n");
  const prompt = [
    "Maze, row 0 at the top. # wall, . collectible, o power pellet, R runner, C blocker that chases, P blocker that patrols, W blocker that wanders.",
    asciiMap(scene, snapshot.tile),
    `Power mode seconds left: ${snapshot.power_seconds_left}. Lives: ${snapshot.lives}. Collectibles left: ${snapshot.collectibles_left}.`,
    "Facts for each legal move:",
    facts,
    `Legal moves: ${legal.join(", ")}`,
    "Keep the runner alive first, then collect. Answer with exactly one word from the legal moves.",
  ].join("\n");
  const res = await fetch("/api/llm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system: "You control a runner in a maze game. Answer with one word.", prompt, max_tokens: 5 }),
  });
  if (!res.ok) throw new Error(`System 2 LLM failed: HTTP ${res.status}`);
  const data = await res.json();
  const word = String(data.text || "").trim().toLowerCase().replace(/[^a-z]/g, "");
  return { choice: word, reason: `LLM picked "${word}"`, model: data.model, usage: data.usage };
}
```

- [ ] **Step 6: Write the variant**

Create `src/jev/variants/level2d-s2llm.js`:

```js
// level2d with System 2 as an LLM. When the escalation rule fires, an LLM gets a map
// of the maze and picks the move. Needs ANTHROPIC_API_KEY in .env.
// Load it with /?jev=1&variant=level2d-s2llm&timeout=30000
export * from "./level2d.js";
export { shouldEscalate } from "./escalate.js";
import { askLlm } from "../system2/llm.js";

export async function system2(snapshot, scene) {
  return askLlm(snapshot, scene);
}
```

Note: in `src/jev/player.js` the `askJev` timeout applies only to the Jev request; the System 2 call has no browser timeout, and the proxy limits it to 30 seconds. In wait mode the game stays stopped during the call.

- [ ] **Step 7: Run the tests**

Run: `npx playwright test tests/jev.spec.js -g "System 2"` then `npm test`
Expected: all PASS (30 tests).

- [ ] **Step 8: Measure (needs `ANTHROPIC_API_KEY`)**

Check the spend: an escalation rate of about 20% gives about 20 LLM calls a game, each about 1,200 input tokens. Estimate the cost with the prices from Step 1 before the run; stop if it is over $5.

```bash
npm run bench --silent -- --variant level2d-s2llm --difficulty normal --games 30 --seed 5000
node scripts/compare-seeds.mjs 5000 code-only level2d level2d-s2search level2d-s2llm
```

Expected: a result table with the escalation counts (`decisions.system2` in each game summary) and the System 2 latency (`system2.ms` in the log).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json .env.example src/jev/proxy.node.js src/jev/system2/llm.js src/jev/variants/level2d-s2llm.js tests/jev.spec.js
git commit -m "Add level2d-s2llm and the /api/llm route: an LLM as System 2"
```

---

### Task 5: Record the results and update the backup slides

**Files:**
- Modify: `docs/research/question-design-finding.md`, `docs/HANDOFF.md`
- Modify: `docs/presentation/jev-workshop.html` (the maze slides only; the deck source of truth is this file)

- [ ] **Step 1: Add a results section**

In `docs/research/question-design-finding.md`, add `## System 2 in the maze (date)` with the table from Task 4 Step 8: wins on seeds 5000–5029, lives lost, the escalation share (`decisions.system2` ÷ Jev decisions), the median System 2 latency, and the cost of each run. State which System 2 (code planner or LLM) did better, with the paired p-values.

- [ ] **Step 2: Update the handoff**

In `docs/HANDOFF.md`, add the two new variants to the "Run it" table and the results to the benchmark section.

- [ ] **Step 3: Update the maze slides**

In the deck, add a row for each System 2 variant to the maze results table, and one speaker-note paragraph: the escalation rule, the escalation share, and the latency of each System 2.

- [ ] **Step 4: Commit**

```bash
git add docs/research/question-design-finding.md docs/HANDOFF.md docs/presentation/jev-workshop.html docs/research/data/maze-benchmarks
git commit -m "Record the System 2 maze results"
```
