// Node clients for the A/B benchmark. Keys come from .env and stay in this process.
// LLM_BACKEND=claude-cli (the default when ANTHROPIC_API_KEY is not set) uses headless
// Claude Code with the user's own login; LLM_BACKEND=anthropic uses the API key.

try { process.loadEnvFile(".env"); } catch { /* Tests import this file without .env. */ }

const TYPESAFE_URL = "https://api.typesafe.ai/v1/systemone";
export const LLM_BACKEND = process.env.LLM_BACKEND || (process.env.ANTHROPIC_API_KEY ? "anthropic" : "claude-cli");
export const LLM_MODEL = process.env.LLM_MODEL || (LLM_BACKEND === "anthropic" ? "claude-sonnet-5-5" : "sonnet");

export async function jev(body) {
  const res = await fetch(TYPESAFE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Jev HTTP ${res.status}`);
  return res.json();
}

import { cliArgs, runClaudeCli, runAnthropic } from "../src/jev/llm.node.js";
export { cliArgs };

const llmCli = ({ system, prompt }) => runClaudeCli({ system, prompt, model: LLM_MODEL });
const llmApi = ({ system, prompt, max_tokens }) => runAnthropic({ system, prompt, model: LLM_MODEL, maxTokens: max_tokens, apiKey: process.env.ANTHROPIC_API_KEY });

export const llm = LLM_BACKEND === "anthropic" ? llmApi : llmCli;
