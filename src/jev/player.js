// The Jev player loop.
// It finds a decision point, sends the state to the proxy, checks the answers,
// combines them, and holds the direction. Code makes some decisions in place
// of Jev. The log and the panel label each of these decisions.
//
// URL parameters:
//   jev=1          load the player
//   variant=NAME   use src/jev/variants/NAME.js in place of src/jev/questions.js
//   wait=0         do not stop the game during a request (the default is wait=1)
//   speed=N        the game speed, for example 0.25 or 2
//   timeout=MS     the request timeout (the default is 1500)
import { dirName, OPPOSITE } from "./snapshot.js";
import { fallbackMove } from "./fallback.js";
import { installClock } from "./clock.js";
import { createArrows } from "./arrows.js";
import { createPanel } from "./panel.js";
import { createScore } from "./score.js";
import { loadVariant } from "./variants.js";

const ENDPOINT = "/api/jev";
const params = new URLSearchParams(window.location.search);
const TIMEOUT_MS = Number(params.get("timeout")) || 1500;
const RETRY_STATUS = [429, 529];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// One request. Retry a 429 or a 529 response, as the TypeSafe API page says, while time remains.
async function askJev(body) {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (res.ok) return res.json();
    if (!RETRY_STATUS.includes(res.status) || attempt >= 2) throw new Error("HTTP " + res.status);
    await sleep(100 * 2 ** attempt);
  }
}

