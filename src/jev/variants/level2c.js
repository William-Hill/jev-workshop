// Combines the best parts of level2b and level1c, and fixes two patterns from their logs:
// 1. Dithering: in a corridor with blockers at both ends, Jev turned back and forth on
//    consecutive tiles, and the runner stayed in place until a blocker reached it.
// 2. Ties: many fatal choices were between equal dangers, and no rule broke the tie.
// Changes: the level2b facts (blocker_approaching), one ranked list, "keep the current
// heading" as the tie-break, and plain words in place of "none".
// Load it with /?jev=1&variant=level2c
export * from "./level2.js";

const DANGER_STEPS = 3;
const APPROACH_STEPS = 6;

function dangerous(option, snapshot) {
  if (snapshot.power_seconds_left > 0 || option.steps_to_blocker === null) return false;
  if (option.steps_to_blocker <= DANGER_STEPS) return true;
  return option.blocker_approaching && option.steps_to_blocker <= APPROACH_STEPS;
}

export const INSTRUCTIONS = {
  goal: "Keep the runner alive. Collect all the collectibles.",
  steps: [
    "Choose by these steps, in order.",
    "1. When power mode is on, the blockers are not a danger. Choose the direction with the nearest collectible.",
    "2. A direction is dangerous when its blocker is 3 steps or fewer away, or 6 steps or fewer away and moves toward the runner. Do not choose a dangerous direction, unless all directions are dangerous.",
    "3. When all directions are dangerous, choose the direction with the farthest blocker. When the blockers are equally far, keep the current heading.",
    "4. Do not choose a direction with no collectibles left, unless all remaining directions have none.",
    "5. Of the remaining directions, choose the one with the nearest collectible. When two are equally near, keep the current heading.",
  ],
  question: "Which direction is the best next move for the runner?",
};

export function describeOption(name, option, snapshot) {
  return {
    move: name,
    heading: option.reverses_heading ? "This move reverses the current heading." : "This move keeps the current heading or turns.",
    danger: dangerous(option, snapshot) ? "DANGEROUS" : "safe",
    blocker: option.steps_to_blocker === null
      ? "No blocker on this path."
      : `Nearest blocker: ${option.steps_to_blocker} steps${option.blocker_approaching ? ", and it moves toward the runner" : ""}.`,
    collectibles: option.steps_to_collectible === null
      ? "No collectibles left in this direction."
      : `Nearest collectible: ${option.steps_to_collectible} steps. Collectibles within 5 steps: ${option.collectibles_near}.`,
  };
}

export function buildQuestions(snapshot) {
  const criteria = {};
  for (const [name, option] of Object.entries(snapshot.options)) {
    criteria[name] = describeOption(name, option, snapshot);
  }
  return { move: { type: "choice", instructions: INSTRUCTIONS, criteria } };
}
