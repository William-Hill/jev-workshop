# Ask Your Agent: Jev first against LLM only

Date: 2026-10-06. Results file: `ask-results/heldout-ab-2026-10-06T21-54-54-675Z.json` (not committed).

## The result in one paragraph

On 30 held-out attendee questions, the two paths had the same fact accuracy: 28 of 30 (93.3%). The Jev-first path sent 19 of 30 questions to System 1. Those answers came back in a median of 194 ms, against a median of 5,322 ms for the LLM. The Jev-first path cost about one tenth as much for each 1,000 questions. Its answers were about one third shorter. It made one real fact error that the LLM did not make (q098, a ticket pick).

## Setup

| Item | Value |
|---|---|
| System 1 | Jev `jev-1.13.0`, through `POST https://api.typesafe.ai/v1/systemone` |
| System 2 | Claude Code headless (`claude -p --model sonnet`, no tools, no settings). The run recorded the alias `sonnet`, not the full model ID. |
| Guide | `src/ask/data/guide.txt`, the RenderATL guide fetched 2026-10-06 (6,516 words) |
| Facts | `src/ask/data/facts.json`, each value checked against the guide by `tests-node/facts.test.mjs` |
| Questions | 100 synthetic questions, 11 intents: 70 tune, 30 held out (`src/ask/data/questions.jsonl`) |
| Route rule | System 1 if the intent is a fact intent, `intent` probability ≥ 0.7, and the `answerable` Noul ≥ 0.2. Otherwise System 2. |
| Command | `node scripts/ask-bench.mjs --split heldout --min-probability 0.7 --min-answerable 0.2` |

**How the thresholds were chosen.** A Jev-only pass on the 70 tune questions gave the answers. An offline sweep then picked the pair with 0 wrong System 1 answers and the lowest System 2 share: 41 right System 1 answers, System 2 share 0.41 (the ideal share is 0.37). Any lower `minProbability` added a wrong System 1 answer. The held-out split was run once, after the choice.

## Held-out results (30 questions)

| Path | Fact accuracy | Mean ms | p50 ms | p95 ms | Cost / 1,000 questions | Mean words | Errors |
|---|---|---|---|---|---|---|---|
| LLM only | 93.3% (28/30) | 5,952 | 5,322 | 13,071 | $86.47 | 149 | 0 |
| Jev first | 93.3% (28/30) | 2,831 | 237 | 9,882 | $8.74 | 98 | 0 |

Jev first, more detail:

- Intent accuracy: 100% (30/30).
- System 2 share: 36.7% (11/30). The ideal share is 33.3% (the 10 questions with a writing or judgment intent). One fact question went to System 2: q045 (`tracks`, intent probability 0.51, below 0.7). The LLM answered it correctly.
- Ticket accuracy: 75% (3/4 ticket questions).
- System 1 latency: median 194 ms, maximum 339 ms (19 answers). This includes the Jev request and the template.
- The p95 of the Jev-first path is the LLM latency of its System 2 questions.
- Jev request size: about 1,360 input tokens (the question plus the facts).

**Cost note.** The LLM cost is the `total_cost_usd` that Claude Code reports, at API list prices. Each LLM call wrote the 22,130-token guide prompt to the cache, and the cache write dominates the cost. A run with a warm cache costs less. The Jev cost is the token count at $0.042 for each 1M input tokens. The 41 LLM calls in the run cost $2.855 in total at list price.

## Fact accuracy by intent

| Intent | n | LLM only | Jev first | Jev-first path |
|---|---|---|---|---|
| price | 5 | 5 | 5 | System 1 |
| dates_venue | 3 | 3 | 3 | System 1 |
| group_discount | 2 | 2 | 2 | System 1 |
| included | 2 | 2 | 2 | System 1 |
| tracks | 2 | 2 | 2 | System 1 (q045: System 2) |
| exec_summit | 2 | 1 | 2 | System 1 |
| ticket_choice | 4 | 4 | 3 | System 1 |
| fit | 3 | 3 | 3 | System 2 |
| manager_email | 2 | 2 | 2 | System 2 |
| trip_plan | 2 | 1 | 1 | System 2 |
| other | 3 | 3 | 3 | System 2 |

## Every miss

| Question | Path | Route | Cause |
|---|---|---|---|
| q098 "director of eng who wants networking with execs, which ticket" | Jev first | System 1, `ticket_choice` at p = 1 | **Real error.** Jev picked General Admission plus an application to the Executive Summit. The label is Gold ($800, adds the Leaders Lounge). Both readings are defensible, but the answer does not match the label. |
| q078 "itinerary for renderatl from new york" | Jev first | System 2, `trip_plan` | **Checker miss.** The LLM wrote "Wednesday, August 18 to Thursday, August 19, 2027". The dates are right. The check needs the exact string "August 18 to 19, 2027". |
| q078 (same) | LLM only | — | **Checker miss**, same cause. |
| q051 "can my CTO go to the exec summit, how" | LLM only | — | **Checker miss.** The LLM wrote "complimentary only if they're approved". The check needs "complimentary if approved". |

So the count of real fact errors is 1 for Jev first and 0 for LLM only. The string check is strict on purpose, and it counts the same way for both paths.

## What this shows, and what it does not show

- On fact questions with a fixed answer, Jev picks the intent and code writes the answer. That is fast and cheap, and the answer comes only from the checked facts.
- The cost of that path is rigid wording. A template cannot adapt to an unusual question, and one wrong ticket pick at p = 1 went out with no check. A probability of 1 is not proof of a correct answer.
- The LLM was as accurate on these facts, because the full guide was in its prompt. The difference is speed, cost, and length, not accuracy.

## Limits

- The questions are synthetic. Real attendee questions are probably more varied.
- One guide snapshot (2026-10-06). The facts change before the event.
- One LLM, through one backend. The run did not record the full model ID.
- 30 held-out questions. One question is 3.3 points of accuracy, so small differences are noise.
- Costs are list prices. The LLM cost depends strongly on the prompt cache.
- One run. The LLM output is not deterministic.
