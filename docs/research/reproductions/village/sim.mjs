// Short headless sim with the project's world.js stepWorld. Jev via api.typesafe.ai.
// Same seeds for both variants. Per-request error -> offline rule (as in the project), counted.
import fs from "node:fs";
import { ask, createWorld, VARIANTS, log } from "./harness.mjs";
import { stepWorld, rng, hourOf } from "./src/lib/world.js";
import { makeOfflineBrain } from "./src/lib/brain-offline.js";

const VILLAGERS = Number(process.env.VILLAGERS ?? 10);
const START = Number(process.env.START_TICK ?? 200); // 20:00
const TICKS = Number(process.env.TICKS ?? 80); // to 04:00
const CONC = 8;
const OFFLINE = makeOfflineBrain();
const out = {};
for (const vname of (process.env.VARIANTS ?? "A_vague_oldstate,B_explicit_newstate").split(",")) {
  const V = VARIANTS[vname];
  const world = createWorld({ seed: 42, villagers: VILLAGERS });
  world.tick = START;
  const rand = rng(7);
  const byHour = {};
  let degraded = 0, calls = 0, tokens = 0, msSum = 0;
  for (let t = 0; t < TICKS; t++) {
    const ds = new Array(world.people.length);
    let next = 0;
    await Promise.all(Array.from({ length: CONC }, async () => {
      while (next < world.people.length) {
        const i = next++;
        const v = world.people[i];
        try {
          const { data, ms } = await ask(V.d(v, world), V.q, `sim:${vname}:t${world.tick}`);
          const a = data.answers.action;
          ds[i] = { id: v.id, action: a.choice, confidence: a.confidence, probs: a.probabilities };
          calls++; tokens += data.usage?.input_tokens ?? 0; msSum += ms;
        } catch (e) {
          degraded++;
          ds[i] = (await OFFLINE.decideBatch([v], world))[0];
        }
      }
    }));
    const h = hourOf(world.tick);
    byHour[h] ??= { work: 0, eat: 0, sleep: 0, socialize: 0, wander: 0, hungerSum: 0, n: 0 };
    for (const d of ds) byHour[h][d.action]++;
    for (const v of world.people) { byHour[h].hungerSum += v.hunger; byHour[h].n++; }
    stepWorld(world, new Map(ds.map((d) => [d.id, d])), rand);
  }
  out[vname] = { byHour, degraded, calls, tokens, avgMs: msSum / Math.max(1, calls) };
  console.log(vname, "calls", calls, "degraded", degraded, "tokens", tokens, "avgMs", Math.round(msSum / Math.max(1, calls)));
  for (const [h, r] of Object.entries(byHour)) {
    const tot = r.n;
    console.log(`  ${String(h).padStart(2, "0")}:00 meanHunger=${(r.hungerSum / tot).toFixed(1)} ` +
      ["work", "eat", "sleep", "socialize", "wander"].map((a) => `${a}=${((100 * r[a]) / tot).toFixed(0)}%`).join(" "));
  }
}
fs.writeFileSync(new URL("./sim-results.json", import.meta.url), JSON.stringify(out, null, 1));
log.end();
