# Reproductions of outside Jev experiments

Date: 2026-10-02. Three agents ran the code of three public projects with our TypeSafe key. Each agent read the code before it ran anything, and worked outside this repository. This folder keeps our harness scripts and the small result files. It does not keep the cloned projects.

All three projects send their calls through OpenRouter by default. Our harnesses send the same requests to `https://api.typesafe.ai/v1/systemone`, so the TypeSafe key did not go to OpenRouter. Model `jev-1.13.0` in every response. Total cost: approximately $0.05.

Each harness reads the key from the `TYPESAFE_API_KEY` environment variable. Load it only inside the command, for example:

```sh
TYPESAFE_API_KEY="$(grep '^TYPESAFE_API_KEY=' .env | cut -d= -f2-)" python3 run_direct.py 3
```

## House rules: holds

Source: <https://github.com/phuryn/experiments>, folder `jev-decisions-api/02-house-rules-n24`, commit `97f61d10384982c6037c16fef1d464778433a2fa`.

24 support messages, 4 teams, 3 conditions. Our harness `house-rules/run_direct.py` reads the messages, teams, and question text from the original file with `ast`, and sends the same request body. The second model in the original (ministral-8b, through OpenRouter) is not tested.

| Condition | Claimed | Run 1 | Run 2 | Run 3 |
|---|---|---|---|---|
| Company rule not in the question | 5/24 | 5/24 | 5/24 | 5/24 |
| Company rule in the criteria | 24/24 | 24/24 | 24/24 | 24/24 |
| No rule, 8 labeled examples in the state | 13/24 | 13/24 | 13/24 | 14/24 |
| Errors above 0.90 confidence (no rule) | 15 of 19 | 14 of 19 | 14 of 19 | 14 of 19 |

- The 14 against 15 difference: one message got 0.92 in the original and 0.87 to 0.90 in our runs. The script counts only values strictly above 0.90.
- Repeatability: 70 of 72 requests gave the same answer in all 3 runs. The 2 changes were in the examples condition, both below 0.40 confidence.
- Latency: median 199 ms, p95 262 ms, with 4 parallel workers. Tokens: 100,413 input.
- Caveat: the rule was written for these 24 messages and scored on them. The result shows the effect of the words, not accuracy on new messages.

## Village: partly holds

Source: <https://github.com/tfolkman/jev-village>, commit `7bd9bd3e57692df575511cf039ccc4b6ed1ec936`.

Claim: vague action criteria kept the village at the well at 3 a.m. ("eat 58% at hunger 0/100"); explicit thresholds put it to bed at 22:00 with 85–90% confidence. Our harness (`village/harness.mjs`, `point.mjs`, `sim.mjs`) imports the project's own world code and question objects. We did not run `npm start`, because it changes the Tailscale settings of the machine.

| Test | Vague criteria (commit `38237de`) | Explicit criteria (commit `8275164`) |
|---|---|---|
| 3 a.m., hunger 0, 5 runs | "eat" 5 of 5, P(eat) 0.60–0.69 | "sleep" 5 of 5, confidence 1.00 |
| 22:00, 5 runs | "eat" 5 of 5 | "sleep" 5 of 5, confidence 1.00 |
| Night simulation, 10 villagers, 20:00–04:00 | At 3 a.m.: 20% eat, 80% plaza | 100% sleep from 21:00 |

- The vague version did not keep the village "at the well" in the simulation. Most villagers went to the plaza.
- The same commit changed the criteria and the state text. With the vague criteria and the new state text, 3 a.m. moved to "sleep" 4 of 5, but 22:00 stayed at "eat" 5 of 5. Both changes did part of the work.
- New literal-reading effect: with the explicit criteria, villagers slept at a hunger of 99 of 100, because the night rule in the `sleep` criterion won over the hunger rule.
- 1,631 calls, all HTTP 200. Tokens: 925,845 input. Cost: $0.039.

## GapFlap: partly holds, for the wrong reason

Source: <https://github.com/gdchaochao/lunar-terminal>, file `jev-games/flappy.py`, commit `07c887401a6f5808392de5c37be2e3f6d6db82da`.

A Flappy Bird game with 9 rows. Our wrapper `gapflap/run_logged.py` imports the original file unchanged, sets `JEV_API` to the TypeSafe endpoint, blocks every other host, and logs each response. `gapflap/analyze.py` computes the accuracy and the perfect-answer check. The `result-*.json` files are our runs.

| Policy | Claimed mean | Our mean | Episodes |
|---|---|---|---|
| Hand-written rule | 80 | 80 | 12 |
| Random | 5.0 | 5.0 | 12 |
| One Choice, "flap or hold" | 3.0 | 3.375 | 8 |
| Three Nouls + a code rule | 59.25 | 53.625 | 8 |

- The order of the policies holds.
- The claimed 0.94–0.96 factual accuracy does not hold. Over 434 logged atomic calls: "above" 0.433, "below" 0.353, "inside" 0.894.
- With perfect answers, the author's code rule scores a mean of 10 on the same seeds. Jev's wrong "below" answers make the controller act like the hand-written rule. The high score is luck, not good design.
- 502 calls. Tokens: 240,476 input. Cost: $0.010.
