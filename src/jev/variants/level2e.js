// level2d plus one more fact that code calculates. In a level2d loss, the runner had
// 0.1 seconds of power mode left, so "when power mode is on, the blockers are not a
// danger" still applied. Jev moved toward a blocker 1 step away, power mode ended, and
// the runner died. Code now treats power mode with 2 seconds or less left as off.
// Load it with /?jev=1&variant=level2e
export * from "./level2d.js";
import { buildSnapshot as level2dSnapshot, INSTRUCTIONS as LEVEL2D, describeOption as level2dOption } from "./level2d.js";

const POWER_SAFE_SECONDS = 2;
const DANGER_STEPS = 3;
const APPROACH_STEPS = 6;

export function buildSnapshot(scene, tile, heading) {
  const snapshot = level2dSnapshot(scene, tile, heading);
  const left = snapshot.power_seconds_left;
  snapshot.power_safe = left > POWER_SAFE_SECONDS;
  snapshot.power_mode = left === 0
    ? "off"
    : snapshot.power_safe
      ? `on, ${left} seconds left`
      : `ending in ${left} seconds: treat it as off`;
  return snapshot;
}

// The base rule skips corridor requests while any power time remains. Use the same
// 2-second limit, so that code does not walk the runner into a blocker as power mode ends.
const THREAT_STEPS = 4;
export function shouldAsk(snapshot) {
  const names = Object.keys(snapshot.options);
  if (names.length < 2) return false;
  if (snapshot.heading === "stopped" || names.length >= 3) return true;
  if (snapshot.power_safe) return false;
  return names.some((n) => {
    const near = snapshot.options[n].steps_to_blocker;
    return near !== null && near <= THREAT_STEPS;
  });
}

function dangerous(option, snapshot) {
  if (snapshot.power_safe || option.steps_to_blocker === null) return false;
  if (option.steps_to_blocker <= DANGER_STEPS) return true;
  return option.blocker_approaching && option.steps_to_blocker <= APPROACH_STEPS;
}

export const INSTRUCTIONS = {
  ...LEVEL2D,
  steps: LEVEL2D.steps.map((s) =>
    s.startsWith("1.")
      ? "1. When `power_mode` says \"on\", the blockers are not a danger. Choose the direction with the nearest collectible. When it says \"ending\" or \"off\", the blockers are a danger."
      : s,
  ),
};

export function describeOption(name, option, snapshot) {
  return { ...level2dOption(name, option, snapshot), danger: dangerous(option, snapshot) ? "DANGEROUS" : "safe" };
}

export function buildQuestions(snapshot) {
  const criteria = {};
  for (const [name, option] of Object.entries(snapshot.options)) {
    criteria[name] = describeOption(name, option, snapshot);
  }
  return { move: { type: "choice", instructions: INSTRUCTIONS, criteria } };
}
