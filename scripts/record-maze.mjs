// Records a RenderMaze game played by Jev with the code planner as System 2 (level2d-s2search),
// with captions and an intro and an outro card for a social teaser.
//   node scripts/record-maze.mjs   ->   recordings/maze-full.mp4 (real time) and recordings/maze-teaser.mp4 (2x)
// It tries seeds that won with 0 lives lost in the benchmark, and keeps the first win with 0 lives lost.
// If no seed gives that, it keeps the first win. Cost: about $0.01 of Jev for each attempt.
import { chromium } from "@playwright/test";
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";

const PORT = 5190;
const SIZE = { width: 1920, height: 1080 };
const SEEDS = [5003, 5008, 5009, 5005, 5007, 5011];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// CLEAN=1 records the game only: no title cards and no captions, for a voiceover cut.
const CLEAN = process.env.CLEAN === "1";

const CAPTIONS = [
  "Jev plays RenderMaze. It never sees the screen. Code sends it facts: steps to the nearest wing, the nearest blocker, the power pellet.",
  "At each intersection, Jev picks a direction and gives a probability for each one. Watch the bars on the board and in the panel.",
  "When Jev is unsure, or every direction is dangerous, code hands the move to a slower System 2: a planner that looks 8 steps ahead.",
  "JEV means Jev decided. SYSTEM 2 means the planner decided. CODE means a corridor with only one way forward.",
  "About 1 move in 5 goes to System 2. The fast calls stay with Jev.",
  "On 30 new games, Jev alone won 6. Jev plus the planner won 28.",
];

fs.mkdirSync("recordings/raw", { recursive: true });
const server = spawn("npx", ["vite", "--port", String(PORT), "--strictPort", "--host", "127.0.0.1"], { stdio: "ignore" });
await sleep(3000);
const browser = await chromium.launch();

async function overlay(page, kind, text) {
  await page.evaluate(({ kind, text }) => {
    document.getElementById("rec-overlay")?.remove();
    if (!text) return;
    const o = document.createElement("div");
    o.id = "rec-overlay";
    const card = kind === "card";
    o.style.cssText = card
      ? "position:fixed;inset:0;z-index:999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;background:#211c22;color:#fcf9ee;text-align:center;padding:60px;font-family:'Archivo Black',sans-serif"
      : "position:fixed;left:50%;bottom:26px;transform:translateX(-50%);max-width:1250px;z-index:999;background:#2b292d;color:#fcf9ee;border:3px solid #ff88df;box-shadow:6px 6px 0 #ff88df;padding:14px 24px;font:600 26px/1.35 'Instrument Sans',system-ui,sans-serif;text-align:center";
    if (card) {
      for (const [i, line] of text.split("\n").entries()) {
        const p = document.createElement("div");
        p.textContent = line;
        p.style.cssText = i === 0 ? "font-size:92px;line-height:.95;text-transform:uppercase;color:#ff88df" : i === 1 ? "font-size:44px;line-height:1.1;text-transform:uppercase" : "font:600 30px/1.35 'JetBrains Mono',monospace;color:rgba(252,249,238,.85)";
        o.append(p);
      }
    } else o.textContent = text;
    document.body.append(o);
  }, { kind, text });
}

async function attempt(seed) {
  const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir: "recordings/raw", size: SIZE } });
  const page = await context.newPage();
  const t0 = Date.now(); // The video starts with the page.
  await page.goto(`http://127.0.0.1:${PORT}/?jev=1&wait=1&timeout=5000&variant=level2d-s2search&speed=1`);
  await page.waitForFunction(() => window.__jev || window.__jevError, null, { timeout: 30000 });
  if (!CLEAN) {
    await overlay(page, "card", "Can Jev play Pac-Man?\nA model that only makes decisions\nJev Workshop · RenderATL × AI Ship & Social · October 15");
    await sleep(4000);
    await overlay(page, "card", "");
  } else await sleep(1500);
  const introEnd = (Date.now() - t0) / 1000;
  await page.evaluate((seed) => {
    const s = window.__scene;
    s.setDifficulty("normal");
    s.startGame();
    s.enemies.forEach((e, i) => { e.seed = ((seed * 2654435761) ^ (i * 40503 + 7)) & 0x7fffffff; });
  }, seed);
  let i = 0;
  const started = Date.now();
  while (Date.now() - started < 6 * 60 * 1000) {
    const phase = await page.evaluate(() => window.__scene.phase);
    if (phase === "won" || phase === "lost") break;
    const elapsed = Date.now() - started;
    if (!CLEAN && elapsed > i * 11000 && i < CAPTIONS.length) await overlay(page, "caption", CAPTIONS[i++]);
    await sleep(250);
  }
  const gameEnd = (Date.now() - t0) / 1000;
  const end = await page.evaluate(() => ({ phase: window.__scene.phase, lives: window.__scene.lives, left: window.__scene.left, score: window.__jev.score.summary() }));
  const lost = 3 - end.lives;
  if (!CLEAN) await overlay(page, "caption", end.phase === "won" ? `Cleared: every wing collected, ${lost} ${lost === 1 ? "life" : "lives"} lost.` : `Game over with ${end.left} wings left.`);
  await sleep(3500);
  if (!CLEAN) {
    await overlay(page, "card", "Change the question.\nJev Workshop · October 15\nRenderATL HQ & Tech Lounge, Atlanta · RenderATL × AI Ship & Social · Jev access by Obvious");
    await sleep(4500);
  }
  const video = page.video();
  await context.close();
  return { seed, ...end, lost, introEnd, gameEnd, path: await video.path() };
}

let best = null;
try {
  for (const seed of SEEDS) {
    const r = await attempt(seed);
    console.log(`seed ${seed}: ${r.phase}, lives lost ${r.lost}, wings left ${r.left}, decisions ${JSON.stringify(r.score.decisions)}`);
    if (r.phase === "won" && (!best || r.lost < best.lost)) { if (best) fs.rmSync(best.path); best = r; }
    else fs.rmSync(r.path);
    if (best && best.lost === 0) break;
  }
} finally {
  await browser.close();
  server.kill();
}
if (!best) { console.log("No win in the seeds tried. No video kept."); process.exit(1); }
if (CLEAN) {
  // The game from its first move to 3.5 s after the end (the win screen), at real speed.
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", best.introEnd.toFixed(2), "-i", best.path, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "recordings/maze-clean.mp4"]);
  console.log(`Kept seed ${best.seed} (${best.lost} lives lost). Video: recordings/maze-clean.mp4 (game ends at ${(best.gameEnd - best.introEnd).toFixed(1)} s)`);
  process.exit(0);
}
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", best.path, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "22", "recordings/maze-full.mp4"]);
// The teaser: the intro card and the ending at normal speed, the game at 2x.
const a = best.introEnd.toFixed(2), b = best.gameEnd.toFixed(2);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", best.path, "-filter_complex",
  `[0:v]trim=0:${a},setpts=PTS-STARTPTS[a];[0:v]trim=${a}:${b},setpts=(PTS-STARTPTS)*0.5[b];[0:v]trim=${b},setpts=PTS-STARTPTS[c];[a][b][c]concat=n=3:v=1:a=0[v]`,
  "-map", "[v]", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "22", "-movflags", "+faststart", "recordings/maze-teaser.mp4"]);
console.log(`Kept seed ${best.seed} (${best.lost} lives lost). Videos: recordings/maze-full.mp4, recordings/maze-teaser.mp4`);
