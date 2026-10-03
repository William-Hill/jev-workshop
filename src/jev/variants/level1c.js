// Idea 1: one ranked list in place of separate rules.
// In level1 and level1b the rules can conflict, and Jev must guess which one wins.
// This version gives the order explicitly. The facts are the same as level1.
// Load it with /?jev=1&variant=level1c
export * from "./level1.js";
import { describeOption } from "./level1.js";

export const INSTRUCTIONS = {
  goal: "Keep the runner alive. Collect all the collectibles.",
  steps: [
    "Choose by these steps, in order.",
    "1. Do not choose a direction with a blocker 3 steps or fewer away, unless all directions have one. Then choose the direction with the farthest blocker.",
    "2. Do not choose a direction with no collectibles, unless all remaining directions have none.",
    "3. Of the remaining directions, choose the one with the nearest collectible.",
  ],
  power_mode: "When power mode is on, skip step 1. The blockers are not a danger.",
  question: "Which direction is the best next move for the runner?",
};

export function buildQuestions(snapshot) {
  const criteria = {};
  for (const [name, option] of Object.entries(snapshot.options)) {
    criteria[name] = describeOption(name, option, snapshot);
  }
  return { move: { type: "choice", instructions: INSTRUCTIONS, criteria } };
}
