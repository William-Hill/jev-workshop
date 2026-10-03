// Convert the scene to the compact state that Jev reads.
// ATTENDEE EDIT POINT (level 2): add fields to the state in buildSnapshot.
//
// Jev counts badly. Count in code, and send the number.

export const DIRS = {
  up: { row: -1, col: 0 },
  down: { row: 1, col: 0 },
  left: { row: 0, col: -1 },
  right: { row: 0, col: 1 },
};
export const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };

// The count of steps that "near" means for the collectible count.
const NEAR_STEPS = 5;

export const tileKey = (t) => t.row + "," + t.col;

// The blockers that can touch the runner now. An eaten blocker waits at its spawn tile.
export function activeBlockers(scene) {
  const now = scene.time.now;
  return scene.enemies.filter((e) => !(e.eatenUntil > now));
}

export function dirName(d) {
  if (!d) return null;
  return Object.keys(DIRS).find((n) => DIRS[n].row === d.row && DIRS[n].col === d.col) || null;
}

// The directions that the game permits from a tile. Jev gets only these options.
export function legalMoves(scene, row, col) {
  return Object.keys(DIRS).filter((name) => scene.canMove(row, col, DIRS[name]));
}

// The count of steps on the shortest path from `from` to `to`, or null.
export function distance(scene, from, to) {
  const seen = new Set([tileKey(from)]);
  let frontier = [from];
  for (let steps = 0; frontier.length; steps++) {
    const next = [];
    for (const t of frontier) {
      if (t.row === to.row && t.col === to.col) return steps;
      for (const d of Object.values(DIRS)) {
        if (!scene.canMove(t.row, t.col, d)) continue;
        const n = { row: t.row + d.row, col: t.col + d.col };
        if (seen.has(tileKey(n))) continue;
        seen.add(tileKey(n));
        next.push(n);
      }
    }
    frontier = next;
  }
  return null;
}

// Breadth-first search from `tile` through the first step `name`.
// The search does not go back through `tile`. A step count of null means "not found".
export function look(scene, tile, name, blockerTiles) {
  const first = { row: tile.row + DIRS[name].row, col: tile.col + DIRS[name].col };
  const seen = new Set([tileKey(tile), tileKey(first)]);
  const found = { collectible: null, power: null, blocker: null, blockerTile: null, near: 0 };
  let frontier = [first];
  for (let steps = 1; frontier.length; steps++) {
    const next = [];
    for (const t of frontier) {
      const ch = scene.tiles[t.row][t.col];
      if (ch === ".") {
        if (found.collectible === null) found.collectible = steps;
        if (steps <= NEAR_STEPS) found.near += 1;
      }
      if (ch === "o" && found.power === null) found.power = steps;
      if (found.blocker === null && blockerTiles.has(tileKey(t))) { found.blocker = steps; found.blockerTile = t; }
      for (const d of Object.values(DIRS)) {
        if (!scene.canMove(t.row, t.col, d)) continue;
        const n = { row: t.row + d.row, col: t.col + d.col };
        if (seen.has(tileKey(n))) continue;
        seen.add(tileKey(n));
        next.push(n);
      }
    }
    frontier = next;
  }
  return found;
}

// `tile` is the tile where the player makes the decision.
// `heading` is the direction of arrival, or null when the player does not move.
export function buildSnapshot(scene, tile, heading) {
  const now = scene.time.now;
  const active = activeBlockers(scene);
  const blockerTiles = new Set(active.map(tileKey));

  const options = {};
  for (const name of legalMoves(scene, tile.row, tile.col)) {
    const seen = look(scene, tile, name, blockerTiles);
    options[name] = {
      steps_to_collectible: seen.collectible,
      collectibles_near: seen.near,
      steps_to_blocker: seen.blocker,
      steps_to_power_pellet: seen.power,
      reverses_heading: heading !== null && name === OPPOSITE[heading],
    };
  }

  return {
    tile: { row: tile.row, col: tile.col },
    heading: heading || "stopped",
    power_seconds_left: Math.max(0, Math.round((scene.powerUntil - now) / 100) / 10),
    lives: scene.lives,
    collectibles_left: scene.left,
    options,
    blockers: active.map((e) => ({
      row: e.row,
      col: e.col,
      behavior: e.strategy,
      heading: dirName(e.dir) || "stopped",
    })),
  };
}
