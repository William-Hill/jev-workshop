# Handoff: Jev integration

Date: 2026-10-02. Start here when you open this repository.

## Goal

A workshop and hackathon in which Jev plays RenderMaze.

- Lecture and demo: 30 minutes maximum.
- Hack time: 60 to 90 minutes.
- The attendees do not build the game. They get a complete Jev player and they change the question and the state.
- The page must show how Jev makes each decision.

## Current state

- The repository contains the complete RenderMaze game, and no Jev code.
- The game source is `Render-Atlanta/renderatl-demos`, `origin/main` at `67e24415`, path `workshops/render-maze-phaser`.
- `npm test` passes: 13 of 13 Playwright tests (2026-10-02).
- The research is in [`docs/research/jev-research.md`](./research/jev-research.md).
- The repository has no GitHub remote.

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

Rank the teams by collectibles collected and lives kept.

## Next steps

1. Get a TypeSafe key and put it in `.env` as `TYPESAFE_API_KEY`.
2. Send one `curl` request with a maze state, and record the real latency and the token count.
3. Check the CORS behavior, then build the proxy.
4. Build the snapshot and the Choice question, and run Jev with the panel off.
5. Build the decision panel.
6. Tune the state and the criteria until Jev clears the Chill difficulty.
7. Add the fallback policy and the decision log.
8. Write the attendee guide and the lecture outline.

## Open decisions

- The GitHub owner and the visibility of this repository.
- One key for each attendee, or one shared proxy that the organizer runs.
- The count of attendees, which sets the rate limit risk (1,200 requests each minute for each key, not confirmed).
- Individual work or teams.
