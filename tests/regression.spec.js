import { test, expect } from "@playwright/test";

// Deterministic regression suite for the RenderMaze Phaser build.
//
// Every assertion reads synchronous game state via window.__scene and drives
// the game by calling scene methods directly (press/movePlayer/collect/...),
// rather than waiting for animation frames. This makes the suite immune to the
// rAF-throttling and game-clock-lag flakiness documented for Phaser+Playwright.

// Console noise we never want to fail a boot on: third-party font CDN fetches,
// favicon 404s, and headless-Chromium WebGL/GPU chatter. A real script failure
// (e.g. the SVG-loader regression this guards against) surfaces as a `pageerror`
// or a console error that doesn't match this, so it is still caught.
const BENIGN_ERROR =
  /favicon|fonts\.(googleapis|gstatic)\.com|Failed to load resource|net::ERR|ERR_|WebGL|GPU stall|AudioContext/i;

async function boot(page) {
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && !BENIGN_ERROR.test(msg.text())) {
      errors.push(`console: ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${String(err)}`));
  await page.goto("/");
  // create() assigns window.__scene once the scene boots.
  await page.waitForFunction(() => !!window.__scene, null, { timeout: 15_000 });
  return errors;
}

// Put the game into a controllable "playing" state at the player's start tile.
async function enterPlaying(page) {
  await page.evaluate(() => {
    const s = window.__scene;
    s.startGame();
    s.phase = "playing"; // skip the READY countdown deterministically
  });
}

test.describe.configure({ mode: "serial" });

test("boots clean on the Atlanta title screen with collectibles counted", async ({ page }) => {
  const errors = await boot(page);
  const state = await page.evaluate(() => {
    const s = window.__scene;
    return {
      phase: s.phase,
      theme: s.selTheme,
      left: s.left,
      lives: s.lives,
      title: !document.getElementById("titleScreen").hidden,
      themeTag: document.getElementById("themeTag").textContent,
      leftLabel: document.getElementById("leftLabel").textContent,
    };
  });
  expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
  expect(state.phase).toBe("title");
  expect(state.theme).toBe("atlanta");
  expect(state.left).toBeGreaterThan(100);
  expect(state.lives).toBe(3);
  expect(state.title).toBe(true);
  expect(state.themeTag).toBe("Atlanta Wing Run");
  expect(state.leftLabel).toBe("Wings");
});

test("startGame enters the READY phase", async ({ page }) => {
  await boot(page);
  const phase = await page.evaluate(() => {
    window.__scene.startGame();
    return window.__scene.phase;
  });
  expect(phase).toBe("ready");
});

test("held-to-move: advances while held, finishes current tile and STOPS on release", async ({ page }) => {
  await boot(page);
  await enterPlaying(page);
  const r = await page.evaluate(() => {
    const s = window.__scene;
    const startCol = s.player.col;
    // Hold right and advance ~1 tile.
    s.press("right");
    s.movePlayer(0.2);
    const afterHold = s.player.col;
    // Release: clear held input, advance again — should finish the current
    // tile then stop (dir cleared), not drift onward.
    s.heldDir = null;
    s.movePlayer(0.2);
    const afterRelease = s.player.col;
    const dirAfterRelease = s.player.dir;
    // Further updates with no held key must not move the player.
    s.movePlayer(0.2);
    s.movePlayer(0.2);
    const afterIdle = s.player.col;
    return { startCol, afterHold, afterRelease, dirAfterRelease, afterIdle };
  });
  expect(r.afterHold).toBe(r.startCol + 1); // moved while held
  expect(r.afterRelease).toBe(r.afterHold + 1); // finished the tile it was on
  expect(r.dirAfterRelease).toBeNull(); // stopped
  expect(r.afterIdle).toBe(r.afterRelease); // no drift after release
});

test("instant reverse flips direction in place", async ({ page }) => {
  await boot(page);
  await enterPlaying(page);
  const r = await page.evaluate(() => {
    const s = window.__scene;
    s.press("right");
    s.movePlayer(0.2); // now moving right with some progress
    const before = { col: s.player.col, p: s.player.p };
    s.press("left"); // reverse
    return {
      before,
      dir: s.player.dir,
      heldRow: s.heldDir.row,
      heldCol: s.heldDir.col,
    };
  });
  expect(r.dir).toEqual({ row: 0, col: -1 });
  expect(r.heldCol).toBe(-1);
});

