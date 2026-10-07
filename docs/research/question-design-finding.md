# Finding: the question decides how well Jev plays

Date: 2026-10-02. Status: supported by our benchmark, by the TypeSafe documents, and by two outside experiments that we reproduced.

## System 2 in the maze (2026-10-07)

Two variants add a System 2 step to `level2d`. Code sends a decision to System 2 when one of these conditions is true:

1. The Jev confidence for "move" is below 0.5.
2. Every direction is dangerous, and power mode is off. A direction is dangerous when a blocker is 3 steps or fewer away, or 6 steps or fewer away and approaching.

- `level2d-s2search`: System 2 is code. It simulates each option for 8 steps and picks the option where the runner survives longest.
- `level2d-s2llm`: System 2 is Claude Sonnet through headless Claude Code (`LLM_BACKEND=claude-cli`). It gets an ASCII map, the facts for each option, and the legal moves, and it answers with one word.

We did not tune the rule or the horizon. Each variant ran on seeds 1000–1029, then one time on the held-out seeds 5000–5029. The wait mode stopped the game during each System 2 call.

| Version | Seeds 1000–1029 | Seeds 5000–5029 | 95% interval (5000) | Mean lives lost (5000) |
|---|---|---|---|---|
| `level2d` (no System 2) | 20 of 30 (67%) | 6 of 30 (20%) | 10–37% | 2.63 |
| `level2d-s2search` | 26 of 30 (87%) | 28 of 30 (93%) | 79–98% | 0.77 |
| `level2d-s2llm` | 16 of 30 (53%) | 13 of 30 (43%) | 27–61% | 1.97 |
| `code-only` | 23 of 30 (77%) | 26 of 29 (90%) | 74–96% | 1.52 |

Paired comparisons on seeds 5000–5029 (exact McNemar test):

| Comparison | Only the first won | Only the second won | p |
|---|---|---|---|
| `level2d-s2search` against `level2d` | 22 | 0 | < 0.001 |
| `level2d-s2llm` against `level2d` | 9 | 2 | 0.065 |
| `level2d-s2search` against `level2d-s2llm` | 16 | 1 | < 0.001 |
| `code-only` against `level2d-s2search` | 2 | 3 | 1.000 |
| `code-only` against `level2d-s2llm` | 15 | 2 | 0.002 |

The System 2 calls on seeds 5000–5029:

| | `level2d-s2search` | `level2d-s2llm` |
|---|---|---|
| Decisions sent to Jev | 2,795 | 2,810 |
| Sent to System 2 | 523 (18.7%) | 639 (22.7%) |
| Cause: low confidence / all dangerous | 309 / 214 | 341 / 298 |
| System 2 changed the Jev move | 255 | 170 |
| System 2 time, median / p95 | under 1 ms / under 1 ms | 4,959 ms / 10,670 ms |
| Illegal System 2 answers | 0 | 0 |
| Jev input tokens | 3.41 million | 3.39 million |
| LLM tokens | none | 30.3 million cache read, 1.66 million cache write, 233,000 output |

Findings:

- The code planner is the better System 2. It beats `level2d` on 22 seeds and loses on none. It beats the LLM on 16 seeds and loses on 1. It is level with `code-only` (p = 1.000).
- The LLM System 2 helps `level2d` (13 against 6 wins), but the difference is not significant at 30 games (p = 0.065). It is clearly worse than `code-only`.
- The LLM is too slow for live play. Its median answer took 4,959 ms. At 6.7 tiles each second, the runner moves about 33 tiles in that time. These results are valid only because the wait mode stopped the game.
- The LLM cost: headless Claude Code adds its own context to each call: 50,000 to 60,000 tokens on average. Our prompt is about 1,200 tokens. The runs used the subscription of the user, not API billing. At Sonnet API list prices, the same tokens cost about $23 (seeds 5000) and $25 (seeds 1000). A direct API call (`LLM_BACKEND=anthropic`) sends only our prompt.
- The escalation rule is the part that works. Jev is unsure or every direction is dangerous in about 1 decision of 5. A slow, careful step on only those decisions takes `level2d` from 20% to 93% on new seeds.

Limits: one run for each variant and seed set. The runs are not fully repeatable (see the next section). The LLM model is the `sonnet` alias of Claude Code on 2026-10-06.

## Held-out seeds 5000–5029 (2026-10-06)

