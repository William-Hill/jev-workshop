// The LLM for System 2 and the LLM-only path. Node only: do not import it from browser code.
// Backends: "claude-cli" (headless Claude Code with the user's own login), "anthropic"
// (ANTHROPIC_API_KEY), or "none" (off, for tests).
import { spawn } from "node:child_process";

// No user settings (no personal CLAUDE.md, hooks, or plugins), no tools, no saved session:
// the model sees only our system prompt and the prompt.
export function cliArgs({ system, model }) {
  return ["-p", "--model", model, "--output-format", "json", "--system-prompt", system,
    "--tools", "", "--setting-sources", "", "--no-session-persistence"];
}

export function runClaudeCli({ system, prompt, model, timeoutMs = 120000 }) {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", cliArgs({ system, model }), { cwd: "/tmp", stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    const timer = setTimeout(() => { child.kill("SIGTERM"); reject(new Error(`claude -p timed out after ${timeoutMs / 1000} s`)); }, timeoutMs);
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { err += d; });
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => {
      clearTimeout(timer);
      try {
        const d = JSON.parse(out);
        if (code !== 0 || d.is_error) return reject(new Error(`claude -p failed: ${String(d.result || err).slice(0, 200)}`));
        resolve({ text: d.result, usage: d.usage, model, costUsd: d.total_cost_usd, modelMs: d.duration_ms });
      } catch {
        reject(new Error(`claude -p returned no JSON: ${err.slice(0, 200)}`));
      }
    });
    child.stdin.end(prompt);
  });
}

export async function runAnthropic({ system, prompt, model, maxTokens, apiKey }) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey, timeout: 60000 });
  const msg = await client.messages.create({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: prompt }] });
  return { text: msg.content.filter((c) => c.type === "text").map((c) => c.text).join(""), usage: msg.usage, model: msg.model };
}
