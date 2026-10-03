// Point test: constructed states x criteria variants x N repeats.
import fs from "node:fs";
import { ask, createWorld, VARIANTS, log } from "./harness.mjs";

const N = Number(process.env.N ?? 5);
const world = createWorld({ seed: 42, villagers: 1 });
// Villager placed at the plaza-ish center so distances are moderate.
const base = { id: 7, x: 30, y: 12 };
const CASES = {
  "03h_hunger0": { tick: 30, hunger: 0, energy: 60, mood: 60 },
  "22h_hunger30": { tick: 220, hunger: 30, energy: 50, mood: 60 },
};
const rows = [];
for (const [cname, c] of Object.entries(CASES)) {
  const w = { ...world, tick: c.tick };
  const v = { ...base, hunger: c.hunger, energy: c.energy, mood: c.mood };
  for (const [vname, V] of Object.entries(VARIANTS)) {
    const state = V.d(v, w);
    for (let i = 0; i < N; i++) {
      const { data, ms } = await ask(state, V.q, `point:${cname}:${vname}`);
      const a = data.answers?.action ?? {};
      rows.push({ case: cname, variant: vname, i, choice: a.choice, conf: a.confidence, probs: a.probabilities,
        urgency: data.answers?.urgency?.score, model: data.model, usage: data.usage, ms });
      console.log(cname, vname, i, a.choice, JSON.stringify(a.probabilities), ms + "ms", data.model, JSON.stringify(data.usage));
    }
  }
}
fs.writeFileSync(new URL("./point-results.json", import.meta.url), JSON.stringify(rows, null, 1));
log.end();