No version was tuned on these seeds. Each version played 30 games on Normal, model `jev-1.13.0`, with `--seed 5000`.

| Version | Games | Wins | 95% interval | Mean lives lost | Seeds 1000–1029 (tuning) |
|---|---|---|---|---|---|
| First question (`questions`) | 30 | 7 (23%) | 12–41% | 2.60 | 6 of 30 (20%) |
| `level2c` | 30 | 12 (40%) | 25–58% | 2.37 | 15 of 30 (50%) |
| `level2d` | 30 | 6 (20%) | 10–37% | 2.63 | 20 of 30 (67%) |
| `code-only` (no Jev) | 29 | 26 (90%) | 74–96% | 1.52 | 23 of 30 (77%) |

Paired comparisons on the same seeds (exact McNemar test):

| Comparison | Only the first won | Only the second won | p |
|---|---|---|---|
| `code-only` against the first question | 19 | 0 | < 0.001 |
| `code-only` against `level2c` | 15 | 1 | 0.001 |
| `code-only` against `level2d` | 22 | 1 | < 0.001 |
| `level2c` against the first question | 10 | 5 | 0.302 |
| `level2d` against the first question | 5 | 6 | 1.000 |
| `level2c` against `level2d` | 11 | 5 | 0.210 |

- `code-only` wins more often than each Jev version. The difference is significant for each pair.
- `level2c` against the first question is not significant on these seeds (p = 0.302). On the tuning seeds it was significant (p = 0.035).
- `level2d` does not beat the first question on these seeds (6 of 30 against 7 of 30). On the tuning seeds, `level2d` won 20 of 30 (p = 0.001). That gain does not hold on new seeds. Treat the 67% as a result of tuning on seeds 1000–1029.
- Each Jev version opened with "down" at the start tile (1,1) in 30 of 30 games.
- Tokens: the first question 1.11 million, `level2c` 3.17 million, `level2d` 3.09 million (about $0.05 to $0.13 for each run).

Limits of this run:

- The runs are not fully repeatable. We ran `code-only` two times on the same seeds. Seeds 5004, 5021, 5022, and 5023 gave a different result (25 of 29 wins, then 26 of 29). The first run had 6 benchmarks in parallel, and the second run had 3. A frame-time effect under CPU load is the probable cause. We did not prove the cause. The table uses the second run.
- In each `code-only` run, one game did not load in 30 seconds (seed 5025, then seed 5024). The benchmark did not count that game.
- The 4 versions ran in parallel. The Jev versions ran one time each.

## Update 2026-10-04: seeded results replace the fixed-seed results

The earlier maze runs used one fixed seed. The maze is almost deterministic, so a 20-game run was a few routes repeated. `npm run bench` now has `--seed N`: each game gets its own seed for the "wander" blockers (the game rules do not change). Each version below played the same 30 seeds (1000 to 1029) on Normal.

| Version | Games | Wins | 95% interval | Mean lives lost | First move at (1,1) |
|---|---|---|---|---|---|
| First question (`questions`) | 30 | 6 (20%) | 10–37% | 2.70 | down 30 of 30 |
| `level1` (priority words only) | 28 | 4 (14%) | 6–31% | 2.86 | right 27 of 28 |
| `level2c` (ranked rules + facts + tie-break) | 30 | 15 (50%) | 33–67% | 2.00 | down 30 of 30 |
| `level2d` (+ code marks the farthest blocker) | 30 | 20 (67%) | 49–81% | 2.30 | down 30 of 30 |
| `level2e` (+ power mode under 2 s counts as off) | 30 | 2 (7%) | 2–21% | 2.87 | right 29 of 30 |
| `code-only` (no Jev) | 30 | 23 (77%) | 59–88% | 1.47 | — |

Paired comparisons on the same seeds (exact McNemar test on the seeds where only one version won):

| Comparison | Only the first won | Only the second won | p |
|---|---|---|---|
| `level2d` against the first question | 15 | 1 | 0.001 |
| `level2c` against the first question | 12 | 3 | 0.035 |
| `level1` against the first question | 4 | 6 | 0.754 |
| `level2d` against `level2c` | 8 | 3 | 0.227 |
| `level2e` against `level2d` | 1 | 19 | < 0.001 |
| `code-only` against `level2d` | 7 | 4 | 0.549 |

What holds on varied games:

