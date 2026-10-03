// Instructor solution for level 2: add facts to the state.
// Code calculates each fact. Jev counts badly, so the state gives the numbers.
// New fields for each direction:
//   blocker_approaching   the nearest blocker moves toward the decision tile
//   blockers_within_6     the count of blockers 6 steps or fewer away in this direction
// Load it with /?jev=1&variant=level2
export * from "./level1.js";
import { buildSnapshot as baseSnapshot, activeBlockers, distance, look, tileKey, DIRS } from "../snapshot.js";
import { describeOption as level1Option } from "./level1.js";

const NEAR = 6;

export function buildSnapshot(scene, tile, heading) {
  const snapshot = baseSnapshot(scene, tile, heading);
  const active = activeBlockers(scene);
  const blockerTiles = new Set(active.map(tileKey));

  for (const name of Object.keys(snapshot.options)) {
    const seen = look(scene, tile, name, blockerTiles);
    const option = snapshot.options[name];
    option.blocker_approaching = false;
    if (seen.blockerTile) {
      const blocker = active.find((e) => e.row === seen.blockerTile.row && e.col === seen.blockerTile.col);
      if (blocker && blocker.dir) {
        const next = { row: blocker.row + blocker.dir.row, col: blocker.col + blocker.dir.col };
        const now = distance(scene, seen.blockerTile, tile);
        const then = distance(scene, next, tile);
        option.blocker_approaching = now !== null && then !== null && then < now;
      }
    }
    // Count the blockers whose shortest path to the tile starts in this direction.
    const first = { row: tile.row + DIRS[name].row, col: tile.col + DIRS[name].col };
    option.blockers_within_6 = active.filter((e) => {
      const d = distance(scene, first, e);
      return d !== null && d + 1 <= NEAR && d + 1 === distance(scene, tile, e);
    }).length;
  }
  return snapshot;
}

export function describeOption(name, option, snapshot) {
  return {
    ...level1Option(name, option, snapshot),
    blocker_approaching: option.blocker_approaching
      ? "Yes: the nearest blocker in this direction moves toward the runner."
      : "No",
    blockers_within_6_steps: option.blockers_within_6,
  };
}

export function buildQuestions(snapshot) {
  const criteria = {};
  for (const [name, option] of Object.entries(snapshot.options)) {
    criteria[name] = describeOption(name, option, snapshot);
  }
  return {
    move: {
      type: "choice",
      instructions: {
        goal: "Keep the runner alive first. Collect the collectibles second.",
        rules: [
          "When power mode is off, a direction with a blocker 3 steps or fewer away is a bad move.",
          "When power mode is off, a direction with an approaching blocker 6 steps or fewer away is a bad move.",
          "When power mode is off and no direction is safe, select the direction with the farthest blocker.",
          "When power mode is on, the blockers are not a danger.",
        ],
        question: "Which direction is the best next move for the runner?",
      },
      criteria,
    },
  };
}
