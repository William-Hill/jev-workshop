// Play N games with the Jev player in a headless browser, and print the score.
// Each game uses the "wait for Jev" mode, so the latency does not change the result.
//
//   npm run bench -- --variant level1 --games 3
//
// Options:
//   --variant NAME     src/jev/questions.js (the default), or src/jev/variants/NAME.js
//   --games N          the count of games (default 3)
//   --difficulty D     chill, normal, or spicy (default chill)
//   --speed S          the game speed (default 2)
//   --max-seconds S    stop a game after S seconds of game time (default 240)
//   --port P           the port of the local server (default 4199)
//
// The results go to bench-results/. Each request uses the proxy and the key in .env.
import { createServer } from "vite";
import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const args = { variant: "questions", games: 3, difficulty: "chill", speed: 2, "max-seconds": 240, port: 4199 };
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i].replace(/^--/, "");
  if (!(key in args)) { console.error(`Unknown option: ${process.argv[i]}`); process.exit(2); }
  args[key] = typeof args[key] === "number" ? Number(process.argv[i + 1]) : process.argv[i + 1];
}

// hmr: false. A file change in the repository must not reload a game page during a run.
const server = await createServer({ logLevel: "warn", server: { host: "127.0.0.1", port: args.port, strictPort: true, hmr: false } });
await server.listen();
const browser = await chromium.launch();
const url = `http://127.0.0.1:${args.port}/?jev=1&wait=1&timeout=5000&variant=${encodeURIComponent(args.variant)}&speed=${args.speed}`;

const games = [];
try {
  for (let g = 1; g <= args.games; g++) {
    const page = await browser.newPage();
    try {
      await page.goto(url);
      await page.waitForFunction(() => window.__jev || window.__jevError, null, { timeout: 30_000 });
      const loadError = await page.evaluate(() => window.__jevError);
      if (loadError) throw new Error(loadError);

      await page.evaluate((difficulty) => {
        window.__scene.setDifficulty(difficulty);
        window.__scene.startGame();
      }, args.difficulty);
      const started = Date.now();
      // A game that stops (for example, a stuck request) must not block the run: allow 4 times the game limit in wall time.
      await page.waitForFunction(
        (maxMs) => ["won", "lost"].includes(window.__scene.phase) || window.__jev.clock.gameMs >= maxMs,
        args["max-seconds"] * 1000,
        { timeout: args["max-seconds"] * 4000, polling: 500 },
      );
      const result = await page.evaluate(() => {
        const s = window.__scene, j = window.__jev;
        const asked = j.log.filter((e) => e.source !== "code");
        const latency = asked.map((e) => e.latency_ms).sort((a, b) => a - b);
        return {
          result: s.phase === "won" || s.phase === "lost" ? s.phase : "time limit",
          collectibles_left: s.left,
          lives: s.lives,
          game_seconds: Math.round(j.clock.gameMs / 1000),
          latency_p50_ms: latency.length ? latency[Math.floor((latency.length - 1) / 2)] : null,
          input_tokens: asked.reduce((sum, e) => sum + ((e.usage && e.usage.input_tokens) || 0), 0),
          model: (asked.find((e) => e.model) || {}).model || null,
          fallback_reasons: asked.filter((e) => e.source === "fallback").reduce((acc, e) => {
            acc[e.reason] = (acc[e.reason] || 0) + 1;
            return acc;
          }, {}),
          score: j.score.summary(),
          log: j.log,
        };
      });
      result.wall_seconds = Math.round((Date.now() - started) / 1000);
      games.push(result);
      const s = result.score;
      console.log(
        `game ${g}: ${result.result}, points ${s.points}, jev share ${Math.round(s.jev_share * 100)}%, ` +
        `by Jev ${s.collected.jev}, by fallback ${s.collected.fallback}, lives lost ${s.lives_lost.jev + s.lives_lost.fallback}, ` +
        `left ${result.collectibles_left}, ${result.game_seconds} s game, ${result.wall_seconds} s wall, p50 ${result.latency_p50_ms} ms`,
      );
    } catch (err) {
      // A variant that does not load stops the run. Any other failure loses only this game.
      if (/does not exist/.test(err.message)) throw err;
      console.log(`game ${g}: ERROR, not counted: ${err.message.split("\n")[0]}`);
    } finally {
      await page.close();
    }
  }
  if (!games.length) throw new Error("No game completed.");
} finally {
  await browser.close();
  await server.close();
}

const mean = (f) => Math.round((games.reduce((sum, g) => sum + f(g), 0) / games.length) * 100) / 100;
const summary = {
  variant: args.variant,
  difficulty: args.difficulty,
  games: games.length,
  mean_points: mean((g) => g.score.points),
  mean_jev_share: mean((g) => g.score.jev_share),
  wins: games.filter((g) => g.result === "won").length,
  mean_lives_lost: mean((g) => g.score.lives_lost.jev + g.score.lives_lost.fallback),
  mean_collectibles_left: mean((g) => g.collectibles_left),
  input_tokens: games.reduce((sum, g) => sum + g.input_tokens, 0),
};
console.log("\n" + JSON.stringify(summary, null, 2));

const dir = path.resolve("bench-results");
fs.mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const base = path.join(dir, `${args.variant}-${args.difficulty}-${stamp}`);
fs.writeFileSync(base + ".json", JSON.stringify({ summary, games: games.map(({ log, ...g }) => g) }, null, 2));
fs.writeFileSync(base + ".jsonl", games.flatMap((g, i) => g.log.map((e) => JSON.stringify({ game: i + 1, ...e }))).join("\n") + "\n");
console.log(`\nResults: ${path.relative(process.cwd(), base)}.json and .jsonl`);