- The ranked rules plus facts that code calculates (`level2c`, `level2d`) win clearly more often than the first question.
- Priority words alone (`level1`) do not. Its fixed-seed 54% was route luck.
- `level2d` against `level2c` is not significant at 30 games. The step-3 mechanism (44 of 44 against 35 of 66) is real, but the win gain is not proven.
- `level2e` is clearly worse than `level2d`. The new text changed the first move at the start tile from down to right, and the two versions that open with "right" are the two worst.
- Code only (77%) and `level2d` (67%) are not significantly different at 30 games.
- Two `level1` games failed in the harness (one page lost its scene, one hung until the 16-minute limit) and are not counted.

Per-decision accuracy (computed offline from the seeded logs): a code version of the written `level2c` and `level2d` rules gives the answer that the rules require. Jev followed the written rules in 2,246 of 2,343 decisions for `level2c` (95.9%) and 2,625 of 2,753 for `level2d` (95.4%). When the rules give exactly one answer: 96.1% and 96.2%.

| Confidence of the Jev answer | `level2c` follows the rules | `level2d` follows the rules |
|---|---|---|
| below 0.4 | 79% of 181 | 80% of 188 |
| 0.4 to 0.7 | 87% of 469 | 84% of 420 |
| 0.7 to 0.9 | 100% of 576 | 97% of 775 |
| 0.9 or more | 100% of 1,117 | 100% of 1,370 |

- About 96% per decision is in the range of the independent classification results (91.3% to 95.9%, see `jev-research.md` section 7b).
- The confidence predicts rule-following well: errors are almost all below 0.7.
- A game has about 80 to 100 Jev decisions, so a 4% error rate gives several errors in each game. Some are fatal. With imperfect rules on top, 96% per decision becomes 50% to 67% of games won.

The sections below describe the earlier fixed-seed runs. Their numbers are superseded by this table.

## Summary

- Jev does not learn from the game, and nobody can retrain it. The only parts that we control are the words of the question, the facts in the state, and the code around the answers.
- With the starting question, Jev won 6 of 29 games on Normal (21%) and 0 of 3 on Spicy. With only the words changed (`level1`), the same model won 15 of 28 on Normal (54%) and 2 of 3 on Spicy.
- A code-only policy with no Jev won 10 of 10 on Normal and 5 of 5 on Spicy. In this maze, plain code plays better than every Jev version. The maze shows the effect of the words. It does not show that Jev is the right tool for a maze.
- The cause: the starting question gave all the facts, but it did not say which fact was more important. Jev answers the words that you wrote, not the intent behind them.
- TypeSafe documents this behavior as failure mode 1, "literal reading". We reproduced the house-rules experiment exactly (5/24 to 24/24) and the village experiment in part.
- The second idea, "split the decision into narrow questions and combine them in code", has weaker evidence. Our `level3` did worse than `level1`, and the GapFlap result did not survive our reproduction.

## 1. What "the question" is

At each intersection, the player sends one request to Jev. The request has two parts:

| Part | What it contains | Who writes it |
|---|---|---|
| State | Facts that code calculated: the tile, the lives, and for each legal direction the steps to the nearest collectible, blocker, and power pellet | Code (`buildSnapshot`) |
| Question | The instructions, plus one description (criterion) for each direction that Jev can choose | The attendee (`buildQuestions`) |

Jev returns one direction, a probability for each direction, and a confidence. Code then checks the answer and moves the player.

"Improve the question" means: change the instructions, the criteria, the facts, or the code that combines the answers, so that Jev picks better directions.

## 2. The starting question and the improved question

Example situation: left has a blocker 2 steps away and a collectible 1 step away. Right has a blocker 9 steps away and a collectible 6 steps away. The text below is the real format of each file. The numbers are example values.

**Starting question** (`src/jev/questions.js`):

> Instructions: "Select the next move for the runner in the maze. The runner must collect all the collectibles. A blocker removes one life when power mode is off. When power mode is on, the runner can eat a blocker for points."
>
> left: "Move left. Nearest collectible: 1 steps. Collectibles near: 1. Nearest blocker: 2 steps. Nearest power pellet: 14 steps. Power mode is off."
>
> right: "Move right. Nearest collectible: 6 steps. Collectibles near: 0. Nearest blocker: 9 steps. Nearest power pellet: 20 steps. Power mode is off."

