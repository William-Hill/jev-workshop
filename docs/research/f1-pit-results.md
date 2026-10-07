# F1 pit decision: results on the 2026 season

Date: 2026-10-06. Question: "Must this driver enter the pit lane at the end of this lap?" The label is what the team did, not the best decision.

## Setup

- Data: FastF1 3.8.3, the 16 completed races of 2026.
  - Train: rounds 1 to 10, with 10,960 driver-laps and 384 stops.
  - Tune: rounds 7 (Barcelona) and 9 (Great Britain), with 2,283 driver-laps and 104 stops.
  - Test (one run): rounds 11 to 16 (Hungary, the Netherlands, Italy, Spain in Madrid, Azerbaijan, Bahrain), with 6,839 driver-laps and 242 stops.
- Code calculates every fact for each lap: tire age against the typical stint for the compound, safety car, VSC, rain, the gap behind, the pit loss for the race, "a stop now loses a position", "a stop is still required", and the last 5 race-control messages.
- Typical completed stint in rounds 1 to 10: SOFT 11, MEDIUM 19, HARD 22 laps.
- Four methods give a pit probability for each lap:
  - `rule`: a hand-written rule.
  - `logreg`: a logistic regression on the same facts, trained on rounds 1 to 10.
  - `jev`: one Jev Noul (`jev-1.13.0`) with the same rules in ranked words.
  - `jev+s2`: Jev, and Claude Sonnet (headless Claude Code) on the uncertain laps. A lap goes to Claude when the Jev probability is from 0.35 to 0.65, when Jev fails, or when a race-control message names a safety car or a VSC.
- Threshold for each method: on the tune races, the best share of stops found, with at least half of the calls correct. No method reached half, so code took the threshold with the most correct calls: `logreg` 0.7, `jev` 0.2, `rule` 0.5 (the rule gives only 0 or 1).
- System 2 on the tune races lowered the event F1 from 0.446 to 0.436. By the plan, System 2 is not kept. The test still measured it, at the request of the user.

## Test results: rounds 11 to 16, all laps

| Method | Precision | Recall | Average precision | Brier | Calibration error | Stops found (±1 lap) | Calls correct (±1 lap) | Event F1 |
|---|---|---|---|---|---|---|---|---|
| `rule` | 0.081 | 0.554 | 0.061 | 0.237 | 0.237 | 0.558 | 0.157 | 0.245 |
| `logreg` | 0.159 | 0.372 | **0.147** | 0.170 | 0.323 | 0.459 | **0.325** | **0.381** |
| `jev` | 0.086 | 0.645 | 0.076 | 0.169 | 0.232 | **0.657** | 0.172 | 0.273 |
| `jev+s2` | 0.068 | 0.430 | 0.082 | **0.165** | **0.208** | 0.550 | 0.146 | 0.231 |

242 real stops in the test races. Calls at the threshold: `rule` 1,648, `logreg` 567, `jev` 1,805, `jev+s2` 1,535.

## Test results: safety-car and VSC laps only

632 driver-laps with 102 stops.

| Method | Precision | Recall | Average precision | Stops found | Calls correct |
|---|---|---|---|---|---|
| `rule` | 0.283 | 0.588 | 0.233 | 0.588 | 0.354 |
| `logreg` | 0.191 | 0.765 | 0.292 | **0.833** | 0.358 |
| `jev` | 0.255 | **0.804** | **0.381** | 0.824 | **0.388** |
| `jev+s2` | 0.248 | 0.314 | 0.290 | 0.373 | 0.341 |

## Cost and speed

| Item | Tune | Test |
|---|---|---|
| Jev requests | 2,283 | 6,839 |
| Jev input tokens | 1.69 million ($0.07) | about 5 million (about $0.21) |
| Jev errors | 0 | 0 |
| Claude calls | 102 | 390 |
| Claude time, median / p95 | 4,546 / 8,216 ms | 4,640 / 6,079 ms |
| Claude tokens (cache read + cache write + output) | 6.75 M + 1.03 M + 8,455 | 31.99 M + 2.14 M + 32,894 |
| Claude answers that were not yes or no | 0 | 0 |

The Claude calls used the Claude Max subscription of the user. At Sonnet API list prices, the test calls would cost about $23. Headless Claude Code adds about 76,000 tokens of its own context to each call. The prompt is about 500 tokens.

Note: the Jev answers for the test races were requested during a dry run that only counted the System 2 calls. That run did not score them. The test step read them from the cache.

## What the result means

- **On all laps, the trained model wins.** `logreg` has the best average precision (0.147 against 0.076 for Jev) and the best event F1 (0.381 against 0.273). This matches the design: when the data has labels and the facts are numbers, a trained model is the right tool.
- **Jev finds more stops but makes too many calls.** It found 66% of the stops, the highest share, but only 17% of its calls were correct. The cause is in the question: when the tires are "past" the typical stint, the rule says "yes" on every lap until the stop. Code must decide on which lap the call counts, for example only on the first "yes" lap.
- **On safety-car and VSC laps, Jev is the best of the four.** Its average precision is 0.381, against 0.292 for `logreg` and 0.233 for the rule. Those laps are a judgment with a clear written rule ("pit under a safety car when the tires are near or past their life") and race-control text. That is the kind of decision that Jev is built for. We did not test if this difference is significant: 632 laps and 102 stops in 6 races.
- **Claude as System 2 made the result worse.** It changed 270 of the 390 laps that it got. It lowered recall on all laps (0.645 to 0.430) and on safety-car laps (0.804 to 0.314). It improved only the Brier score and the calibration error a little. The tune races showed the same result before the test (0.446 to 0.436).
- **For the talk:** use this as the "when not to use Jev" example. A trained model wins on labeled numeric data. Jev did best on the narrow judgment (safety-car laps, written rule, text messages). An LLM on top did not help.

## Limits

- The label is the decision of the team, not the best decision.
- One season, 16 races. Six races in the test set. One run.
- The facts come from timing data only. No tire-wear model, no team radio, no weather forecast.
- The thresholds use a rule that no method met (half of the calls correct), so code took the most correct calls.
- Red-flag laps are removed. Italy (round 13) has only 10 stops in the table because most stops were under the red flag.
- Rounds 11 and 16 have 25 and 58 laps with no compound in the FastF1 data. These laps get "unknown" tire age.

## Changes from the plan

- The races: 2026 rounds 1 to 10 and 11 to 16, not 2023 and 2024 (decision of the user, 2026-10-06). New technical rules started in 2026.
- Pit loss uses only stops where the in-lap and the out-lap are both green. With safety-car laps only removed, VSC stops gave up to 52 s.
- Each method has its own threshold, chosen on the tune races. The plan used one threshold for all.
- The facts convert numpy values to Python values, so that the request body encodes as JSON.
- Paths are relative to `f1/`, so the commands run from `f1/`.

## Run it

```bash
cd f1 && set -a && . ../.env && set +a
.venv/bin/pytest -q                                    # 20 tests
.venv/bin/python -m f1pit.run train
.venv/bin/python -m f1pit.run tune
.venv/bin/python -m f1pit.run tune --system2 on --dry-run
.venv/bin/python -m f1pit.run test --system2 off
```

Results go to `f1/results/` (not committed).
