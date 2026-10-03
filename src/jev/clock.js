// The pause control, the speed control, and the "wait for Jev" mode.
// The clock wraps the update call of the scene. It does not change src/main.js.
//
// The game timers use the real time. When the game runs at a different speed,
// the clock moves the timers by the difference, so that power mode lasts the
// same count of tiles at each speed.

// The game clamps one step to 50 ms. A faster speed must stay in this limit.
const MAX_STEP_MS = 50;

export function installClock(scene) {
  const original = scene.sys.sceneUpdate;
  // paused: the user stopped the game. hold: the game waits for a Jev answer.
  // gameMs: the game time in the "playing" phase.
  const clock = { scale: 1, paused: false, hold: false, gameMs: 0 };

  scene.sys.sceneUpdate = function (time, delta) {
    const scale = clock.paused || clock.hold ? 0 : clock.scale;
    const step = scale > 1 ? Math.min(delta * scale, Math.max(delta, MAX_STEP_MS)) : delta * scale;
    const lost = delta - step;
    if (lost !== 0 && (scene.phase === "playing" || scene.phase === "ready")) {
      if (scene.powerUntil > time) scene.powerUntil += lost;
      if (scene.phase === "ready") scene.readyUntil += lost;
      scene.enemies.forEach((e) => {
        if (e.eatenUntil > time) e.eatenUntil += lost;
      });
    }
    if (scene.phase === "playing") clock.gameMs += step;
    if (step > 0) original.call(this, time, step);
  };

  clock.uninstall = () => {
    scene.sys.sceneUpdate = original;
  };
  return clock;
}
