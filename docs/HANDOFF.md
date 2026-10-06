# Handoff: Jev integration

Date: 2026-10-02. Start here when you open this repository.

## Goal

A workshop and hackathon in which Jev plays RenderMaze.

- Lecture and demo: 30 minutes maximum.
- Hack time: 60 to 90 minutes.
- The attendees do not build the game. They get a complete Jev player and they change the question and the state.
- The page must show how Jev makes each decision.

## Current state

- The repository contains the complete RenderMaze game and a Jev player in `src/jev/`.
- The Jev player is off by default. Open `/?jev=1` to load it.
- `.env` has a TypeSafe key (2026-10-02). The real Jev answers through the proxy: model `jev-1.13.0`, median latency 166 to 204 ms in the benchmark.
- The game source is `Render-Atlanta/renderatl-demos`, `origin/main` at `67e24415`, path `workshops/render-maze-phaser`.
- `npm test` passes: 24 of 24 Playwright tests (2026-10-02). 13 are the regression tests. 11 are the Jev tests in `tests/jev.spec.js`, which use a mock for `/api/jev`.
- Nothing is committed after `036ec84`.

### Run it

| Command | Result |
|---|---|
| `npm run dev`, then open `/?jev=1` | The game with the Jev panel. |
| `/?jev=1&variant=level3` | The game with the variant `src/jev/variants/level3.js`. |
| `/?jev=1&wait=0` | Real-time play. The game does not stop during a request. |
| `/?jev=1&speed=0.25` | Slow play for the demo. |
| `npm run bench -- --variant level3 --difficulty spicy --games 3` | N headless games and the score. The results go to `bench-results/` (git ignores it). |
- The research is in [`docs/research/jev-research.md`](./research/jev-research.md).
- The repository has no GitHub remote.

### What the Jev player does

| File | Function |
|---|---|
| `src/jev/index.js` | Loads the player only when the URL has `?jev`. |
| `src/jev/snapshot.js` | Builds the state. For each legal direction, code counts the steps to the nearest collectible, blocker, and power pellet. |
| `src/jev/questions.js` | The main attendee edit point: `MODEL`, `MIN_CONFIDENCE`, `buildSnapshot`, `buildQuestions`, `shouldAsk`, and `combine`. |
| `src/jev/variants/level1.js` to `level4.js` | Instructor solutions, one for each hackathon level. A variant replaces any export of `questions.js`. |
| `src/jev/variants.js` | Loads `questions.js` or the variant in the URL. |
| `src/jev/score.js` | The hackathon score. Only collectibles after a Jev or an override decision get points. Each life lost costs 30 points. |
| `scripts/benchmark.mjs` | `npm run bench`. Plays headless games in the wait mode. |
| `src/jev/player.js` | The loop. The hook is `window.__jev` (`log`, `clock`, `score`, `enabled`, `wait`). |
| `src/jev/fallback.js` | The scripted policy. |
| `src/jev/clock.js` | The pause control, the speed control, and the wait mode. It wraps `scene.sys.sceneUpdate` and does not change `src/main.js`. |
| `src/jev/panel.js`, `panel.css`, `arrows.js` | The decision panel and the arrows on the board. |
| `src/jev/proxy.node.js` | The Vite plugin for `POST /api/jev`. It reads `TYPESAFE_API_KEY` from `.env` and adds the `Authorization` header. It returns 503 when the key is not set. |

Decisions in the implementation:

- The player asks Jev at an intersection, when it does not move, and in a corridor when a blocker is 4 steps or fewer away.
- The request starts when the player moves to the decision tile (timing option 2). The player stops at the tile center until the answer arrives.
- The wait mode is on by default. The game stops during each request, so the latency does not change the result. `wait=0` turns it off.
- The state goes to Jev as a JSON object, as the TypeSafe state page recommends.
- Code makes the move in a corridor and at a dead end. The log labels these entries `code`.
- Code uses the fallback policy for a failed request, a timeout (1,500 ms), an answer that is not legal, or a confidence less than 0.2. The log labels these entries `fallback` with the reason.
- When `combine()` changes the move of Jev, the log labels the entry `override` with the reason.
- Code retries a 429 or a 529 response two times, as the TypeSafe API page says.
- Code discards an answer when the player lost a life during the request.

### CORS result (2026-10-02)

A preflight `OPTIONS` request from the origin `http://127.0.0.1:5173` returned HTTP 400 with no `Access-Control-Allow-Origin` header. A browser cannot call `api.typesafe.ai` directly. The proxy is necessary.

