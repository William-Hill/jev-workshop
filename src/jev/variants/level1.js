// Instructor solution for level 1: change the words, not the code.
// The baseline gives the facts for each direction, but no priority between them.
// This version puts the priority rule in the instructions and in each criterion.
// Load it with /?jev=1&variant=level1
export * from "../questions.js";
import { steps } from "../questions.js";

const DANGER_STEPS = 3;

export const INSTRUCTIONS = {
  goal: "Keep the runner alive first. Collect the collectibles second.",
  rules: [
    `When power mode is off, a direction with a blocker ${DANGER_STEPS} steps or fewer away is a bad move, even when a collectible is nearer in that direction.`,
    "When power mode is off and no direction is safe, select the direction with the farthest blocker.",
    "When power mode is on, the blockers are not a danger. Select the direction with the nearest collectible or the nearest blocker.",
    "A reverse move is acceptable when it moves away from a blocker.",
  ],
  question: "Which direction is the best next move for the runner?",
};

export function describeOption(name, option, snapshot) {
  const powered = snapshot.power_seconds_left > 0;
  const danger = !powered && option.steps_to_blocker !== null && option.steps_to_blocker <= DANGER_STEPS;
  return {
    move: name,
    safety: danger ? `DANGER: a blocker is ${option.steps_to_blocker} steps away in this direction.` : "No blocker is near in this direction.",
    nearest_blocker: steps(option.steps_to_blocker),
    nearest_collectible: steps(option.steps_to_collectible),
    collectibles_near: option.collectibles_near,
    nearest_power_pellet: steps(option.steps_to_power_pellet),
    reverses_heading: option.reverses_heading,
  };
}

export function buildQuestions(snapshot) {
  const criteria = {};
  for (const [name, option] of Object.entries(snapshot.options)) {
    criteria[name] = describeOption(name, option, snapshot);
  }
  return { move: { type: "choice", instructions: INSTRUCTIONS, criteria } };
}
