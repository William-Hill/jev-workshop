# Workshop notes

Notes for the lecture and the attendee guide. Add to this file when a test gives a result that is good for teaching.

The main finding, with the evidence and the outside sources, is in [`docs/research/question-design-finding.md`](./research/question-design-finding.md): the question decides how well Jev plays.

## Note 1: a high confidence is not a safe move (2026-10-02)

Source: one run with the open model `nimble` on local Ollama, not Jev. Log: 112 entries in 40 seconds.

- The model made 32 of the 34 decisions at a decision point. The fallback policy made 2.
- The confidence was 0.72 at the median and 0.97 at the maximum.
- In 10 decisions, a blocker was 4 steps or fewer away in one direction and a different direction was safer. The model selected the direction of the nearest blocker in 10 of 10.
- When the directions had different distances to a collectible, the model selected the nearest collectible in 27 of 28.
- Example, decision 28: left (blocker 2 steps, collectible 1 step) over right (blocker 9 steps, collectible 6 steps), with a confidence of 0.93.
- The run lost 3 lives.

Limit: in all 10 blocker cases, the nearest collectible was also in the direction of the blocker. The log shows that the collectible distance wins. It does not show that the model ignores the blocker fields.

### The lecture point

- The state contained the blocker distances. The model received them and still moved to the blocker.
- The confidence tells you how sure the model is of its answer to the question as written. It does not tell you that the answer is good for the game.
- The criteria text gave the facts for each direction. It did not say that a near blocker is worse than a far collectible. The model answers the exact words of the question, not the intent.

### What to improve (these are the hackathon levels)

1. Criteria text: put the priority rule in the words. For example: "A direction with a blocker 3 steps or fewer away is a bad move, unless power mode is on."
2. Atomic questions: add a Score question for the danger of each direction. Code applies a threshold and overrides the Choice.
3. State: remove the fields that the criteria text repeats, so that the request is smaller and faster.
4. Outcome loop: use the decision log and the game result to compare two versions of the criteria text. Keep the better version.

## Note 2: where the "reward" goes

Source: public articles, not TypeSafe documents. See `docs/research/jev-research.md`, section 7.

- TypeSafe names the training method RLCD: Reinforcement Learning for Calibrated Decisions.
- RLCD rewards a correct probability on a decision. It does not reward a good result in our game. TypeSafe did not publish the reward function.
- A customer cannot fine-tune Jev. All customers get the same weights.
- The game reward thus goes in three places that we control:
  1. The words: the instructions and the criteria text tell the model what "good" means.
  2. The code: thresholds and rules that combine the answers (the Score override, the fallback policy).
  3. The loop: the decision log plus the game result (collectibles collected, lives kept) is the reward signal. A person or a script uses it to select the better criteria text.
- With an open model, a fourth place exists: train or calibrate the model on logged decisions and results. This does not apply to Jev.

One sentence for the slide: "The model is fixed. The reward is in your question, your code, and your log."

## Note 2a: how to use Note 1 to teach reinforcement learning

Be accurate about the claim. No reinforcement learning occurred in our game. The model did not learn from the maze, and the run used `nimble`, not Jev.

- What Note 1 does not show: how RLCD works, or what Jev learned.
- What Note 1 does show: the central lesson of reinforcement learning, by analogy. A system optimizes the objective that you wrote, not the objective that you intended.
- In reinforcement learning, the objective is the reward function. In our harness, the objective is the question text.
- Our question put "collect all the collectibles" first and gave the blocker rule as a fact with no priority. The model went for the nearest collectible.
- RLCD rewards calibration: a correct probability for the question as written. A model with that reward can be very sure and still lose the game, because the game result was never the reward.
- The real reinforcement loop in the workshop is the outcome loop: change the criteria text, measure collectibles and lives, and keep the better version. The attendee is the learner.

## Note 2b: the real Jev on the baseline (2026-10-02)

Source: `npm run bench`, wait mode, model `jev-1.13.0`. See `docs/HANDOFF.md`, "Benchmark with the real Jev".

- The real Jev did better than `nimble` with the same baseline question. It cleared Chill in 2 of 2 games.
- In one hand-made state, Jev selected the direction with the blocker 12 steps away over the direction with the blocker 3 steps away, at a confidence of 0.74. `nimble` did the opposite.
- On Normal and Spicy, the baseline lost 6 of 6 games.
- On Spicy, each instructor solution beat the baseline: mean points 56.67 to 80.33, against 5.67.
- Lecture consequence: show the Note 1 failure as a `nimble` result, and say so. Use Spicy to show the baseline failure with the real Jev.

## Note 3: speed is a different problem from quality

- `nimble` needed 0.8 to 2.8 seconds for each new state on an Apple M4 Max. A tile takes approximately 149 ms.
- A smaller model (`tev1:0.8b`, not tested) or a smaller state can fix the latency. Neither fixes the decisions in Note 1.
- Ollama reports a lower accuracy for the smaller models: 63.5% for `tev1:0.8b`, 75.7% for `nimble`, and 76.0% for Jev.
