// Four arrows on the decision tile. The opacity of each arrow is the probability.
import { DIRS } from "./snapshot.js";

const TILE = 32;
const PINK = 0xff88df;
const CREAM = 0xfcf9ee;
const GOLD = 0xdf9718;

export function createArrows(scene) {
  const gfx = scene.add.graphics().setDepth(9);

  function draw(entry) {
    gfx.clear();
    if (!entry) return;
    const cx = entry.tile.col * TILE + TILE / 2;
    const cy = entry.tile.row * TILE + TILE / 2;
    for (const name of entry.options) {
      const d = DIRS[name];
      const chosen = name === entry.choice;
      // A fallback decision has no probabilities. Show only the chosen arrow, in gold.
      const p = entry.probabilities ? entry.probabilities[name] || 0 : chosen ? 1 : 0;
      const color = entry.source === "fallback" ? GOLD : chosen ? PINK : CREAM;
      gfx.fillStyle(color, 0.12 + 0.88 * p);
      // The tip points away from the tile center. (px, py) is perpendicular to d.
      const tipX = cx + d.col * 24, tipY = cy + d.row * 24;
      const baseX = cx + d.col * 13, baseY = cy + d.row * 13;
      const px = d.row * 7, py = d.col * 7;
      gfx.fillTriangle(tipX, tipY, baseX + px, baseY + py, baseX - px, baseY - py);
    }
  }

  return { draw, destroy: () => gfx.destroy() };
}
