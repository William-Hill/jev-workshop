# Finding: the question decides how well Jev plays

Date: 2026-10-02. Status: supported by our benchmark, by the TypeSafe documents, and by two outside experiments that we reproduced.

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
