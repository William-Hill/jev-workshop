# Decision Desk and PTSO: Jev results (2026-10-07)

This file collects the results of the Decision Desk (RenderATL sales triage) and the PTSO pre-filter experiments for the Jev Workshop deck. The full method notes are in the source repositories:

- Decision Desk: `William-Hill/renderatl-decision-desk`, `docs/design.md`.
- PTSO: `William-Hill/ptso_agent`, local branch `codex/jev-before-llm`, `docs/architecture/2026-10-07-jev-before-the-llm.md`. The branch is not pushed.

The videos are in `docs/presentation/media/`.

| File | Length | Content |
|---|---|---|
| `decision-desk-demo.mp4` | 1:46 | The desk on 36 synthetic emails: triage, the Jev wire (raw request and response), one Claude draft, the gates |
| `decision-desk-cost.mp4` | 1:08 | LLM only against Jev first, cost view (synthetic emails) |
| `maze-teaser.mp4` | 0:49 | Social teaser: Jev plus the code planner clears RenderMaze, 0 lives lost (game at 2x) |
| `maze-full.mp4` | 1:23 | The same game at real speed |

The maze video shows a chosen game (seed 5003, a win with 0 lives lost). It is not a typical game. The caption gives the held-out result: 28 of 30.

## 1. Decision Desk on synthetic emails

36 synthetic emails, `jev-1.13.0`. One Jev request with 7 questions for each email. Code applies the rules. Claude writes a draft only when the plan asks.

- Accuracy after one tuning pass on the same 36 emails: lane 32 of 32, action 30 of 32, stage 12 of 13, injection tests 2 of 2 held. These are tuning numbers.
- Cost run, the same 36 emails:

| | LLM only (Sonnet decides and writes) | Jev first |
|---|---|---|
| Cost | $0.226 | $0.070 (69% less) |
| Claude calls | 36 | 25 |
| Median time to a decision | 6.5 s | 188 ms |
| Lane right (32 decided by both) | 32 | 32 |
| Action right (same 32) | 27 | 28 |

Claude tokens are estimated from the prompts at the Sonnet list price. The headless Claude Code overhead is excluded from both columns.

## 2. Decision Desk on real sales email

Source: a Google Takeout export of william@renderatl.com. A script on the local Mac kept 70 sales threads and 268 prospect messages, and redacted names, email addresses, phone numbers, prices, links, signatures, and quoted replies. A scan found none of these left, except names inside free text. No email text is in any repository.

Answer key: what the rep did next, read from the rep's reply. William checked 50 labels: 19 were wrong. The catch-all labels ("another reply", "no reply") were wrong about half the time. The specific labels (contract, pricing, deck, schedule) were right 15 of 16 times.

### Version 1: the latest message only (all 268, one run)

| Method | Next action right | Cost | Median time |
|---|---|---|---|
| Jev | 108 (40%) | $0.023 | 189 ms |
| Sonnet | 107 (40%) | $0.59 | 4.3 s |
| Haiku | 109 (41%) | $0.29 | 9.0 s |
| Keyword rules | 97 (36%) | $0 | 0 |

Jev and Sonnet chose the same action on 214 of 268 (80%). Jev against Sonnet: 18 to 17 (p = 1.00). No method beat "always reply" on this key.

### Version 2: the stage playbook and whole-thread facts (held-out half, one run)

Jev received the RenderATL stage playbook, facts that code computes from up to 8 messages, and the rep's last message. Threads were split in two halves. Tuning used one half only. The other half ran once. Sonnet and Haiku got the same context. Score: the 45 held-out messages with a reliable label.

| Method | Right (of 45) | Mean recall, 4 actions | Cost, 138 messages | Median time |
|---|---|---|---|---|
| Jev v2 | 28 (62%) | 0.51 | $0.012 | 189 ms |
| Sonnet v2 | 26 (58%) | 0.49 | $0.60 | 4.0 s |
| Haiku v2 | 28 (62%) | 0.51 | $0.30 | 13.6 s |
| Jev v1 | 19 (42%) | 0.41 | | |
| Keyword rules | 21 (47%) | 0.38 | $0 | |
| Always "send contract" | 28 (62%) | 0.25 | $0 | |