All the facts are present. The text does not say that a near blocker is worse than a far collectible. It names the collectibles first.

**Improved question** (`src/jev/variants/level1.js`):

> Goal: "Keep the runner alive first. Collect the collectibles second."
>
> Rules: "When power mode is off, a direction with a blocker 3 steps or fewer away is a bad move, even when a collectible is nearer in that direction." · "When power mode is off and no direction is safe, select the direction with the farthest blocker." · "When power mode is on, the blockers are not a danger." · "A reverse move is acceptable when it moves away from a blocker."
>
> left: safety "DANGER: a blocker is 2 steps away in this direction."
>
> right: safety "No blocker is near in this direction."

The facts are the same. The words now give the priority, and they mark the danger.

## 3. The four ways to improve (the hackathon levels)

| Level | What changes | Example in the instructor solution | File |
|---|---|---|---|
| 1 | The words | Put the priority rule in the instructions, and mark the danger in each criterion | `variants/level1.js` |
| 2 | The facts | Code adds "the blocker moves toward the runner" and the count of blockers within 6 steps | `variants/level2.js` |
| 3 | A second question, and a rule in code | Jev rates the danger of each direction from 0 (safe) to 2 (deadly). When Jev picks a direction with a danger of 1.0 or more and a safer direction exists, code changes the move. The panel shows `OVERRIDE`. | `variants/level3.js` |
| 4 | A yes/no question | "Must the runner go to the power pellet now?" At a probability of 0.7 or more, code moves to the nearest power pellet, unless that direction is deadly. | `variants/level4.js` |

Each level builds on the level before it.

## 4. Our evidence

Method: `npm run bench`. Headless games, wait mode (the game stops during each request), speed 2, model `jev-1.13.0`. Score: collectibles after Jev decisions, minus 30 for each life lost.

### Spicy (2026-10-02, 3 games for each variant)

| Variant | Wins | Mean points | Mean lives lost | Mean collectibles left |
|---|---|---|---|---|
| baseline | 0 of 3 | 5.67 | 3 | 63 |
| level1 | 2 of 3 | 59 | 2.33 | 27.67 |
| level2 | 1 of 3 | 56.67 | 2.67 | 18.33 |
| level3 | 2 of 3 | 80.33 | 2.33 | 4.67 |
| level4 | 2 of 3 | 63 | 2.33 | 23.33 |

### Normal

2026-10-02, 5 games for each variant.

| Variant | Wins | Mean points | Mean lives lost | Mean collectibles left |
|---|---|---|---|---|
| baseline | 2 of 5 | 47.8 | 2.2 | 44.8 |
| level1 | 3 of 5 | 121.4 | 1.2 | 0.8 |
| level2 | 2 of 5 | 77.2 | 1.8 | 16.8 |
| level3 | 0 of 5 | 56.6 | 3 | 11.8 |
| level4 | 3 of 5 | 111 | 1.4 | 3.6 |

Other Normal games, not in the table:

- An earlier `level1` run won 3 of 3 with 0 lives lost (points 159, 157, 159). Its fourth game crashed when the page reloaded, so the run wrote no summary. Over both runs, `level1` won 6 of 8.
- Earlier baseline runs lost 4 of 4. Over these runs, the baseline won 2 of 9 on Normal.
- A later 20-game run (after the staff-level review) gave the baseline 4 of 20 and `level1` 9 of 20. All Normal runs together: baseline 6 of 29 (21%), `level1` 15 of 28 (54%). The earlier `level1` figure of 6 of 8 was a small-sample high.
- In the 20-game `level1` run, 7 games stopped at the time limit. The runner circled a corner loop with no item and no blocker, because the rule "keep the runner alive first" made "no blocker at all" look best. The fix for one literal reading created another one.
- A code-only baseline (`variants/code-only.js`) won 10 of 10 on Normal, with 1 life lost each time.
- Three more versions, 20 games each on Normal (2026-10-03):

  | Variant | Idea | Wins | Mean lives lost | Fallback share of Jev requests |
  |---|---|---|---|---|
  | `level1c` | One ranked list of rules in place of separate rules | 14 of 20 (70%) | 1.55 | 8.6% |
  | `level2b` | `level1b` words + the fact "the blocker moves toward the runner" | 15 of 20 (75%) | 1.25 | 4.0% |
  | `level1d` | `level1c` words; code removes directions with a blocker 3 steps or fewer away | 13 of 20 (65%) | 1.8 | 6.1% |

  - None of the three reached the time limit.
  - The three are too close to rank with 20 games each. All three are far above the first question (21%).
  - `level2b` turned `level1b` (60%) into 75% with one added fact. This supports the idea that the pincer deaths came from a missing fact.
  - `level1d` did not beat `level1c`. Code removed a direction in only 101 of about 13,000 decision states. Most `level1d` losses came late (3 to 9 items left), from blockers that approached from more than 3 steps away. A fixed 3-step filter does not see a moving blocker.
  - Code only plays almost the same game each time (1 life lost in each of 10 games), so its 10 of 10 is close to one game repeated, not 10 independent samples. Compare it with care.