## What the game exposes

All code is in `src/main.js`. The scene is available as `window.__scene`.

| Need | Where |
|---|---|
| Grid | `scene.tiles[row][col]`: `#` wall, `.` collectible, `o` power pellet, space for empty. 19 × 19. |
| Player | `scene.player`: `row`, `col`, `dir`, `p` (progress in the tile, 0 to 1) |
| Blockers | `scene.enemies[]`: `row`, `col`, `dir`, `strategy` (`chase`, `patrol`, `wander`), `eatenUntil` |
| Power mode | `scene.powerUntil > scene.time.now` |
| Progress | `scene.score`, `scene.lives`, `scene.left`, `scene.phase` |
| Legal moves | `scene.canMove(row, col, DIRS[name])` |
| Input | `scene.press(name)` or `scene.holdDir(name)`, and `scene.releaseDir(name)`. Names: `up`, `down`, `left`, `right`. |

Movement is held-to-move. The player stops at the next tile center when `scene.heldDir` is `null`.

## The timing constraint

- The player speed is 6.7 tiles each second, which is approximately 149 ms for each tile.
- A Jev request takes approximately 120 ms plus the network time.
- A decision on each tile is thus too slow at the default speed.

Options, in order of preference:

1. Ask for a decision only at an intersection (a tile with 3 or more legal directions) and at a dead end.
2. Ask one tile before the intersection, with the predicted position in the state.
3. Add a speed control for the Jev mode, so that the audience can follow each decision.

Option 3 is also useful for the demo, because slow play makes the panel readable.

## Planned design

```
MazeScene  ──snapshot──▶  jev player  ──POST /api/jev──▶  local proxy  ──▶  api.typesafe.ai
    ▲                         │
    └──── holdDir(name) ──────┤
                              └──▶ decision panel (DOM)
```

1. `src/jev/snapshot.js`: convert the scene to a compact state. This is an attendee edit point.
2. `src/jev/questions.js`: the Choice question and its criteria. This is an attendee edit point.
3. `src/jev/player.js`: the loop. It finds a decision point, calls the proxy, checks the answer, and calls `holdDir`.
4. `src/jev/panel.js`: the decision panel.
5. A local proxy that adds the `Authorization` header. A Vite `server.proxy` entry or a small middleware is sufficient.
6. `src/jev/fallback.js`: a scripted policy for a failed request or a low confidence.

### The decision panel

- The state that the game sent.
- Each direction with a probability bar.
- The chosen direction and the confidence.
- The latency of the request.
- A `FALLBACK` label when code made the decision.
- A pause control, a step control, and a speed control.
- A decision log, with a download as JSONL.
- On the board: four arrows on the player tile, with the opacity set from the probabilities.

### Rules for the integration

- Code filters the options with `canMove` before the request. Jev never gets an illegal option.
- Code rejects an answer that is not in the option set.
- Keep the key out of the browser bundle and out of git. Use `.env`, which `.gitignore` excludes.
- Pin the model version after the first tuning session.
- Keep the 13 regression tests green. The Jev player must be off by default.

## Hackathon levels

1. Change the criteria text to give Jev a play style, for example cautious or greedy.
2. Add fields to the state, for example the distance to each blocker.
3. Add a Score question for danger and a threshold that overrides the Choice.
4. Stretch: add a Noul question, "go for the power pellet now".

The hackathon has no scoring or ranking (decision, 2026-10-02). The "points" number in the panel is only a measure that a team can use to compare its own versions. Use Normal or Spicy. Chill is too easy (see the benchmark below).

A code-only baseline exists: `/?jev=1&variant=code-only` (`src/jev/variants/code-only.js`). The fallback policy makes every decision, and the game sends no request. It beats every Jev version in this maze (see the benchmark below).

## Seeded benchmark (2026-10-04): use these numbers

The earlier maze runs used one fixed seed, so a run repeated a few routes. Use `npm run bench -- --difficulty normal --games 30 --seed 1000`: each game gets its own seed for the "wander" blockers, and each version plays the same games.

| Version | Wins on the same 30 seeds | Mean lives lost |
|---|---|---|
| First question | 6 (20%) | 2.70 |
| `level1` | 4 of 28 (14%) | 2.86 |
| `level2c` | 15 (50%) | 2.00 |
| `level2d` | 20 (67%) | 2.30 |
| `level2e` | 2 (7%) | 2.87 |
| `code-only` | 23 (77%) | 1.47 |