- Jev v2 against Jev v1: 10 to 1 (p = 0.012). More context made Jev better.
- Jev v2 against Sonnet v2: 4 to 2 (p = 0.69). Against Haiku v2: 4 to 4 (p = 1.00). Jev equals the LLMs at 2% to 4% of the cost and more than 20 times faster.
- "Always send contract" gets the same raw count, because many held-out threads are at the contract stage. The mean recall shows the difference.

### Version 3: add the call notes

The Gemini call notes (166 of 268 messages matched a note) did not change the score: 28 of 51 on the tuning half and 28 of 45 on the held-out half, the same as version 2.

### What the real data supports

- Supported: for these decisions, Jev is as good as Sonnet or Haiku with the same context, at a small part of the cost and time.
- Supported: more context (the playbook and the thread facts) improves Jev significantly.
- Not supported: that any method makes the right decision often enough to act alone. Accuracy is about 40% to 62% on one mailbox and small samples.
- William's 50 hand labels for the held-out half are in progress. They score all options, including "another reply" and "no reply".

## 3. PTSO: Jev before the outfit agent

PTSO rule: "the model proposes, the ontology disposes". The experiment puts Jev before the LLM: one request routes the request, marks garments that the request rules out, and orders the rest before the per-category cap. Jev can only remove or reorder garments. The ontology still checks every outfit.

### Synthetic run (14 requests, the 39-garment seed closet)

- 5 of 14 requests skipped the LLM, all correctly (weather questions, greetings, a calendar question).
- The garments that each case needs reached the agent 21 of 21 times, against 13 of 21 today.
- 0 needed garments removed. Jev cost $0.0043 for 14 requests, median 187 ms.

### A/B on the real closet (39 requests, one run)

Account `mjh2225` (145 garments), Gemini `gemini-3.5-flash`. 11 real requests from the chat history and 28 held-out requests that were committed before the run. Three versions sent a different garment list to the same outfit agent.

| | Today | Style-first rule | Jev first |
|---|---|---|---|
| Gemini cost (measured tokens) | $1.34 | $1.41 | $1.29 |
| Proposals accepted by validation | 100% | 100% | 100% |
| Outfit-agent calls | 39 | 39 | 38 (1 wrong skip) |

Blind judge (Claude, random order):

| Pair | Jev first better | Rival better | Tie | Exact sign test |
|---|---|---|---|---|
| Jev first against today | 16 | 2 | 17 | p = 0.0013 |
| Jev first against the style rule | 18 | 5 | 12 | p = 0.011 |

- Better outfits at the same cost. The gain comes from the order before the cap: 62 tops and 63 bottoms, of which 5 of each reach the agent.
- No cost saving: the cap already limits the prompt.
- The route gate is not ready. Jev called 21 of 39 outfit requests "outfit", and it skipped one wrongly ("Running errands, nothing special.", 0.81). Every real request in the history was an outfit request.
- Limits: one run, a Claude judge, 39 requests, and no Neo4j graph grounding in the harness. William's 23-pair blind check is open.

## 4. The pattern across all experiments

| Experiment | Jev against an LLM | Jev against code or a trained model |
|---|---|---|
| Maze (numbers) | The code planner beat Claude as System 2 (28 against 13 of 30) | Plain code is level with Jev plus the planner |
| F1 pit stops (numbers, labels) | Claude made Jev worse | The trained model wins on all laps; Jev wins on safety-car laps |
| Ask Your Agent (attendee questions) | Same fact accuracy, 237 ms against 5,322 ms | |
| Decision Desk, real email | Equal to Sonnet and Haiku, 2% to 4% of the cost | Keyword rules are close; nothing is accurate enough to act alone |
| PTSO (real closet) | Better outfits by a blind judge, same cost | Better than a style-first rule |

The consistent result: on judgments about text, Jev matches an LLM at a small part of the cost and time. On numbers, code or a trained model wins. The accuracy of any method depends on the question and the context more than on the model.
