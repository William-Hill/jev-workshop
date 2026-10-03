// Idea 4: move the exact safety rule into code.
// "A blocker 3 steps or fewer away is a bad move" is an exact rule with a number,
// so code applies it: code removes those directions before the request, unless
// every direction has such a blocker. Jev chooses among the rest with the level1c words.
// CODE DECISION: the removed directions are listed in the state as removed_by_code.
// Load it with /?jev=1&variant=level1d
export * from "./level1c.js";
import { buildSnapshot as baseSnapshot } from "../snapshot.js";
import { shouldAsk as baseShouldAsk } from "../questions.js";

// When code removed a direction and two or more remain, Jev must choose. Without this,
// the base rule can skip the request and code would pick one of the remaining directions.
export function shouldAsk(snapshot) {
  if (snapshot.removed_by_code && Object.keys(snapshot.options).length >= 2) return true;
  return baseShouldAsk(snapshot);
}

const DANGER_STEPS = 3;

export function buildSnapshot(scene, tile, heading) {
  const snapshot = baseSnapshot(scene, tile, heading);
  if (snapshot.power_seconds_left > 0) return snapshot;
  const names = Object.keys(snapshot.options);
  const deadly = names.filter((n) => {
    const b = snapshot.options[n].steps_to_blocker;
    return b !== null && b <= DANGER_STEPS;
  });
  if (deadly.length === 0 || deadly.length === names.length) return snapshot;
  for (const n of deadly) delete snapshot.options[n];
  snapshot.removed_by_code = deadly;
  return snapshot;
}
