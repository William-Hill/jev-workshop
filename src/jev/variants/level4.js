// Instructor solution for level 4 (stretch): a Noul for one strategic decision.
// Jev answers "go for the power pellet now?". When the probability is high,
// code selects the direction to the nearest power pellet, unless that direction is deadly.
// Load it with /?jev=1&variant=level4
export * from "./level3.js";
import { buildQuestions as level3Questions, combine as level3Combine, DANGER_THRESHOLD } from "./level3.js";

// A Noul has no confidence field. The value itself is the input to the threshold.
export const POWER_THRESHOLD = 0.7;

export function buildQuestions(snapshot) {
  const questions = level3Questions(snapshot);
  const pellets = Object.values(snapshot.options).some((o) => o.steps_to_power_pellet !== null);
  if (snapshot.power_seconds_left === 0 && pellets) {
    questions.go_for_power = {
      type: "noul",
      instructions: "Must the runner go to the nearest power pellet now, so that it can eat the blockers that chase it?",
      criteria: {
        true: "A blocker is near or approaches the runner, and a power pellet is near.",
        false: "No blocker is near, or all power pellets are far away. Collect the collectibles instead.",
      },
    };
  }
  return questions;
}

export function combine(answers, snapshot) {
  const power = answers.go_for_power;
  if (power && power.noul >= POWER_THRESHOLD) {
    const names = Object.keys(snapshot.options).filter((n) => snapshot.options[n].steps_to_power_pellet !== null);
    names.sort((a, b) => snapshot.options[a].steps_to_power_pellet - snapshot.options[b].steps_to_power_pellet);
    const target = names[0];
    const danger = answers[`danger_${target}`] ? answers[`danger_${target}`].score : 0;
    if (target && danger < DANGER_THRESHOLD) {
      if (target === answers.move.choice) return { choice: target, reason: null };
      return { choice: target, reason: `go_for_power ${power.noul.toFixed(2)}: move to the power pellet ${snapshot.options[target].steps_to_power_pellet} steps away` };
    }
  }
  return level3Combine(answers, snapshot);
}
