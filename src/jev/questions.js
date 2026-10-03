// The questions that Jev answers, the rule for when to ask, and how code
// combines the answers. This is the main attendee edit point.
//
// A variant in src/jev/variants/ can replace any export of this file.
// Load a variant with /?jev=1&variant=<file name without .js>.
//
// The exports that the player uses:
//   MODEL, MIN_CONFIDENCE    settings
//   buildSnapshot()          the state (level 2: add fields)
//   buildQuestions()         the questions (level 1: change the text; level 3 and 4: add questions)
//   shouldAsk()              when to send a request
//   combine()                how code turns the answers into one move (level 3 and 4)

export { buildSnapshot } from "./snapshot.js";

// `jev-latest` changes on each release. Pin the version before you tune a threshold.
export const MODEL = "jev-latest";

// The fallback policy makes the decision when the confidence of `move` is less than this value.
export const MIN_CONFIDENCE = 0.2;

// In a corridor, ask Jev only when a blocker is this near.
export const THREAT_STEPS = 4;

const INSTRUCTIONS =
  "Select the next move for the runner in the maze. " +
  "The runner must collect all the collectibles. " +
  "A blocker removes one life when power mode is off. " +
  "When power mode is on, the runner can eat a blocker for points.";

export const steps = (n) => (n === null ? "none" : n + " steps");

export function describeOption(name, option, snapshot) {
  const parts = [`Move ${name}.`];
  if (option.reverses_heading) parts.push("This move reverses the heading.");
  parts.push(`Nearest collectible: ${steps(option.steps_to_collectible)}.`);
  parts.push(`Collectibles near: ${option.collectibles_near}.`);
  parts.push(`Nearest blocker: ${steps(option.steps_to_blocker)}.`);
  parts.push(`Nearest power pellet: ${steps(option.steps_to_power_pellet)}.`);
  parts.push(snapshot.power_seconds_left > 0 ? "Power mode is on." : "Power mode is off.");
  return parts.join(" ");
}

// The `move` Choice is necessary. It has one criterion for each legal direction, and no other option.
// Jev does not see the question key ("move"). The meaning must be in the instructions.
export function buildQuestions(snapshot) {
  const criteria = {};
  for (const [name, option] of Object.entries(snapshot.options)) {
    criteria[name] = describeOption(name, option, snapshot);
  }
  return {
    move: { type: "choice", instructions: INSTRUCTIONS, criteria },
  };
}

// A request for each tile is too slow. Ask Jev only at a decision point.
export function shouldAsk(snapshot) {
  const names = Object.keys(snapshot.options);
  if (names.length < 2) return false;
  if (snapshot.heading === "stopped") return true;
  if (names.length >= 3) return true;
  if (snapshot.power_seconds_left > 0) return false;
  return names.some((name) => {
    const near = snapshot.options[name].steps_to_blocker;
    return near !== null && near <= THREAT_STEPS;
  });
}

// Turn the answers into one move. Return a `reason` when code changes the move
// that Jev chose. The panel then shows OVERRIDE with the reason.
export function combine(answers, snapshot) {
  return { choice: answers.move.choice, reason: null };
}
