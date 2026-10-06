# System 1 → System 2: design

Date: 2026-10-06. Owner: William MJ Hill (@emjay_hill). Repository: `render-maze-jev`, branch `jev-player-workshop`.

## Goal

Show Kahneman's System 1 / System 2 split in working software, and measure it.

- **System 1 = Jev.** Fast, cheap, typed decisions. It answers the easy cases.
- **System 2 = an LLM (or a code planner in the game).** Slow, deliberate. It gets only the cases that System 1 sends up.
- **Escalation rule = code.** Code decides from Jev's answer and confidence when to call System 2.

Two parts, in this order:

1. **Part A, the pivot (the main example of the talk):** a RenderATL "Ask Your Agent" question demo. An A/B test compares **Jev first** (System 1, then System 2 when needed) with **LLM only**.
2. **Part B, the backup (the hackathon and the fallback demo):** RenderMaze with a System 2 step. When Jev is unsure or every direction is dangerous, code sends the decision to System 2.

The website integration is out of scope. We have no access to the renderatl.com code. Part A builds a local demo page and a benchmark.

## Why (from our research)

- The TypeSafe CEO talk: today's AI is good at assistance and poor at automation. Jev targets automation.
- The IBM video: Jev makes the fast calls, an LLM does the slow work.
- Our maze data: Jev follows clear written rules in about 96% of decisions, and its errors sit below confidence 0.7. That is the case for a confidence-based hand-off to System 2.
- Both deck reviews: the deck never shows Jev win. Part A measures a language task where a regex is weak and an LLM is the alternative.

## Part A: the "Ask Your Agent" demo

### Intents (fixed options for the Jev Choice)

| Intent | Example question | Path |
|---|---|---|
| `price` | "How much is a ticket?" | System 1: code template from `facts.json` |
| `dates_venue` | "When and where is RenderATL?" | System 1 |
| `group_discount` | "Is there a deal for 6 of us?" | System 1 |
| `included` | "Does the badge include the concert?" | System 1 |
| `tracks` | "Is there anything on observability?" | System 1 |
| `exec_summit` | "How do I get into the Executive Summit?" | System 1 |
| `ticket_choice` | "I lead a team of 12. Which ticket?" | System 1: Jev also picks the ticket; code writes the answer |
| `fit` | "Is RenderATL worth it for a junior designer?" | System 2 |
| `manager_email` | "Help me ask my manager to pay." | System 2 |
| `trip_plan` | "Plan my 3 days in Atlanta." | System 2 |
| `other` | Anything else | System 2 |

### Escalation rule (code)

Send to System 2 when any of these is true:
1. The intent is `fit`, `manager_email`, `trip_plan`, or `other`.
2. The probability of the chosen intent is below 0.7 (start value; tune on the labeled set).
3. The Noul `answerable_from_facts` is below 0.5.

### Facts

