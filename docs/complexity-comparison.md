# Implementation Notes & Line Count

This build is the 1:1 Phaser recreation of the Claude Design
`RenderMaze-Phaser.html` prototype (750 lines, single self-contained file with
inlined CSS/JS and CDN Phaser). Porting it into the Vite + Phaser project
splits that one file into the standard project shape.

## Line Count

| Area | Design prototype (1 file) | This port | Notes |
| --- | ---: | ---: | --- |
| HTML | inlined `<body>` | 122 | DOM shell: marquee, HUD, overlays, legend, controls, D-pad. Adds Google Fonts links + module `<script>`. |
| CSS | inlined `<style>` | 73 | Design styles, verbatim, moved to `styles.css`. |
| Main game JS | inlined `<script>` | 571 | `MazeScene` + `UI` controller, verbatim, plus the npm `Phaser` import and the `import.meta.glob` asset resolver. |
| Vite config | n/a | 25 | Bundle output + `assetsInlineLimit: 0` (see README build note). |
| Playwright suite | n/a | 249 | Deterministic regression spec (`tests/regression.spec.js`). |

The gameplay logic, constants, and styles are reproduced from the design without
behavioral changes; the only edits are the two integration seams (CDN → npm
Phaser import, and `assets/*` → Vite asset URLs).

## What Phaser Owns

- Game loop and scene lifecycle (no custom `requestAnimationFrame`).
- Display list — player, collectibles, blocker tokens, halos, FX — as game
  objects with `setDepth()` layering.
- Tweens (eat pops, score floats, win confetti) and camera flash/shake.
- SVG + PNG texture loading.

## What The App Code Owns

- Maze state, held-to-move movement and wall checks, blocker strategies
  (chase/patrol/wander), collision outcomes, power mode, eat combos.
- Lives, win/lose, pause, restart, READY countdown, persistent best score.
- Theme-specific collectibles, blockers, labels, deck copy, and legend.
- DOM HUD/overlay/legend rendering and keyboard / touch-D-pad input via the
  `UI` controller.

## Verification

Regression coverage lives in the Playwright suite (run `npm test`), which drives
the live game through `window.__scene` and asserts on synchronous state, so it
does not depend on rAF/wall-clock timing. See the README "Test" section.

## Workshop Takeaway

This is the full Phaser reference. The teaching skeleton should be derived from
it by removing most complete gameplay logic and keeping the project shell, asset
loading, theme/maze data, a scene scaffold, and specs/TODO prompts for movement,
walls, collectibles, blockers, power mode, and success criteria.
