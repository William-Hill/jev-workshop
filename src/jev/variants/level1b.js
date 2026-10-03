// Level 1 plus one rule. In level 1, Jev sometimes circled a corner loop with no
// item and no blocker, because "keep the runner alive first" made "no blocker at all"
// look best. This version adds the missing rule for the safe case.
// Load it with /?jev=1&variant=level1b
export * from "./level1.js";
import { INSTRUCTIONS as LEVEL1, describeOption } from "./level1.js";

export const INSTRUCTIONS = {
  ...LEVEL1,
  rules: [
    ...LEVEL1.rules,
    "When no blocker is 3 steps or fewer away, go toward the nearest collectible.",
  ],
};

export function buildQuestions(snapshot) {
  const criteria = {};
  for (const [name, option] of Object.entries(snapshot.options)) {
    criteria[name] = describeOption(name, option, snapshot);
  }
  return { move: { type: "choice", instructions: INSTRUCTIONS, criteria } };
}