- `level2c` (2026-10-04) combines the best parts and fixes two patterns from the logs of `level1c` and `level2b`: dithering (back-and-forth turns in a corridor between two blockers) and ties with no tie-break. It uses the `level2b` facts, one ranked list of five steps, "keep the current heading" as the tie-break, and plain words ("No blocker on this path", "No collectibles left in this direction") in place of "none".

  | Variant | Games | Wins | Mean lives lost | Deaths | Back-and-forth turns | Fallback share | Input tokens |
  |---|---|---|---|---|---|---|---|
  | `level1c` | 20 | 14 | 1.55 | 25 | 14.5% | 8.6% | 2.70 M |
  | `level2b` | 20 | 15 | 1.25 | 20 | 10.0% | 4.0% | 2.44 M |
  | `level1d` | 20 | 13 | 1.8 | 29 | 3.3% | 6.1% | 3.08 M |
  | `level2c` | 20 | 18 (90%) | 0.7 | 12 | 6.7% | 2.3% | 1.59 M |

  - `level2c` is the best Jev version so far, and it used the fewest requests and tokens.
  - Against `level2b`, 18 of 20 compared with 15 of 20 is not a certain difference at this sample size. Against the first question (6 of 29), it is.
  - Both losses were the same game with the same two deaths. In each, all directions were dangerous, so step 3 ("choose the direction with the farthest blocker") applied. At tile (1,5), Jev chose left (blocker 2 steps) over down (blocker 4 steps), at confidence 0.21. At tile (9,7), it chose left (blocker 3 steps) over up (blocker 5 steps). This is failure mode 2, a number comparison. The next fix: code marks the direction with the farthest blocker, so that Jev does not compare the numbers.
- `level2d` (2026-10-04) is `level2c` plus that one fact: code marks each direction with the farthest blocker ("farthest blocker"), and step 3 says to choose the marked direction.
  - Won 18 of 20 on Normal, the same as `level2c`.
  - Mean lives lost 0.45 (`level2c`: 0.7). Deaths 7 (`level2c`: 12). Input tokens 1.75 M.
  - In decisions where all directions were dangerous, Jev picked the farthest blocker in 44 of 44 (`level2c`: 35 of 66, 53%). The mark removed the comparison error completely.
  - The 2 losses came late, with 6 and 8 items left, not from step 3.
  - This is rule 2 of the talk in one measurement: the same question, with one comparison moved into code, removed a whole class of errors.
- `level2e` (2026-10-04) is `level2d` plus a power-mode fix: code treats power mode with 2 seconds or less left as "off" (a `level2d` loss came from a move toward a blocker with 0.1 seconds of power left).
  - **It won only 3 of 50 games on Normal.** Mean lives lost 2.86.
  - Cause: at the start tile (1,1), `level2d` chose "down" in all 19 logged openings, and `level2e` chose "right" in 47 of 50 games (probabilities 0.65 against 0.35). The new step 1 text and the `power_mode` field moved one near-tie.
  - The maze is almost deterministic. After "right", the runner followed the same route and reached a trap at tiles (5,5) to (5,7) when two blockers closed in. The first death came at decision 52 in all 20 logged games.
  - The power-mode fix itself was not tested, because almost no game reached a power-mode ending.
