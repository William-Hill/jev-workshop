import { test, expect } from "@playwright/test";

// Tests for the Jev player. Each test replaces the proxy route with a mock,
// so that no test sends a request to api.typesafe.ai.

const DIR_NAMES = ["up", "down", "left", "right"];

async function boot(page, url) {
  await page.goto(url);
  await page.waitForFunction(() => !!window.__scene, null, { timeout: 15_000 });
}

async function bootJev(page, query = "") {
  await boot(page, "/?jev=1" + query);
  await page.waitForFunction(() => !!window.__jev, null, { timeout: 15_000 });
}

async function enterPlaying(page) {
  await page.evaluate(() => {
    const s = window.__scene;
    s.startGame();
    s.phase = "playing";
  });
}

// Answer each request. `pick(optionNames)` selects the move. `scores(id)` and
// `nouls(id)` give the value for a Score or a Noul question. Record each request body.
async function mockJev(page, pick, { scores = () => 0, nouls = () => 0, delayMs = 0 } = {}) {
  const requests = [];
  await page.route("**/api/jev", async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    const answers = {};
    for (const [id, q] of Object.entries(body.questions)) {
      if (q.type === "choice") {
        const options = Object.keys(q.criteria);
        const choice = pick(options);
        const probabilities = Object.fromEntries(options.map((name) => [name, name === choice ? 0.8 : 0.2 / Math.max(1, options.length - 1)]));
        answers[id] = { type: "choice", choice, confidence: 0.7, probabilities };
      } else if (q.type === "score") {
        answers[id] = { type: "score", score: scores(id), confidence: 0.9, probabilities: {}, legend: {} };
      } else {
        answers[id] = { type: "noul", noul: nouls(id) };
      }
    }
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.fulfill({ json: { model: "jev-test", answers, usage: { input_tokens: 100, output_tokens: 10 } } });
  });
  return requests;
}

const firstDecision = (page) =>
  page.waitForFunction(() => window.__jev.log.find((e) => e.source !== "code"), null, { timeout: 10_000 })
    .then((handle) => handle.jsonValue());

test.describe.configure({ mode: "serial" });

test("the Jev player is off by default", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/jev", (route) => { requests += 1; return route.abort(); });
  await boot(page, "/");
  await enterPlaying(page);
  await page.waitForTimeout(500);
  const state = await page.evaluate(() => ({
    jev: typeof window.__jev,
    panel: !!document.querySelector(".jevpanel"),
    col: window.__scene.player.col,
    held: window.__scene.heldDir,
  }));
  expect(state).toEqual({ jev: "undefined", panel: false, col: 1, held: null });
  expect(requests).toBe(0);
});

test("Jev gets only legal options, and the player moves in the chosen direction", async ({ page }) => {
  const requests = await mockJev(page, (options) => (options.includes("right") ? "right" : options[0]));
  await bootJev(page);
  await enterPlaying(page);
  const entry = await firstDecision(page);

  // From the start tile (1,1), only right and down are legal.
  expect(Object.keys(requests[0].questions.move.criteria).sort()).toEqual(["down", "right"]);
  expect(requests[0].model).toBe("jev-latest");
  expect(requests[0].state.tile).toEqual({ row: 1, col: 1 });

  expect(entry.source).toBe("jev");
  expect(entry.choice).toBe("right");
  expect(entry.applied).toBe(true);
  await page.waitForFunction(() => window.__scene.player.col > 1);
  await expect(page.locator('.jevpanel [data-jev="source"]')).toHaveText("JEV");
  await expect(page.locator('.jevpanel [data-jev="choice"]')).toHaveText("right");
});

test("code rejects an answer that is not in the option set and labels the fallback", async ({ page }) => {
  await mockJev(page, () => "up"); // up is a wall at the start tile
  await bootJev(page);
  await enterPlaying(page);
  const entry = await firstDecision(page);
  expect(entry.source).toBe("fallback");
  expect(entry.reason).toContain("not in the option set");
  expect(entry.jev_choice).toBe("up");
  expect(["right", "down"]).toContain(entry.choice);
  await expect(page.locator('.jevpanel [data-jev="source"]')).toHaveText("FALLBACK");
});

test("a failed request uses the fallback policy", async ({ page }) => {
  await page.route("**/api/jev", (route) => route.fulfill({ status: 503, json: { error: "no key" } }));
  await bootJev(page);
  await enterPlaying(page);
  const entry = await firstDecision(page);
  expect(entry.source).toBe("fallback");
  expect(entry.reason).toBe("HTTP 503");
  expect(["right", "down"]).toContain(entry.choice);
  await page.waitForFunction(() => window.__scene.player.col > 1 || window.__scene.player.row > 1);
});