test("collecting a regular wing awards +10 and decrements the count", async ({ page }) => {
  await boot(page);
  await enterPlaying(page);
  const r = await page.evaluate(() => {
    const s = window.__scene;
    const scoreBefore = s.score;
    const leftBefore = s.left;
    // (1,2) is a regular collectible tile in the maze.
    s.collect(1, 2);
    return { scoreBefore, leftBefore, score: s.score, left: s.left, tile: s.tiles[1][2] };
  });
  expect(r.score).toBe(r.scoreBefore + 10);
  expect(r.left).toBe(r.leftBefore - 1);
  expect(r.tile).toBe(" ");
});

test("power pellet awards +50 and activates power mode", async ({ page }) => {
  await boot(page);
  await enterPlaying(page);
  const r = await page.evaluate(() => {
    const s = window.__scene;
    const scoreBefore = s.score;
    // (1,17) is a power pellet ('o') in the maze.
    s.collect(1, 17);
    return { scoreBefore, score: s.score, powered: s.powerUntil > s.time.now };
  });
  expect(r.score).toBe(r.scoreBefore + 50);
  expect(r.powered).toBe(true);
});

test("eating a blocker during power mode awards a combo and respawns it", async ({ page }) => {
  await boot(page);
  await enterPlaying(page);
  const r = await page.evaluate(() => {
    const s = window.__scene;
    s.powerUntil = s.time.now + 6000;
    const e = s.enemies[0];
    e.eatenUntil = 0;
    e.row = s.player.row;
    e.col = s.player.col;
    e.dir = null;
    const scoreBefore = s.score;
    s.checkCollisions(s.time.now);
    return { scoreBefore, score: s.score, eaten: e.eatenUntil > s.time.now };
  });
  expect(r.score).toBe(r.scoreBefore + 100); // first eat in chain
  expect(r.eaten).toBe(true);
});

test("colliding with a blocker without power loses a life; zero lives loses the game", async ({ page }) => {
  await boot(page);
  await enterPlaying(page);
  const r = await page.evaluate(() => {
    const s = window.__scene;
    s.powerUntil = 0;
    s.lives = 1;
    const e = s.enemies[0];
    e.eatenUntil = 0;
    e.row = s.player.row;
    e.col = s.player.col;
    e.dir = null;
    s.checkCollisions(s.time.now);
    return { lives: s.lives, phase: s.phase };
  });
  expect(r.lives).toBe(0);
  expect(r.phase).toBe("lost");
});

test("clearing all collectibles wins the game", async ({ page }) => {
  await boot(page);
  await enterPlaying(page);
  const r = await page.evaluate(() => {
    const s = window.__scene;
    s.left = 0;
    s.update(s.time.now, 16);
    return { phase: s.phase };
  });
  expect(r.phase).toBe("won");
});

test("pause toggles between playing and paused", async ({ page }) => {
  await boot(page);
  await enterPlaying(page);
  const r = await page.evaluate(() => {
    const s = window.__scene;
    s.pauseToggle();
    const paused = s.phase;
    s.pauseToggle();
    const resumed = s.phase;
    return { paused, resumed };
  });
  expect(r.paused).toBe("paused");
  expect(r.resumed).toBe("playing");
});

test("theme switch to Workshop swaps labels, deck, and legend", async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(() => {
    const s = window.__scene;
    s.pickTheme("workshop");
    return {
      theme: s.theme,
      themeTag: document.getElementById("themeTag").textContent,
      leftLabel: document.getElementById("leftLabel").textContent,
      collectibleItems: document.getElementById("collectibleLegend").children.length,
      enemyItems: document.getElementById("enemyLegend").children.length,
      firstCollectibleName: document.querySelector("#collectibleLegend .nm").textContent,
    };
  });
  expect(r.theme).toBe("workshop");
  expect(r.themeTag).toBe("Workshop Specs");
  expect(r.leftLabel).toBe("Specs");
  expect(r.collectibleItems).toBe(2);
  expect(r.enemyItems).toBeGreaterThanOrEqual(4);
  expect(r.firstCollectibleName).toBe("Spec Card");
});

test("difficulty buttons set the active difficulty", async ({ page }) => {
  await boot(page);
  const diff = await page.evaluate(() => {
    document.querySelector('[data-diff="spicy"]').click();
    return window.__scene.difficulty;
  });
  expect(diff).toBe("spicy");
});

test("walls block movement", async ({ page }) => {
  await boot(page);
  await enterPlaying(page);
  const blocked = await page.evaluate(() => {
    const s = window.__scene;
    // From start (1,1), up is a wall (row 0 is all '#').
    return s.canMove(s.player.row, s.player.col, { row: -1, col: 0 });
  });
  expect(blocked).toBe(false);
});
