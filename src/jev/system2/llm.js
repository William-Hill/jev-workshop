// System 2 as an LLM. The browser calls /api/llm on the local server; the key stays there.
// The LLM gets an ASCII map and the legal moves, and must answer with one word.
// Code validates the answer in player.js; an illegal answer keeps the Jev move.

function asciiMap(scene, tile) {
  const now = scene.time.now;
  const rows = scene.tiles.map((r) => r.map((c) => (c === "#" ? "#" : c === "." ? "." : c === "o" ? "o" : " ")));
  scene.enemies.filter((e) => !(e.eatenUntil > now)).forEach((e) => { rows[e.row][e.col] = e.strategy === "chase" ? "C" : e.strategy === "patrol" ? "P" : "W"; });
  rows[tile.row][tile.col] = "R";
  return rows.map((r) => r.join("")).join("\n");
}

export async function askLlm(snapshot, scene) {
  const legal = Object.keys(snapshot.options);
  const facts = legal.map((n) => {
    const o = snapshot.options[n];
    return `${n}: nearest blocker ${o.steps_to_blocker ?? "none"} steps${o.blocker_approaching ? " (approaching)" : ""}, nearest collectible ${o.steps_to_collectible ?? "none"} steps`;
  }).join("\n");
  const prompt = [
    "Maze, row 0 at the top. # wall, . collectible, o power pellet, R runner, C blocker that chases, P blocker that patrols, W blocker that wanders.",
    asciiMap(scene, snapshot.tile),
    `Power mode seconds left: ${snapshot.power_seconds_left}. Lives: ${snapshot.lives}. Collectibles left: ${snapshot.collectibles_left}.`,
    "Facts for each legal move:",
    facts,
    `Legal moves: ${legal.join(", ")}`,
    "Keep the runner alive first, then collect. Answer with exactly one word from the legal moves.",
  ].join("\n");
  const res = await fetch("/api/llm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system: "You control a runner in a maze game. Answer with one word.", prompt, max_tokens: 5 }),
  });
  if (!res.ok) throw new Error(`System 2 LLM failed: HTTP ${res.status}`);
  const data = await res.json();
  const word = String(data.text || "").trim().toLowerCase().replace(/[^a-z]/g, "");
  return { choice: word, reason: `LLM picked "${word}"`, model: data.model, usage: data.usage };
}