test("each option in each request is a legal move", async ({ page }) => {
  const requests = await mockJev(page, (options) => options[0]);
  await bootJev(page);
  await enterPlaying(page);
  await page.waitForFunction(() => window.__jev.log.filter((e) => e.source === "jev").length >= 5, null, { timeout: 20_000 });
  const bad = await page.evaluate((names) => {
    const s = window.__scene;
    const dirs = { up: { row: -1, col: 0 }, down: { row: 1, col: 0 }, left: { row: 0, col: -1 }, right: { row: 0, col: 1 } };
    return window.__jev.log.filter((e) =>
      e.options.some((name) => !names.includes(name) || !s.canMove(e.tile.row, e.tile.col, dirs[name])) ||
      !e.options.includes(e.choice));
  }, DIR_NAMES);
  expect(bad).toEqual([]);
  expect(requests.length).toBeGreaterThanOrEqual(5);
});

test("the pause control stops the game, and the step control runs to the next decision", async ({ page }) => {
  await mockJev(page, (options) => (options.includes("right") ? "right" : options[0]));
  await bootJev(page);
  await page.locator('.jevpanel [data-jev="pause"]').click();
  await enterPlaying(page);
  await page.waitForTimeout(400);
  const paused = await page.evaluate(() => ({ col: window.__scene.player.col, log: window.__jev.log.length }));
  expect(paused).toEqual({ col: 1, log: 0 });

  await page.locator('.jevpanel [data-jev="step"]').click();
  await firstDecision(page);
  await page.waitForFunction(() => window.__jev.clock.paused === true);
  await expect(page.locator('.jevpanel [data-jev="pause"]')).toHaveText("Resume Jev");
});

test("the wait mode stops the game until the answer arrives", async ({ page }) => {
  await mockJev(page, (options) => (options.includes("right") ? "right" : options[0]), { delayMs: 800 });
  await bootJev(page);
  await enterPlaying(page);
  await page.waitForFunction(() => window.__jev.pending === true);
  const during = await page.evaluate(() => ({ hold: window.__jev.clock.hold, gameMs: window.__jev.clock.gameMs }));
  await page.waitForTimeout(400);
  const later = await page.evaluate(() => ({ pending: window.__jev.pending, gameMs: window.__jev.clock.gameMs }));
  expect(during.hold).toBe(true);
  expect(later.pending).toBe(true);
  expect(later.gameMs).toBe(during.gameMs); // no game time passed during the request
  await firstDecision(page);
  await page.waitForFunction(() => window.__jev.clock.hold === false && window.__scene.player.col > 1);
});

test("level 3: code overrides a dangerous move and labels it OVERRIDE", async ({ page }) => {
  // Jev picks right. The danger Score says right is deadly and down is safe.
  const requests = await mockJev(page, (options) => (options.includes("right") ? "right" : options[0]), {
    scores: (id) => (id === "danger_right" ? 2 : 0),
  });
  await bootJev(page, "&variant=level3");
  await enterPlaying(page);
  const entry = await firstDecision(page);
  expect(Object.keys(requests[0].questions).sort()).toEqual(["danger_down", "danger_right", "move"]);
  expect(entry.source).toBe("override");
  expect(entry.jev_choice).toBe("right");
  expect(entry.choice).toBe("down");
  expect(entry.reason).toContain("danger");
  await expect(page.locator('.jevpanel [data-jev="source"]')).toHaveText("OVERRIDE");
});

test("an unknown variant reports an error and does not start the player", async ({ page }) => {
  await boot(page, "/?jev=1&variant=nothing");
  await page.waitForFunction(() => !!window.__jevError);
  expect(await page.evaluate(() => typeof window.__jev)).toBe("undefined");
});

test("the score gives points only for collectibles after a Jev decision", async ({ page }) => {
  await page.route("**/api/jev", (route) => route.fulfill({ status: 503, json: { error: "no key" } }));
  await bootJev(page);
  await enterPlaying(page);
  await page.waitForFunction(() => window.__jev.score.summary().collected.fallback >= 2, null, { timeout: 10_000 });
  const s = await page.evaluate(() => window.__jev.score.summary());
  expect(s.collected.jev).toBe(0);
  expect(s.points).toBe(0);
  expect(s.jev_share).toBe(0);
  await expect(page.locator('.jevpanel [data-jev="points"]')).toHaveText("0");
});