export function createPlayer(scene, variant) {
  const clock = installClock(scene);
  clock.scale = Number(params.get("speed")) || 1;
  const arrows = createArrows(scene);
  const score = createScore(scene);
  const log = [];
  const jev = {
    scene, clock, log, score, variant: variant.name,
    enabled: true, wait: params.get("wait") !== "0", stepping: false, pending: false,
  };

  let seenKey = null; // the decision tile that the loop saw last
  let handled = false; // true when the decision for seenKey is complete
  let queued = null; // a reverse move that waits for the tile center

  const panel = createPanel({
    variant: variant.name,
    wait: jev.wait,
    speed: clock.scale,
    onEnable(on) {
      jev.enabled = on;
      if (!on) { release(); arrows.draw(null); }
    },
    onWait(on) { jev.wait = on; },
    onPause(paused) { clock.paused = paused; jev.stepping = false; },
    onStep() { jev.stepping = true; clock.paused = false; },
    onSpeed(scale) { clock.scale = scale; },
    getLog: () => log,
  });

  function release() {
    const held = dirName(scene.heldDir);
    if (held) scene.releaseDir(held);
    queued = null;
  }

  // The decision tile is the tile that the player moves to, or the player tile.
  function decisionPoint() {
    const pl = scene.player;
    const heading = dirName(pl.dir);
    const tile = pl.dir ? { row: pl.row + pl.dir.row, col: pl.col + pl.dir.col } : { row: pl.row, col: pl.col };
    return { tile, heading, key: tile.row + "," + tile.col + "|" + scene.lives };
  }

  function record(entry) {
    entry.n = log.length + 1;
    entry.time = new Date().toISOString();
    entry.variant = variant.name;
    log.push(entry);
    if (entry.applied) score.record(entry.source);
    panel.addLog(entry);
    if (entry.source !== "code") {
      panel.showDecision(entry);
      if (entry.applied) arrows.draw(entry);
    }
  }

  function apply(choice, key) {
    const heading = dirName(scene.player.dir);
    if (heading && choice === OPPOSITE[heading]) {
      // The game reverses immediately. Stop at the tile center first, then reverse.
      release();
      queued = { choice, key };
    } else {
      scene.holdDir(choice);
    }
    handled = true;
  }

  async function decide(snapshot, key) {
    jev.pending = true;
    if (jev.wait) clock.hold = true;
    const options = Object.keys(snapshot.options);
    const entry = { source: "jev", tile: snapshot.tile, options, state: snapshot };
    const started = performance.now();

    try {
      // Build the questions inside the try, so that an error in attendee code becomes a FALLBACK, not a frozen game.
      const questions = variant.buildQuestions(snapshot);
      entry.questions = questions;
      const response = await askJev({ state: snapshot, model: variant.MODEL, questions });
      const answers = response.answers || {};
      const move = answers.move;
      entry.model = response.model;
      entry.usage = response.usage;
      entry.answers = answers;
      if (!move) throw new Error("the response has no answer for move");
      entry.jev_choice = move.choice;
      entry.confidence = move.confidence;
      entry.probabilities = move.probabilities;
      // Code rejects an answer that is not in the option set.
      if (!options.includes(move.choice)) throw new Error(`"${move.choice}" is not in the option set`);
      if (!(move.confidence >= variant.MIN_CONFIDENCE)) throw new Error(`confidence is less than ${variant.MIN_CONFIDENCE}`);

      const result = variant.combine(answers, snapshot);
      if (!result || !options.includes(result.choice)) throw new Error(`combine() returned "${result && result.choice}", which is not legal`);
      entry.choice = result.choice;
      if (result.reason || result.choice !== move.choice) {
        // CODE DECISION: the attendee code changed the move of Jev.
        entry.source = "override";
        entry.reason = result.reason || "combine() changed the move";
      }
    } catch (err) {
      entry.source = "fallback";
      entry.reason = err && err.name === "TimeoutError" ? `no answer in ${TIMEOUT_MS} ms` : String((err && err.message) || err);
      entry.choice = fallbackMove(snapshot);
    }
    entry.latency_ms = Math.round(performance.now() - started);
    jev.pending = false;
    clock.hold = false;

    // The player can lose a life during the request. Then the answer is for an old state.
    const current = decisionPoint();
    entry.applied = jev.enabled && scene.phase === "playing" && current.key === key && entry.choice !== null;
    if (entry.applied) apply(entry.choice, key);
    else entry.note = "discarded: the state changed before the answer";
    record(entry);

    if (entry.applied && jev.stepping) {
      jev.stepping = false;
      clock.paused = true;
      panel.setPaused(true);
    }
  }

  function tick() {
    score.update();
    panel.showScore(score.summary());
    if (!jev.enabled || scene.phase !== "playing") { seenKey = null; queued = null; return; }
    if (clock.paused || jev.pending) return;

    const { tile, heading, key } = decisionPoint();
    if (queued) {
      if (queued.key !== key) queued = null;
      else if (!scene.player.dir) { scene.holdDir(queued.choice); queued = null; }
      return;
    }
    if (key !== seenKey) { seenKey = key; handled = false; }
    // A stopped player always needs a decision.
    if (handled && scene.player.dir) return;

    const snapshot = variant.buildSnapshot(scene, tile, heading);
    const options = Object.keys(snapshot.options);
    if (!options.length) return;

    if (variant.shouldAsk(snapshot)) {
      if (variant.CODE_ONLY) {
        // CODE DECISION: the code-only baseline uses the fallback policy and sends no request.
        const choice = fallbackMove(snapshot);
        apply(choice, key);
        record({ source: "fallback", reason: "code-only baseline", tile: snapshot.tile, options, choice, state: snapshot, latency_ms: 0, applied: true });
        return;
      }
      // Stop at the decision tile until the answer arrives.
      release();
      decide(snapshot, key);
      return;
    }

    // CODE DECISION: a corridor or a dead end. Jev does not get a request.
    const forward = options.filter((name) => !snapshot.options[name].reverses_heading);
    const choice = forward.length ? forward[0] : options[0];
    apply(choice, key);
    record({
      source: "code",
      reason: snapshot.removed_by_code
        ? `code removed ${snapshot.removed_by_code.join(", ")} (blocker too near)`
        : options.length === 1 ? "one legal move" : "corridor",
      tile: snapshot.tile,
      options,
      choice,
      applied: true,
    });
  }

  scene.events.on("update", tick);

  jev.destroy = () => {
    scene.events.off("update", tick);
    release();
    arrows.destroy();
    clock.uninstall();
    panel.destroy();
  };
  return jev;
}

export async function startJev() {
  while (!window.__scene) await sleep(50);
  try {
    const variant = await loadVariant(params.get("variant"));
    window.__jev = createPlayer(window.__scene, variant);
  } catch (err) {
    console.error("[jev]", err.message);
    window.__jevError = err.message;
  }
}
