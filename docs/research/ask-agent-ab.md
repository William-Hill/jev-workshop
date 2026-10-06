# Ask Your Agent: Jev first against LLM only

Date: 2026-10-06. Results file: `ask-results/heldout-ab-2026-10-06T21-54-54-675Z.json` (not committed).

## The result in one paragraph

On 30 held-out attendee questions, the two paths had the same fact accuracy. 19 questions had a fact check, and each path passed 17 of 19. The other 11 had no expected facts, so the benchmark did not check them. The Jev-first path sent 19 of 30 questions to System 1. Those answers came back in a median of 194 ms, against a median of 5,322 ms for the LLM. The Jev-first path cost less: 2.6 to 10 times less for each 1,000 questions, depending on 3 unusually large LLM calls (see the cost note). Its answers were about one third shorter. It made one real fact error that the LLM did not make (q098, a ticket pick).

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

| Path | Facts right (all 30 / checked 19) | Mean ms | p50 ms | p95 ms | Cost / 1,000 questions | Mean words | Errors |
|---|---|---|---|---|---|---|---|
| LLM only | 28/30 / 17/19 | 5,952 | 5,322 | 13,071 | $86.47 | 149 | 0 |
| Jev first | 28/30 / 17/19 | 2,831 | 237 | 9,882 | $8.74 | 98 | 0 |

Jev first, more detail:

- Intent accuracy: 100% (30/30).
- System 2 share: 36.7% (11/30). The ideal share is 33.3% (the 10 questions with a writing or judgment intent). One fact question went to System 2: q045 (`tracks`, intent probability 0.51, below 0.7). The LLM answered it correctly.
- Ticket accuracy: 75% (3/4 ticket questions).
- System 1 latency: median 194 ms, maximum 339 ms (19 answers). This includes the Jev request and the template.
- The p95 of the Jev-first path is the LLM latency of its System 2 questions.
- Jev request size: about 1,360 input tokens (the question plus the facts).

**Cost note (corrected after the final review).** The LLM cost is the `total_cost_usd` that Claude Code reports, at API list prices. The Jev cost is the token count at $0.042 for each 1M input tokens. The 41 LLM calls in the run cost $2.855 in total at list price.

- Most LLM calls read the guide prompt from the cache and wrote only a few hundred tokens. The median LLM call cost $0.0138 (LLM only) and $0.0175 (Jev first, System 2 calls).
- Three LLM-only calls wrote 114,204, 184,330, and 208,953 tokens to the cache (q037, q086, q087). They cost $0.458, $0.739, and $0.837: $2.03 of the $2.59 LLM-only total.
- Some other calls read about 111,000 tokens from the cache. That is 5 times the guide. We do not know where the extra tokens come from. The headless Claude Code call probably adds context of its own. We did not find the cause.
- Without the three large calls (27 questions): LLM only $20.71 and Jev first $8.05 for each 1,000 questions, a ratio of 2.6. With them: $86.47 and $8.74, a ratio of 10. Report the range, not one number.
- The run always called the LLM-only path first for each question, so that path paid more cache writes. The benchmark now picks the order at random for each question.

## Fact accuracy by intent

Rows with "—" have no expected facts, so the benchmark did not check them.

| Intent | n | LLM only | Jev first | Jev-first path |
|---|---|---|---|---|
| price | 5 | 5 | 5 | System 1 |
| dates_venue | 3 | 3 | 3 | System 1 |
| group_discount | 2 | 2 | 2 | System 1 |
| included | 2 | — | — | System 1 |
| tracks | 2 | 2 | 2 | System 1 (q045: System 2) |
| exec_summit | 2 | 1 | 2 | System 1 |
| ticket_choice | 4 (1 unchecked) | 3/3 | 2/3 | System 1 |
| fit | 3 | — | — | System 2 |
| manager_email | 2 | — | — | System 2 |
| trip_plan | 2 | 1 | 1 | System 2 |
| other | 3 | — | — | System 2 |

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

## What protects the route

The final review found that the `answerable` Noul does little at the 0.2 floor. On the tune split, writing intents got `answerable` values up to 0.41, and fact intents went as low as 0.21. So the intent Choice and its probability decide almost every route. "Is parking free?" (q079) went to System 2 because Jev picked `other`, not because `answerable` was low.

Two changes after the review reduce the risk:

- The thresholds 0.7 and 0.2 are now the code defaults (`ROUTE_THRESHOLDS` in `src/ask/core/system1.js`). Before, the demo page used 0.5 for `answerable`, so it was a different system from the one measured here.
- An `included` question about an item that is not in the facts ("is parking included?") now goes to System 2. Before, the template listed every item.

Not tested: a question that mixes a fact and a writing request ("How much is Gold, and can you draft the email to my boss?"). If Jev picks `price` for it, System 1 answers the price and drops the email. The question set has no such question.

## Limits

- The questions are synthetic. Real attendee questions are probably more varied.
- One guide snapshot (2026-10-06). The facts change before the event.
- One LLM, through one backend. The run did not record the full model ID.
- 30 held-out questions, 19 with a fact check. One question is 3.3 points of accuracy, so small differences are noise.
- The held-out run came before the review fixes. It used the same thresholds (0.7 and 0.2) by command-line flags. The `included` change did not affect it: no held-out `included` question lacked an item match.
- Costs are list prices. The LLM cost depends strongly on the prompt cache.
- One run. The LLM output is not deterministic.
