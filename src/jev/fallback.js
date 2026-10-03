// The scripted policy. Code uses it when a request fails, when the answer is
// not a legal option, or when the confidence is low.
// The panel and the log label each of these decisions as FALLBACK.

const DANGER_STEPS = 3;

function value(option, powered) {
  let v = 0;
  if (!powered && option.steps_to_blocker !== null && option.steps_to_blocker <= DANGER_STEPS) {
    v -= 100 - option.steps_to_blocker;
  }
  v -= option.steps_to_collectible === null ? 50 : option.steps_to_collectible;
  if (option.reverses_heading) v -= 0.5;
  return v;
}

export function fallbackMove(snapshot) {
  const powered = snapshot.power_seconds_left > 0;
  let best = null;
  for (const [name, option] of Object.entries(snapshot.options)) {
    const v = value(option, powered);
    if (best === null || v > best.v) best = { name, v };
  }
  return best ? best.name : null;
}