- `level2d` beats the first question (paired exact p = 0.001). `level2c` too (p = 0.035). `level1` does not (p = 0.75).
- `level2d` against `level2c`, and `code-only` against `level2d`, are not significant at 30 games.
- Details and the paired tests: `docs/research/question-design-finding.md`, first section. The fixed-seed tables below are superseded.

## Benchmark with the real Jev (2026-10-02)

The finding that these results support, with outside sources, is in [`docs/research/question-design-finding.md`](./research/question-design-finding.md).

Wait mode, speed 2, 3 games for each row (the Chill row has 2). Model `jev-1.13.0`.

| Variant | Difficulty | Wins | Mean points | Mean lives lost | Mean collectibles left | Fallback (`confidence is less than 0.2`) |
|---|---|---|---|---|---|---|
| baseline (`questions`) | Chill | 2 of 2 | 128.5 | 1 | 0 | 1 |
| baseline | Normal | 0 of 3 | −1 | 3 | 70 | 3 |
| baseline | Spicy | 0 of 3 | 5.67 | 3 | 63 | 4 |
| `level1` | Spicy | 2 of 3 | 59 | 2.33 | 27.67 | 21 |
| `level2` | Spicy | 1 of 3 | 56.67 | 2.67 | 18.33 | 21 |
| `level3` | Spicy | 2 of 3 | 80.33 | 2.33 | 4.67 | 24 |
| `level4` | Spicy | 2 of 3 | 63 | 2.33 | 23.33 | 17 |

- Each level beats the baseline on Spicy. The order between the levels is not reliable with 3 games, because the spread inside one row is large (level4: 94, −3, 98).

Normal, 5 games for each variant (2026-10-02):

| Variant | Wins | Mean points | Mean lives lost | Mean collectibles left |
|---|---|---|---|---|
| baseline | 2 of 5 | 47.8 | 2.2 | 44.8 |
| `level1` | 3 of 5 | 121.4 | 1.2 | 0.8 |
| `level2` | 2 of 5 | 77.2 | 1.8 | 16.8 |
| `level3` | 0 of 5 | 56.6 | 3 | 11.8 |
| `level4` | 3 of 5 | 111 | 1.4 | 3.6 |

- `level1` (words only) is the best Jev variant on Normal.

Larger run on Normal (2026-10-02, after the staff-level review):

| Variant | Games | Wins | Mean lives lost |
|---|---|---|---|
| baseline, all Normal runs | 29 | 6 (21%) | 2.6 |
| `level1`, all Normal runs | 28 | 15 (54%) | 0.8 |
| `code-only`, no Jev | 10 | 10 (100%) | 1.0 |
| `code-only`, Spicy | 5 | 5 (100%) | 2.0 |

- The earlier "6 of 8" for `level1` was a small-sample high. With 28 games, the rate is 54%.
- 7 of the 20 games in the latest `level1` run stopped at the 240-second limit with 1 to 3 items left. In each, the runner circled the top-right corner loop. At the intersection, Jev picked "up" (no item, no blocker) over "down" (items 22 steps away, nearest blocker 9 to 15 steps away), with confidence 0.20 to 0.40. The rule "keep the runner alive first" made "no blocker at all" look best. We tested that fix as `variants/level1b.js` (`level1` plus the rule "When no blocker is 3 steps or fewer away, go toward the nearest collectible."), 20 games on Normal, 2026-10-03:
  - Won 12 of 20 (60%). Mean lives lost 2.05. Time limit: 0 games, so the corner loop is gone.
  - Lost 8 of 20, each at about 33 seconds of game time with 66 to 69 items left. In the logged loss, the runner was caught between two blockers at tiles (5,5) and (5,6): every option had a blocker 1 to 4 steps away.
  - The win rate is close to `level1` (54%). The failure mode moved from "circles a corner" to "dies early in a pincer".
  - The first 13 games ran in a run that hung on game 14; their logs were lost. The benchmark now ends a stuck game after 4 times the game limit in wall time, and `player.js` builds the questions inside the error handling.