test("System 2: an escalated decision uses the System 2 choice and the SYSTEM 2 label", async ({ page }) => {
  await mockJev(page, (options) => options[0]);
  await bootJev(page, "&variant=test-s2");
  await enterPlaying(page);
  const entry = await firstDecision(page);
  expect(entry.source).toBe("system2");
  expect(entry.choice).toBe(entry.options[entry.options.length - 1]);
  expect(entry.jev_choice).toBe(entry.options[0]);
  expect(entry.reason).toContain("test: always escalate");
  await expect(page.locator('.jevpanel [data-jev="source"]')).toHaveText("SYSTEM 2");
  const s = await page.evaluate(() => window.__jev.score.summary());
  expect(Number.isNaN(s.points)).toBe(false);
  expect(s.decisions.system2).toBeGreaterThanOrEqual(1);
});

test("System 2: an illegal System 2 answer falls back to the Jev move", async ({ page }) => {
  await mockJev(page, (options) => options[0]);
  await bootJev(page, "&variant=test-s2");
  await page.evaluate(() => {
    // Replace the test System 2 with one that answers an illegal direction.
    window.__jev.overrideSystem2 = async () => ({ choice: "north", reason: "bad" });
  });
  await enterPlaying(page);
  const entry = await firstDecision(page);
  expect(entry.source).toBe("fallback");
  expect(entry.reason).toContain("System 2");
  expect(entry.choice).toBe(entry.options[0]);
});

test("System 2 search: a low-confidence Jev answer goes to the code planner", async ({ page }) => {
  await page.route("**/api/jev", async (route) => {
    const body = route.request().postDataJSON();
    const options = Object.keys(body.questions.move.criteria);
    const probabilities = Object.fromEntries(options.map((n) => [n, 1 / options.length]));
    await route.fulfill({ json: { model: "jev-test", answers: { move: { type: "choice", choice: options[0], confidence: 0.3, probabilities } }, usage: { input_tokens: 1, output_tokens: 1 } } });
  });
  await bootJev(page, "&variant=level2d-s2search");
  await enterPlaying(page);
  const entry = await firstDecision(page);
  expect(entry.source).toBe("system2");
  expect(entry.reason).toContain("look-ahead 8 steps");
  expect(entry.options).toContain(entry.choice);
});

// Jev answers with a confidence of 0.2, so the escalation rule sends each decision to System 2.
async function mockUnsureJev(page) {
  await page.route("**/api/jev", async (route) => {
    const body = route.request().postDataJSON();
    const options = Object.keys(body.questions.move.criteria);
    const probabilities = Object.fromEntries(options.map((n) => [n, 1 / options.length]));
    await route.fulfill({ json: { model: "jev-test", answers: { move: { type: "choice", choice: options[0], confidence: 0.2, probabilities } }, usage: { input_tokens: 1, output_tokens: 1 } } });
  });
}

test("System 2 LLM: the LLM direction is used and labeled SYSTEM 2", async ({ page }) => {
  await mockUnsureJev(page);
  await page.route("**/api/llm", async (route) => {
    const { prompt } = route.request().postDataJSON();
    const legal = prompt.match(/Legal moves: ([a-z, ]+)/)[1].split(", ");
    await route.fulfill({ json: { text: legal[legal.length - 1], model: "llm-test", usage: { input_tokens: 10, output_tokens: 1 }, ms: 5 } });
  });
  await bootJev(page, "&variant=level2d-s2llm");
  await enterPlaying(page);
  const entry = await firstDecision(page);
  expect(entry.source).toBe("system2");
  expect(entry.choice).toBe(entry.options[entry.options.length - 1]);
  expect(entry.system2.model).toBe("llm-test");
});

test("System 2 LLM: an unavailable LLM (503) keeps the Jev move and labels FALLBACK", async ({ page }) => {
  await mockUnsureJev(page);
  await page.route("**/api/llm", (route) => route.fulfill({ status: 503, json: { error: "System 2 is off." } }));
  await bootJev(page, "&variant=level2d-s2llm");
  await enterPlaying(page);
  const entry = await firstDecision(page);
  expect(entry.source).toBe("fallback");
  expect(entry.reason).toContain("System 2");
  expect(entry.choice).toBe(entry.options[0]);
});

test("the decision log downloads as JSONL", async ({ page }) => {
  await mockJev(page, (options) => options[0]);
  await bootJev(page);
  await enterPlaying(page);
  await firstDecision(page);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator('.jevpanel [data-jev="download"]').click(),
  ]);
  expect(download.suggestedFilename()).toBe("decisions.jsonl");
  const stream = await download.createReadStream();
  let text = "";
  for await (const chunk of stream) text += chunk;
  const first = JSON.parse(text.split("\n")[0]);
  expect(first.n).toBe(1);
  expect(first.choice).toBeTruthy();
});