- **Consequence for every maze result in this file:** a variant's result depends heavily on a few early near-tie decisions, which fix the route. `level2d` followed one route in 12 of its 19 logged openings. A 20-game run is therefore a few routes repeated, not 20 independent games. The large gains (first question 6 of 29 against 15 to 18 of 20) are real in direction, but the gaps between the improved versions are not reliable. A fair test needs variation between games, for example a different random seed for the "wander" blockers in each game.
- Teaching point: a one-sentence change to a question can flip a close call, and in a deterministic system one flipped call can change every later outcome. Test question changes on varied inputs.
- `level1b` adds one rule to `level1`: "When no blocker is 3 steps or fewer away, go toward the nearest collectible." In 20 games on Normal it won 12 (60%), with 0 time-limit games but 2.05 lives lost on average. The corner loop disappeared, and an early death in a pincer between two blockers appeared in 8 games. Each sentence fixed one behavior and changed another.
- One `level1` game reached the 240-second limit with 3 collectibles left.

What the Normal results show:

- The words alone (`level1`) gave the best result: the highest points and the fewest lives lost.
- More questions did not always help. `level3` (danger Score and override) lost all 5 games, although it collected most of the collectibles. We did not find the cause. One possible cause: the override moves the runner into a worse position than the move of Jev.
- `level4` did almost as well as `level1`.
- The baseline is not always a loss on Normal. It won 6 of 29. Spicy gives a clearer "before" picture (0 of 3).

### Limits of our evidence

- The game count is small. The spread inside one variant is large, so the order between the levels is not reliable.
- One person wrote the instructor solutions in one session. Other teams will write different text with different results.
- The wait mode removes the effect of the latency. In real-time play (`wait=0`), the results can be different.
- The open model `nimble` failed in a different way from Jev on the same starting question. Do not use the `nimble` result as evidence about Jev.

## 5. Corroboration outside our experiment

### The TypeSafe documents

