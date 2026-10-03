// Baseline with no Jev: the fallback policy in src/jev/fallback.js makes every decision.
// Use it to measure what Jev adds over plain code. It sends no request.
// Load it with /?jev=1&variant=code-only
export * from "../questions.js";

export const CODE_ONLY = true;