- `level2c` (2026-10-04, ranked rules + facts + "keep the current heading" tie-break) won 18 of 20 on Normal with 0.7 lives lost. Its 2 losses came from a number comparison ("farthest blocker").
- `level2e` (2026-10-04, `level2d` + power mode under 2 s counts as off) won only 3 of 50: one near-tie at the start tile flipped, and the near-deterministic maze sent every game into the same trap. All 20-game maze results are dominated by a few routes; see the finding doc.
- `level2d` (2026-10-04) adds one code-calculated fact, the "farthest blocker" mark. It won 18 of 20 with 0.45 lives lost and 7 deaths (`level2c`: 12): the best Jev version. Jev followed the step-3 rule in 44 of 44 cases (`level2c`: 35 of 66).
- Three more versions, 20 games each on Normal (2026-10-03): `level1c` (one ranked list) 14 of 20; `level2b` (`level1b` words + "blocker approaches" fact) 15 of 20; `level1d` (`level1c` words, unsafe directions removed by code) 13 of 20. They are too close to rank. Details in `docs/research/question-design-finding.md`.
- The code-only policy beats every Jev version in this maze. It plays almost the same game each time, so its 10 of 10 is close to one game repeated. The deck now says so: the maze is a teaching harness, not a reason to use Jev in a game.
- `level3` lost each game. The cause is not known. Analyze its overrides before the workshop.
- The first Normal run of `level1` crashed when a file change reloaded the page. The benchmark server now has `hmr: false`, and one failed game no longer stops the run.
- The 3 baseline games on Normal gave the same result. The wait mode thus makes a run repeatable.
- A level game uses 100k to 165k input tokens, which is less than $0.01 at $0.042 for each 1 million.
- The levels send more fallback decisions than the baseline. The structured criteria give lower confidence values. This is a tuning point for `MIN_CONFIDENCE`.

## Start here in the next session (2026-10-06)

The user decided: the main example of the talk moves to RenderATL attendee questions; the maze stays as the backup and the hackathon practice field. Both parts add a System 1 (Jev) to System 2 (an LLM or a code planner) chain.

- Design: `docs/superpowers/specs/2026-10-06-system1-system2-design.md`
- Plan A, the pivot: `docs/superpowers/plans/2026-10-06-ask-agent-system1-system2.md` (6 tasks)
- Plan B, the maze backup: `docs/superpowers/plans/2026-10-06-maze-system2.md` (5 tasks)
- Order: Plan B Task 4 Steps 1, 2, and 4 first (the `/api/llm` route), then Plan A, then the rest of Plan B.
- The user must add `ANTHROPIC_API_KEY` to `.env` before any System 2 or LLM-only run.

## Next steps

Done (2026-10-02): the CORS check, the proxy, the snapshot, the Choice question, the decision panel, the fallback policy, the decision log, the real key, the fair score, the wait mode, the extension points, the instructor solutions, and the benchmark.

1. Find why `level3` loses on Normal. Read its overrides in `bench-results/level3-normal-*.jsonl`.
2. Pin the model version (`jev-1.13.0`) in `src/jev/questions.js` before the workshop.
3. Decide the key plan and test the rate for the room (see the open decisions).
4. Prepare the backup: the local `nimble` model or the mock.
5. Write the attendee guide. The lecture deck is done: [`docs/presentation/change-the-question.html`](./presentation/change-the-question.html) (26 slides: the problem, what Jev is, its limits, how to use it, use cases, and the maze case; speaker notes on the N key).
6. Rehearse the full hackathon with one person outside the project.

## Local test with Ollama (2026-10-02)

Setup: Ollama 0.35.1 on port 11435, model `nimble` (9.5 GB), Apple M4 Max with 36 GB. `.env` has `JEV_UPSTREAM_URL=http://127.0.0.1:11435/v1/systemone` and `JEV_MODEL=nimble`.

- The protocol works. The response has `answers.move.choice`, `confidence`, and `probabilities`, and the endpoint accepts `state` as a string.
- A request with a new state takes 1.3 to 2.8 seconds for 405 to 489 input tokens. Only a repeat of the same request takes approximately 130 ms.
- One game at Chill with the 1,500 ms timeout: 16 requests, 1 Jev decision, 15 `FALLBACK` (`no answer in 1500 ms`). The game was lost with a score of 300.
- `nimble` is thus too slow for play at the default speed on this machine. It is sufficient to test the proxy, the panel, and the log.
- In 2 of 2 different hand-made states, `nimble` selected the direction with the blocker 3 steps away. The confidence was 0.02 to 0.16.

Not tested: `tev1:0.8b`, a smaller state, and a longer timeout with the 0.25× speed.

## Open decisions

- The GitHub owner and the visibility of this repository.
- One key for each attendee, or one shared proxy that the organizer runs.
- The count of attendees, which sets the rate limit risk. The TypeSafe models page gives 80 requests each second and 100K tokens each second, and says that the limits can change without notice.
- The time to get the keys. One report (2026-09-26) says that the console sign-in failed with HTTP 500 for 2 days. Get the keys well before the workshop day.
- Individual work or teams.
