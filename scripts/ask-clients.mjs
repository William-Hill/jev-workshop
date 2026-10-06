// Node clients for the A/B benchmark. Keys come from .env and stay in this process.
// LLM_BACKEND=claude-cli (the default when ANTHROPIC_API_KEY is not set) uses headless
// Claude Code with the user's own login; LLM_BACKEND=anthropic uses the API key.
import { spawn } from "node:child_process";

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

// No user settings (no personal CLAUDE.md, hooks, or plugins), no tools, no saved session:
// the model sees only our system prompt and the question.
export function cliArgs({ system, model }) {
  return ["-p", "--model", model, "--output-format", "json", "--system-prompt", system,
    "--tools", "", "--setting-sources", "", "--no-session-persistence"];
}

function llmCli({ system, prompt }) {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", cliArgs({ system, model: LLM_MODEL }), { cwd: "/tmp", stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    const timer = setTimeout(() => { child.kill("SIGTERM"); reject(new Error("claude -p timed out after 120 s")); }, 120000);
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { err += d; });
    child.on("close", (code) => {
      clearTimeout(timer);
      try {
        const d = JSON.parse(out);
        if (code !== 0 || d.is_error) return reject(new Error(`claude -p failed: ${String(d.result || err).slice(0, 200)}`));
        resolve({ text: d.result, usage: d.usage, model: LLM_MODEL, costUsd: d.total_cost_usd, modelMs: d.duration_ms });
      } catch {
        reject(new Error(`claude -p returned no JSON: ${err.slice(0, 200)}`));
      }
    });
    child.stdin.end(prompt);
  });
}

async function llmApi({ system, prompt, max_tokens }) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 60000 });
  const msg = await client.messages.create({ model: LLM_MODEL, max_tokens, system, messages: [{ role: "user", content: prompt }] });
  return { text: msg.content.filter((c) => c.type === "text").map((c) => c.text).join(""), usage: msg.usage, model: msg.model };
}

export const llm = LLM_BACKEND === "anthropic" ? llmApi : llmCli;
