import { defineConfig, devices } from "@playwright/test";

// Regression harness for the Phaser RenderMaze build. Tests drive the running
// game deterministically through the in-page `window.__scene` API and assert on
// synchronous game state, so they never depend on wall-clock / rAF timing.
//
// The webServer builds the production bundle and serves it with `vite preview`.
const PORT = 4180;
const VITE = "node_modules/vite/bin/vite.js";

export default defineConfig({
  testDir: "tests",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  // Serialize: each test boots a full Phaser game whose clock is delta-driven;
  // concurrent games starve each other and flake. One worker keeps each game on
  // full CPU. (See phaser-playwright-ci-flakiness memory.)
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 900 },
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `node ${VITE} build && node ${VITE} preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // Always build + serve fresh. Reusing a server on this port risks running
    // the suite against a stale bundle (or a dev server on raw source), which
    // would pass green without exercising the change under review.
    reuseExistingServer: false,
    // No test may call a real LLM: the /api/llm route is off in the test server.
    env: { LLM_BACKEND: "none" },
    timeout: 120_000,
  },
});
