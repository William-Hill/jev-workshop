// The escalation rule for the maze: code decides when System 2 takes the decision.
// 1. Jev is unsure: the confidence of "move" is below LOW_CONFIDENCE.
// 2. Every direction is dangerous (power mode off), so a mistake costs a life.
export const LOW_CONFIDENCE = 0.5;

function dangerous(option, snapshot) {
  if (snapshot.power_seconds_left > 0 || option.steps_to_blocker === null) return false;
  if (option.steps_to_blocker <= 3) return true;
  return option.blocker_approaching && option.steps_to_blocker <= 6;
}

export function shouldEscalate(answers, snapshot) {
  const names = Object.keys(snapshot.options);
  if (names.length < 2) return { escalate: false, why: "" };
  if (answers.move.confidence < LOW_CONFIDENCE) return { escalate: true, why: `Jev confidence ${answers.move.confidence} is below ${LOW_CONFIDENCE}` };
  if (names.every((n) => dangerous(snapshot.options[n], snapshot))) return { escalate: true, why: "every direction is dangerous" };
  return { escalate: false, why: "" };
}
