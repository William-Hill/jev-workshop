// level2d with System 2 as a code planner. When the escalation rule fires, code looks
// ahead 8 steps for each option and picks the safest one.
// Load it with /?jev=1&variant=level2d-s2search
export * from "./level2d.js";
export { shouldEscalate } from "./escalate.js";
import { planMove } from "../system2/search.js";

export async function system2(snapshot, scene) {
  const r = planMove(scene, snapshot.tile, Object.keys(snapshot.options), 8);
  return { choice: r.choice, reason: r.reason, model: "code look-ahead" };
}
