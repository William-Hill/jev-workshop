// Idea 2: give Jev the fact it is missing.
// level1b took the runner into a pincer: two blockers closed in from both sides.
// This version uses the level1b words plus the level2 facts (blocker_approaching),
// and it counts an approaching blocker 6 steps or fewer away as a danger.
// Load it with /?jev=1&variant=level2b
export * from "./level2.js";
import { describeOption as level2Option } from "./level2.js";
import { INSTRUCTIONS as LEVEL1B } from "./level1b.js";

const DANGER_STEPS = 3;
const APPROACH_STEPS = 6;

function dangerous(option, snapshot) {
  if (snapshot.power_seconds_left > 0 || option.steps_to_blocker === null) return false;
  if (option.steps_to_blocker <= DANGER_STEPS) return true;
  return option.blocker_approaching && option.steps_to_blocker <= APPROACH_STEPS;
}

export function describeOption(name, option, snapshot) {
  const base = level2Option(name, option, snapshot);
  return {
    ...base,
    safety: dangerous(option, snapshot)
      ? `DANGER: a blocker is ${option.steps_to_blocker} steps away in this direction${option.blocker_approaching ? " and it moves toward the runner" : ""}.`
      : "No dangerous blocker in this direction.",
  };
}

export const INSTRUCTIONS = {
  ...LEVEL1B,
  rules: [
    "When power mode is off, a direction with a blocker 3 steps or fewer away is a bad move, even when a collectible is nearer in that direction.",
    "When power mode is off, a direction with a blocker 6 steps or fewer away that moves toward the runner is also a bad move.",
    ...LEVEL1B.rules.slice(1),
  ],
};

export function buildQuestions(snapshot) {
  const criteria = {};
  for (const [name, option] of Object.entries(snapshot.options)) {
    criteria[name] = describeOption(name, option, snapshot);
  }
  return { move: { type: "choice", instructions: INSTRUCTIONS, criteria } };
}
