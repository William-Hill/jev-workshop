// The two paths of the A/B test. Both use the same LLM and the same guide text.
import { buildJevRequest, decideRoute } from "./system1.js";
import { answerFromFacts } from "./templates.js";

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

export function systemPrompt(guide) {
  return [
    "You answer questions from people who think about attending RenderATL 2027.",
    "Use only the guide below for facts. Copy prices, dates, and addresses exactly as the guide writes them.",
    "If the guide does not answer the question, say so in one sentence.",
    "<guide>", guide, "</guide>",
  ].join("\n");
}

async function callLlm(llm, guide, prompt) {
  try {
    const r = await llm({ system: systemPrompt(guide), prompt, max_tokens: 600 });
    return { answer: r.text, llmUsage: r.usage, llmCostUsd: r.costUsd, llmModelMs: r.modelMs, model: r.model };
  } catch (err) {
    return { answer: "", error: String((err && err.message) || err) };
  }
}

export async function llmOnly(question, { llm, guide }) {
  const t0 = now();
  const r = await callLlm(llm, guide, question);
  return { path: "llm_only", ...r, ms: Math.round(now() - t0) };
}

export async function jevFirst(question, { jev, llm, guide, facts, thresholds = {} }) {
  const t0 = now();
  let response = null, route;
  try {
    response = await jev(buildJevRequest(question, facts));
    route = decideRoute(response.answers, thresholds);
  } catch (err) {
    route = { path: "system2", intent: null, probability: 0, why: `Jev failed: ${String((err && err.message) || err)}` };
  }
  if (route.path === "system1") {
    let answer = null;
    try {
      answer = answerFromFacts(route.intent, response.answers.ticket && response.answers.ticket.choice, question, facts);
      // Code decided, in place of Jev: the template found no fact for this question.
      if (answer === null) route = { ...route, path: "system2", why: `no fact in facts.json answers this "${route.intent}" question` };
    } catch (err) {
      route = { ...route, path: "system2", why: `the template failed: ${String((err && err.message) || err)}` };
    }
    if (answer !== null && route.path === "system1") return { path: "system1", answer, route, jev: response.answers, jevUsage: response.usage, ms: Math.round(now() - t0) };
  }
  const hint = route.intent ? `\n\n(Topic of this question, from a classifier: ${route.intent}.)` : "";
  const r = await callLlm(llm, guide, question + hint);
  return { path: "system2", ...r, route, jev: response && response.answers, jevUsage: response && response.usage, ms: Math.round(now() - t0) };
}
