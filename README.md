# RenderMaze + Jev

RenderMaze is a Pac-Man-style maze runner on the RenderATL brand.
This repository is the base for a workshop and hackathon in which Jev, the System One model from TypeSafe AI, plays the game.

- Start with [`docs/HANDOFF.md`](./docs/HANDOFF.md) for the goal, the current state, and the next steps.
- The Jev research is in [`docs/research/jev-research.md`](./docs/research/jev-research.md).
- The repository contains the complete game and a Jev player in `src/jev/`.
- The Jev player is off by default. Copy `.env.example` to `.env`, add the key, run `npm run dev`, and open `/?jev=1`.

The game source is `Render-Atlanta/renderatl-demos`, path `workshops/render-maze-phaser`, `main` at `67e24415`.

## The game

A held-to-move, Pac-Man-style maze runner with sprite collectibles and juice,
on the RenderATL brand.

This app is a **1:1 recreation of the Claude Design `RenderMaze-Phaser.html`
spec** (claude.ai/design → `render-maze-phaser-ui-improvements`). The design's
standalone, CDN-Phaser prototype was ported into this Vite + Phaser project:

- `phaser` is imported from npm instead of a CDN `<script>`.
- Asset paths (`assets/*`) are routed through Vite's `import.meta.glob` pipeline.
- The game's maze layout, themes, difficulty curve, effects, and UI logic are
  reproduced verbatim from the design in `src/main.js`.

> Note: this build is driven by the design's own inlined maze/theme/constants,
> not the shared `render-maze-final` config — the design is the source of truth.

## Run

```sh
npm install
npm run dev
```

## What's implemented (from the design)

- Title screen with theme switcher (Workshop Specs ↔ Atlanta Wing Run) and
  difficulty (Chill / Normal / Spicy)
- Held-to-move movement: the player advances only while a key/D-pad button is
  held, finishes the current tile on release, and stops (no drift). Instant
  reverse supported.
- Sprite collectibles (crispy wings / spec cards) with an "eat" pop on every
  pickup; power pellets (lemon-pepper wet / approved spec) with a bigger pop
  and camera flash
- Power mode: "Turnt Up / Approved" depleting timer bar, scared-teal blocker
  tokens, gold power ring, end-of-power blink, eat-combo scoring (100→800)
- Unified blocker tokens — cream chips with color-coded borders, opaque so they
  read clearly over collectibles in every state
- HUD (Score, Wings/Specs Left, Lives as RenderMan icons, Mode), legend that
  swaps with the theme, marquee, RENDER MAZE display branding
- READY countdown, lives, win/lose/pause payoff screens, persistent best score
- Touch D-pad, keyboard (Arrows/WASD), Space to pause, and reduced-motion support

## Test

Deterministic Playwright regression suite. Each test boots the production
bundle and drives the running game through the in-page `window.__scene` API,
asserting on synchronous game state (no reliance on rAF / wall-clock timing):

```sh
npm test
```

Coverage: clean boot, held-to-move stop-on-release, instant reverse, regular &
power pickups, power-mode eat/combo, life loss & loss state, win state, pause
toggle, theme swap (labels/deck/legend), difficulty selection, and wall blocking.

## Build note

`vite.config.js` sets `build.assetsInlineLimit: 0`. Vite would otherwise inline
the small SVG sprites as data URIs, which Phaser's SVG loader base64-decodes and
rejects — boot fails in the production bundle (the dev server is unaffected
because it serves real file URLs). Keeping every asset as a fetchable file URL
makes dev and the bundle behave identically.