Code owns every price, date, and address. `facts.json` comes from the RenderATL 2027 guide (<https://www.renderatl.com/renderatl-guide>), fetched and checked by a person. System 1 answers come from templates over `facts.json`. Jev never writes a number.

### The A/B test

| Path | What happens |
|---|---|
| A: **LLM only** | The question plus the guide text go to the LLM. The LLM answers. |
| B: **Jev first** | Jev classifies. Code answers easy intents from templates. Code sends the rest to the same LLM, with Jev's intent as a hint. |

Metrics for each path, on the same labeled questions:
- **Fact accuracy:** every expected fact string (for example `$350`, `August 18-19, 2027`) appears in the answer.
- **Latency:** mean, p50, p95, end to end.
- **Cost:** dollars for 1,000 questions, from token counts and list prices.
- **Answer length:** words (the documented LLM verbosity point).
- **For B only:** the intent accuracy against the labels, and the share of questions sent to System 2.

### Data

- A labeled set of 100 questions, written for this test and marked synthetic. Real attendee questions replace or extend it when the user provides them.
- A held-out split: 30 of the 100 questions are not used to tune the threshold.

## Part B: System 2 in the maze

- Start from `level2d` (the best Jev variant: 20 of 30 on seeds 1000–1029).
- **First, the pending held-out test:** `questions`, `level2c`, `level2d`, `code-only` on new seeds 5000–5029.
- **Escalation rule (code):** escalate when the confidence of `move` is below 0.5, or when every direction is dangerous.
- **Two System 2 versions, measured separately:**
  1. `level2d-s2search`: a code planner looks ahead 8 steps and predicts the blockers.
  2. `level2d-s2llm`: an LLM gets an ASCII map of the maze and the options, and picks one direction. Code validates the answer.
- The panel and the log label System 2 decisions `SYSTEM 2`.
- Measure on seeds 5000–5029: wins, lives lost, escalation rate, System 2 latency, cost.

## Global constraints

- Keep the 24 Playwright tests green. The Jev player stays off by default.
- Keep `TYPESAFE_API_KEY` and `ANTHROPIC_API_KEY` in `.env` only. No key in browser code, logs, or results.
- Keep the game rules unchanged. Jev code goes in `src/jev/`.
- Label each decision that code made in place of Jev, including System 2 decisions.
- Write docs and comments in ASD-STE100 Simplified Technical English.
- Read the `claude-api` skill before any code that calls Claude. Confirm the model ID and the price there.
- Default System 2 model: `claude-sonnet-5-5`. Override with `LLM_MODEL` in `.env`.
- Spend cap for each benchmark run: $5. Stop and report if a run would exceed it.

## What needs the user

- `ANTHROPIC_API_KEY` in `.env` (System 2 and the LLM-only path).
- Approval of the spend cap, or a different one.
- Real attendee questions, if available.
- The sponsorship disclosure: any relationship between TypeSafe or IBM and RenderATL.
- A review of the 100 synthetic questions and their labels.

## Amendment 2026-10-06: run System 2 without an Anthropic API key

The user can run System 2 (and the LLM-only path) through headless Claude Code, which uses the user's own Claude login. Checked on 2026-10-06 with Claude Code 2.1.289:

```bash
claude -p "<prompt>" --model haiku --output-format json
```

- The JSON output has `result` (the text), `duration_ms` (model time), `total_cost_usd` (an estimate), `usage`, and `is_error`.
- One small request took 7.3 s wall time and 1.9 s model time. The program start adds about 5 s to each call.
- Without other flags, each call carries Claude Code's own system prompt. Use `--system-prompt "<text>"` to replace it, so that the token count reflects only our prompt.
- On a Claude subscription, the calls count against the plan's usage limits, not dollars. `total_cost_usd` is an estimate of the API price.

Changes to the plans when `LLM_BACKEND=claude-cli` is set in `.env`:

- **Plan A, `scripts/ask-clients.mjs`:** `llm()` runs the command below and maps `result` to `text`, `usage` to `usage`, and `total_cost_usd` to a new field `costUsd`. `summarize()` uses `costUsd` when it exists, in place of the price constants.

```js
import { spawnSync } from "node:child_process";
export function llmCli({ system, prompt }) {
  const r = spawnSync("claude", ["-p", "--model", process.env.LLM_MODEL || "sonnet", "--output-format", "json", "--system-prompt", system], { input: prompt, encoding: "utf8", maxBuffer: 20e6, timeout: 120000 });
  if (r.status !== 0) throw new Error(`claude -p failed: ${r.stderr.slice(0, 200)}`);
  const d = JSON.parse(r.stdout);
  if (d.is_error) throw new Error(`claude -p error: ${String(d.result).slice(0, 200)}`);
  return { text: d.result, usage: d.usage, model: process.env.LLM_MODEL || "sonnet", costUsd: d.total_cost_usd, modelMs: d.duration_ms };
}
```

- **Plan B, `/api/llm` in `src/jev/proxy.node.js`:** when `LLM_BACKEND=claude-cli`, call `llmCli()` (the same code, with `spawn` and a Promise so that the server does not block) in place of the SDK.
- **Latency:** report the model time (`duration_ms`) and the wall time separately. The 5 s program start is a cost of this setup, not of the model.
- **Fairness:** the LLM-only path and the System 2 path must use the same backend in one run.
