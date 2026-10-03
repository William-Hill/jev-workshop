// Instructor solution for level 3: an atomic question and a rule in code.
// Jev rates the danger of each direction with a Score. Code applies a threshold:
// when the move of Jev is dangerous and a safer direction exists, code overrides it.
// The panel and the log label each override.
// Load it with /?jev=1&variant=level3
export * from "./level2.js";
import { buildQuestions as level2Questions } from "./level2.js";

// A danger score at or above this value blocks a direction. Tune it on your logs.
export const DANGER_THRESHOLD = 1.0;

const DANGER_LEVELS = [
  "Safe: no blocker is on this path within 6 steps, or power mode is on.",
  "Risky: a blocker is on this path 4 to 6 steps away, or it moves away from the runner.",
  "Deadly: a blocker is on this path 3 steps or fewer away, or it is 6 steps or fewer away and approaches the runner.",
];

export function buildQuestions(snapshot) {
  const questions = level2Questions(snapshot);
  // One Score for each legal direction. Jev does not see the key, so the
  // instructions name the direction and the state path.
  for (const name of Object.keys(snapshot.options)) {
    questions[`danger_${name}`] = {
      type: "score",
      instructions: `How dangerous is a move ${name} for the runner now? Use \`options.${name}\` and \`power_seconds_left\` in the state.`,
      criteria: DANGER_LEVELS,
    };
  }
  return questions;
}

export function combine(answers, snapshot) {
  const move = answers.move;
  const danger = (name) => (answers[`danger_${name}`] ? answers[`danger_${name}`].score : 0);
  if (snapshot.power_seconds_left > 0 || danger(move.choice) < DANGER_THRESHOLD) {
    return { choice: move.choice, reason: null };
  }
  // The move of Jev is dangerous. Use the safest direction; on a tie, the higher move probability.
  const ranked = Object.keys(snapshot.options).sort(
    (a, b) => danger(a) - danger(b) || (move.probabilities[b] || 0) - (move.probabilities[a] || 0),
  );
  const best = ranked[0];
  if (danger(best) >= danger(move.choice)) return { choice: move.choice, reason: null };
  return {
    choice: best,
    reason: `danger ${danger(move.choice).toFixed(2)} for ${move.choice} is at or above ${DANGER_THRESHOLD}; ${best} has ${danger(best).toFixed(2)}`,
  };
}
