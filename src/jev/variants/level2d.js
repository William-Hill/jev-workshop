// level2c plus one fact that code calculates. Both level2c losses came from step 3:
// all directions were dangerous, and Jev picked the nearer blocker, not the farthest one.
// That is a number comparison (TypeSafe failure mode 2), so code now marks the direction
// with the farthest blocker. Everything else is the same as level2c.
// Load it with /?jev=1&variant=level2d
export * from "./level2c.js";
import { buildSnapshot as level2Snapshot } from "./level2.js";
import { INSTRUCTIONS as LEVEL2C, describeOption as level2cOption } from "./level2c.js";

export function buildSnapshot(scene, tile, heading) {
  const snapshot = level2Snapshot(scene, tile, heading);
  const names = Object.keys(snapshot.options);
  // A direction with no blocker counts as the farthest. Ties are all marked.
  const far = (n) => (snapshot.options[n].steps_to_blocker === null ? Infinity : snapshot.options[n].steps_to_blocker);
  const max = Math.max(...names.map(far));
  for (const n of names) snapshot.options[n].farthest_blocker = far(n) === max;
  return snapshot;
}

export const INSTRUCTIONS = {
  ...LEVEL2C,
  steps: LEVEL2C.steps.map((s) =>
    s.startsWith("3.")
      ? "3. When all directions are dangerous, choose the direction marked \"farthest blocker\". When more than one has that mark, keep the current heading."
      : s,
  ),
};

export function describeOption(name, option, snapshot) {
  return {
    ...level2cOption(name, option, snapshot),
    farthest: option.farthest_blocker ? "farthest blocker" : "not the farthest blocker",
  };
}

export function buildQuestions(snapshot) {
  const criteria = {};
  for (const [name, option] of Object.entries(snapshot.options)) {
    criteria[name] = describeOption(name, option, snapshot);
  }
  return { move: { type: "choice", instructions: INSTRUCTIONS, criteria } };
}
