// System 2 as deliberate search: for each option, simulate the runner and the blockers
// for a few steps, and score how long the runner survives and how soon it collects.
// Blockers that chase move one tile toward the runner each step; other blockers keep
// their heading when they can. This is a prediction, not the game code.
import { DIRS } from "../snapshot.js";

const key = (t) => t.row + "," + t.col;

function stepToward(scene, from, target) {
  let best = null;
  for (const d of Object.values(DIRS)) {
    if (!scene.canMove(from.row, from.col, d)) continue;
    const n = { row: from.row + d.row, col: from.col + d.col };
    const dist = Math.abs(n.row - target.row) + Math.abs(n.col - target.col);
    if (!best || dist < best.dist) best = { n, dist };
  }
  return best ? best.n : from;
}

function stepAhead(scene, b) {
  if (b.dir && scene.canMove(b.row, b.col, b.dir)) return { row: b.row + b.dir.row, col: b.col + b.dir.col, dir: b.dir };
  for (const d of Object.values(DIRS)) if (scene.canMove(b.row, b.col, d)) return { row: b.row + d.row, col: b.col + d.col, dir: d };
  return b;
}

export function planMove(scene, tile, options, horizon = 8) {
  const now = scene.time.now;
  const blockers0 = scene.enemies.filter((e) => !(e.eatenUntil > now)).map((e) => ({ row: e.row, col: e.col, dir: e.dir, chase: e.strategy === "chase" }));
  const powered = scene.powerUntil > now;
  const scores = {};
  for (const name of options) {
    let runner = { row: tile.row + DIRS[name].row, col: tile.col + DIRS[name].col };
    let heading = DIRS[name];
    let blockers = blockers0.map((b) => ({ ...b }));
    let survived = 0, collected = 0;
    const eaten = new Set();
    for (let s = 1; s <= horizon; s++) {
      blockers = blockers.map((b) => (b.chase ? { ...stepToward(scene, b, runner), chase: true } : { ...stepAhead(scene, b), chase: false }));
      if (!powered && blockers.some((b) => b.row === runner.row && b.col === runner.col)) break;
      survived = s;
      const ch = scene.tiles[runner.row][runner.col];
      if ((ch === "." || ch === "o") && !eaten.has(key(runner))) { collected++; eaten.add(key(runner)); }
      // The runner keeps its heading; at a wall it turns to the first open direction that is not a reverse.
      if (!scene.canMove(runner.row, runner.col, heading)) {
        heading = Object.values(DIRS).find((d) => scene.canMove(runner.row, runner.col, d) && !(d.row === -heading.row && d.col === -heading.col)) || heading;
      }
      if (scene.canMove(runner.row, runner.col, heading)) runner = { row: runner.row + heading.row, col: runner.col + heading.col };
    }
    scores[name] = survived * 10 + collected;
  }
  const choice = options.slice().sort((a, b) => scores[b] - scores[a])[0];
  return { choice, reason: `look-ahead ${horizon} steps: ${options.map((o) => `${o} ${scores[o]}`).join(", ")}`, scores };
}
