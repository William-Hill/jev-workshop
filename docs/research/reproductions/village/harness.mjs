// Repro harness. Uses the project's world.js (pure code) and the two QUESTION
// versions from git history. Sends only to api.typesafe.ai. Never prints the key.
import fs from "node:fs";
import { createWorld, describeState, hourOf, isNight } from "./src/lib/world.js";

const KEY = process.env.TYPESAFE_API_KEY;
if (!KEY) throw new Error("TYPESAFE_API_KEY missing");
const URL = "https://api.typesafe.ai/v1/systemone";
const URGENCY_OLD = {
  type: "score",
  instructions: "How urgent is this villager's need right now? (1 = content, 5 = desperate)",
  criteria: ["Content", "Mild need", "Pressing need", "Acute need", "Desperate"],
};
const URGENCY_NEW = {
  ...URGENCY_OLD,
  instructions: "How urgent is this villager's most pressing need right now? (1 = content, 5 = desperate)",
};
// Vague: commit 38237de..df95e2b lib/brain-jev.js
export const Q_VAGUE = {
  action: {
    type: "choice",
    instructions: "What should this villager do next?",
    criteria: {
      work: "Tend the crops at the farm",
      eat: "Drink and eat at the well",
      sleep: "Rest at home",
      socialize: "Meet others at the plaza",
      wander: "Roam the village",
    },
  },
  urgency: URGENCY_OLD,
};
// Explicit: commit 8275164 .. HEAD 7bd9bd3 lib/brain-jev.js
export const Q_EXPLICIT = {
  action: {
    type: "choice",
    instructions: "What should this villager do next? Pick the action whose condition matches the state best.",
    criteria: {
      work: "Tend the crops at the farm — the default daytime activity when not hungry, tired, or lonely",
      eat: "Go eat at the well — only when hunger is high (roughly above 50/100)",
      sleep: "Rest at home — when energy is low (roughly below 30/100) or it is night",
      socialize: "Meet others at the plaza — when mood is low (roughly below 50/100)",
      wander: "Roam the village — when everything else is satisfied",
    },
  },
  urgency: URGENCY_NEW,
};
// Old state text (before 8275164).
export function describeStateOld(v, world) {
  const h = hourOf(world.tick);
  const dist = (l) => Math.abs(l.x - v.x) + Math.abs(l.y - v.y);
  const near = (list) => Math.min(...list.map(dist), 99);
  return (
    `Villager ${v.id}. Time ${String(h).padStart(2, "0")}:00 (${isNight(world.tick) ? "night" : "day"}). ` +
    `Hunger ${Math.round(v.hunger)}/100 (higher = hungrier). Energy ${Math.round(v.energy)}/100. ` +
    `Mood ${Math.round(v.mood)}/100 (lower = lonely). ` +
    `Distance to: farm ${near(world.landmarks.farms)}, well ${near([world.landmarks.well])}, ` +
    `home ${near(world.landmarks.homes)}, plaza ${near(world.landmarks.plaza)}.`
  );
}
export const VARIANTS = {
  A_vague_oldstate: { q: Q_VAGUE, d: describeStateOld },
  B_explicit_newstate: { q: Q_EXPLICIT, d: describeState },
  C_vague_newstate: { q: Q_VAGUE, d: describeState },
};

export const log = fs.createWriteStream(new globalThis.URL("./calls.jsonl", import.meta.url), { flags: "a" });

export async function ask(state, questions, tag) {
  const t0 = Date.now();
  const res = await fetch(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ state, model: "jev-latest", questions }),
    signal: AbortSignal.timeout(20000),
  });
  const ms = Date.now() - t0;
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 300) }; }
  log.write(JSON.stringify({ tag, status: res.status, ms, state, data }) + "\n");
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  return { data, ms };
}

export { createWorld };