| Source | What it says |
|---|---|
| [Jev 1.13 jaggedness](https://docs.typesafe.ai/model-jaggedness/jev-1.13), failure mode 1 | "`jev-1.13` answers the question you wrote, not the one you meant. Scoping words, negations, and implied conditions are read at face value." |
| Same page | "When you look at a wrong answer and find yourself explaining what you really meant, that explanation is the missing half of the instruction." |
| Same page | "Where interpretation is unavoidable, split it into two literal questions and combine them in code." |
| [How to build with TypeSafe](https://docs.typesafe.ai/concepts/how-to-build-with-system-one) | "Ask the most explicit, narrow, specific, atomic questions you can." It calls this "probably the most important concept in this guide." |
| Same page | "Keep control flow, deterministic rules, and side effects in code." |

Our level 1 follows the first three rows. Our level 3 follows the last two rows.

### Outside projects

| Project | What changed | Result | Checked by |
|---|---|---|---|
| [phuryn/experiments, house rules](https://github.com/phuryn/experiments/tree/main/jev-decisions-api) | A company routing rule, written in the criteria or left out | "Written into the criteria: 24/24." "Left unstated: 5/24, with 15 of the 19 misses above 0.90 confidence." | Reproduced (below) |
| [tfolkman/jev-village](https://github.com/tfolkman/jev-village) | Vague action criteria, then thresholds in the criteria | "with vague action criteria Jev kept the village at the well at 3 a.m. (eat 58% at hunger 0/100). After spelling out thresholds in the criteria ("only when hunger > ~50"), the same model put the village to bed at 22:00 with 85–90% confidence." | Reproduced (below) |
| [gdchaochao/lunar-terminal](https://github.com/gdchaochao/lunar-terminal), GapFlap | One broad "flap or hold" Choice, then three yes/no questions plus a 6-line rule in code | Claimed: broad Choice 3.0, random 5.0, three Nouls plus code 59.25, hand-written script 80. See the reproduction below: the score order holds, but for the wrong reason. | Reproduced (below) |
| Same, Robocode (327 trials) | Jev picks the tank action directly | Jev's policy −2.07, uniform random +1.24, best +15.54. Correlation of Jev's value with the result r = −0.099. The author: asked "what should I do?", the model is below random; asked "is this true?", it does well. | Me, from the README |
| [anisselbd/jev-phishing-bench](https://github.com/anisselbd/jev-phishing-bench) | One broad verdict, then five signal questions combined by a logistic regression | 62.6% against 95.0% on a held-out half (2,000 emails). Caveat: the emails are synthetic, and a regex alone gets 91.6%. | Me, from the README |
| [seanthomasevans/typesafe-nes](https://github.com/seanthomasevans/typesafe-nes) | A loose criterion about a ladder | "Jev reads literally. 'A wall or a ladder is probably in the way' produced ninety seconds of holding up where there was no ladder." | Me, from the README |

### Our reproductions of three outside experiments (2026-10-02)

Three agents ran the code of three projects with our TypeSafe key. Each agent read the code first and worked outside this repository. Each project sends its calls through OpenRouter by default. The agents sent the same requests to `api.typesafe.ai` directly, so the TypeSafe key did not go to OpenRouter. Model `jev-1.13.0` in each response. Total cost approximately $0.05.

| Experiment | Claim | Our result | Verdict |
|---|---|---|---|
| House rules (phuryn), 3 runs of 24 messages | Rule left out 5/24, rule written 24/24, examples in state 13/24, 15 of 19 errors above 0.90 | 5, 5, 5 · 24, 24, 24 · 13, 13, 14 · 14 errors above 0.90 in each run (one value fell from 0.92 to 0.87–0.90) | **Holds** |
| Village (jev-village), 5 runs at each moment, plus an 80-tick night simulation of 10 villagers | Vague criteria keep the village at the well at 3 a.m. (eat 58% at hunger 0). Explicit thresholds put it to bed at 22:00 at 85–90%. | 3 a.m., vague: "eat" 5 of 5, P(eat) 0.60–0.69. 22:00, explicit: "sleep" 5 of 5, confidence 1.00. In the simulation, the vague version sent 80% to the plaza at 3 a.m., not to the well. | **Partly holds** |
| GapFlap (lunar-terminal), 8 to 12 episodes, the original seeds | Broad Choice 3.0, random 5.0, three Nouls + code 59.25, script 80. Factual accuracy 0.94–0.96. | 3.4, 5.0, 53.6, 80. Factual accuracy: "above" 0.433, "below" 0.353, "inside" 0.894. With perfect answers, the author's code rule scores only 10. | **Partly holds, for the wrong reason** |

What the reproductions add:

- **House rules** supports the main finding directly: the rule in the words changes 5/24 to 24/24.
- **Village** supports it, with a correction. The same commit changed the criteria and the state text. With the vague criteria and the new state text, 3 a.m. moved to "sleep" 4 of 5, but 22:00 stayed at "eat" 5 of 5. Both changes did part of the work.
- **Village** also shows a new literal-reading effect. With the explicit criteria, villagers slept even at a hunger of 99 of 100, because the night rule in the `sleep` criterion won over the hunger rule.
- **GapFlap** does not support "narrow questions plus code". Jev answered the row-number questions badly, and its errors happened to correct a wrong code rule. GapFlap supports a different TypeSafe warning: keep number comparisons in code. Our maze already does this, because code calculates each distance.

### What the corroboration shows

- **Write the rule in the words.** The TypeSafe docs, house rules (reproduced), the village (partly reproduced), typesafe-nes (README only), and our level 1 agree.
- **Split a broad decision into narrow questions and combine them in code.** The TypeSafe docs recommend it. The phishing bench (README only) supports it. GapFlap does not support it after our reproduction. Our own level 3 did worse than level 1 on Normal. This second effect thus has weaker evidence than the first.
- In three sources, the wrong answers had a high confidence: house rules (14 to 15 of 19 above 0.90), the village (P(eat) 0.60–0.69 at a hunger of 0), and our `nimble` run (0.93). A high confidence does not show that the question was right.

### Limits of the corroboration

- We reproduced three experiments. The other outside results are self-reported by their authors.
- Our reproductions used the direct TypeSafe API, not the OpenRouter route of the originals. Both report Jev 1.13.
- The phishing result partly comes from the data set: a regex alone gets 91.6%.

## 6. The lesson for the workshop

- One sentence: "Jev answered the question we wrote. To change what Jev does, change the question."
- Show the evidence in this order: our baseline against `level1` on Spicy and Normal, then house rules (24/24 against 5/24), then the village at 3 a.m.
- Do not present GapFlap as proof of "narrow questions". Use it only as an example of "keep number comparisons in code".
- Tell the attendees that more questions are not automatically better. Our `level3` is a good example: measure each change with `npm run bench`.
- RLCD rewards a correct probability for the question as written. It does not reward a good result in our game. The game result enters only through the words, the facts, and the code.
- The hackathon is an outcome loop: change the question, run the benchmark, keep the better version.
