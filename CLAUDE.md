# render-maze-jev

RenderMaze (Phaser 3 + Vite) plus a Jev player, for a RenderATL workshop and hackathon.

- Read [`docs/HANDOFF.md`](./docs/HANDOFF.md) first. It has the goal, the current state, and the next steps.
- The Jev facts and the public examples are in [`docs/research/jev-research.md`](./docs/research/jev-research.md).
- The game is one file: `src/main.js`. The scene is `window.__scene`.

## Commands

```sh
npm install
npm run dev      # dev server
npm test         # Playwright regression tests, port 4180, one worker
```

## Rules

- Keep the regression tests green. The Jev player must be off by default.
- Keep `TYPESAFE_API_KEY` in `.env` only. Do not commit `.env`. Do not put the key in browser code.
- Keep the game rules unchanged. Jev code goes in `src/jev/`.
- Label each decision that code made in place of Jev.
