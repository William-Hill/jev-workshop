// The score for the hackathon. Only the decisions that come from Jev get points.
//
// Each collectible goes to the source of the last decision before it:
//   jev       a JEV or an OVERRIDE decision (code combined the answers of Jev)
//   fallback  a FALLBACK decision, or no decision yet
// Each life lost costs points, whatever the source.

export const LIFE_COST = 30;

function empty() {
  return {
    decisions: { jev: 0, override: 0, fallback: 0, code: 0 },
    collected: { jev: 0, fallback: 0 },
    lives_lost: { jev: 0, fallback: 0 },
  };
}

export function createScore(scene) {
  let stats = empty();
  let owner = "fallback";
  let prevLeft = scene.left;
  let prevLives = scene.lives;

  return {
    // Call this once for each frame.
    update() {
      if (scene.left > prevLeft) { stats = empty(); owner = "fallback"; } // a new game
      if (scene.left < prevLeft) stats.collected[owner] += prevLeft - scene.left;
      if (scene.lives < prevLives) stats.lives_lost[owner] += prevLives - scene.lives;
      prevLeft = scene.left;
      prevLives = scene.lives;
    },
    // Call this for each applied decision.
    record(source) {
      stats.decisions[source] += 1;
      if (source === "jev" || source === "override") owner = "jev";
      else if (source === "fallback") owner = "fallback";
    },
    summary() {
      const d = stats.decisions;
      const asked = d.jev + d.override + d.fallback;
      const lost = stats.lives_lost.jev + stats.lives_lost.fallback;
      return {
        points: stats.collected.jev - LIFE_COST * lost,
        jev_share: asked ? Math.round(((d.jev + d.override) / asked) * 100) / 100 : 0,
        ...JSON.parse(JSON.stringify(stats)),
      };
    },
  };
}
