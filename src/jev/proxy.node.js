// The local proxy for Jev. This file runs in Node only (the Vite server).
// Do not import it from browser code. It adds the Authorization header, so
// that the key stays out of the browser bundle.
import { loadEnv } from "vite";
import { runClaudeCli, runAnthropic } from "./llm.node.js";

// The default upstream is Jev. Set JEV_UPSTREAM_URL in .env to use a server
// with the same protocol, for example Ollama (http://localhost:11434/v1/systemone).
// Set JEV_MODEL to replace the model ID in each request, for example "nimble".
const TYPESAFE_URL = "https://api.typesafe.ai/v1/systemone";
const ROUTE = "/api/jev";
const LLM_ROUTE = "/api/llm";
const MAX_BODY = 64 * 1024;
// A local model can need more than 5 seconds to load. An abort during the load
// cancels the load, so the timeout must be longer than the load time.
const UPSTREAM_TIMEOUT_MS = 20000;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) { reject(new Error("the request body is too large")); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

// Cross-site request forgery guard. A page on another site must not spend the user's Jev
// credit or Claude quota. Accept only same-origin requests with a JSON body: a cross-site
// JSON POST needs a CORS preflight, which this server never approves.
// DNS rebinding guard: an attacker's name can point at 127.0.0.1, so Origin and Host can match.
// Accept local host names only.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function rejectForeign(req, res) {
  let hostname = "";
  try { hostname = new URL(`http://${req.headers.host}`).hostname; } catch { /* A bad Host is foreign. */ }
  if (!LOCAL_HOSTS.has(hostname)) { send(res, 403, { error: "Use localhost to reach this server." }); return true; }
  const origin = req.headers.origin;
  if (origin) {
    let host = "";
    try { host = new URL(origin).host; } catch { /* A bad Origin is foreign. */ }
    if (host !== req.headers.host) { send(res, 403, { error: "Requests from another origin are not allowed." }); return true; }
  }
  if (!String(req.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
    send(res, 415, { error: "Use Content-Type: application/json." });
    return true;
  }
  return false;
}

export function jevProxy() {
  let key = "";
  let url = TYPESAFE_URL;
  let model = "";
  let llmBackend = "none";
  let llmModel = "";
  let anthropicKey = "";

  // POST /api/llm { system, prompt, max_tokens } -> { text, model, usage, ms }
  async function llmHandler(req, res) {
    if (req.method !== "POST") return send(res, 405, { error: "Use POST." });
    if (rejectForeign(req, res)) return;
    if (llmBackend === "none") return send(res, 503, { error: "System 2 is off. Set LLM_BACKEND=claude-cli, or LLM_BACKEND=anthropic with ANTHROPIC_API_KEY, in .env." });
    try {
      const body = JSON.parse((await readBody(req)).toString("utf8"));
      const args = { system: String(body.system || ""), prompt: String(body.prompt || ""), model: llmModel, maxTokens: Math.min(Number(body.max_tokens) || 300, 2000), apiKey: anthropicKey };
      const started = Date.now();
      const r = llmBackend === "anthropic" ? await runAnthropic(args) : await runClaudeCli(args);
      send(res, 200, { ...r, ms: Date.now() - started });
    } catch (err) {
      send(res, 502, { error: String(err.message || err) });
    }
  }

  async function handler(req, res) {
    if (req.method !== "POST") return send(res, 405, { error: "Use POST." });
    if (rejectForeign(req, res)) return;
    // Only the TypeSafe server needs the key.
    if (!key && url === TYPESAFE_URL) return send(res, 503, { error: "TYPESAFE_API_KEY is not set in .env." });
    try {
      let body = await readBody(req);
      if (model) body = JSON.stringify({ ...JSON.parse(body.toString("utf8")), model });
      const headers = { "Content-Type": "application/json" };
      if (key) headers.Authorization = `Bearer ${key}`;
      const started = Date.now();
      const upstream = await fetch(url, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      res.setHeader("X-Jev-Upstream-Ms", String(Date.now() - started));
      send(res, upstream.status, await upstream.text());
    } catch (err) {
      send(res, 502, { error: String(err.message || err) });
    }
  }

  return {
    name: "jev-proxy",
    config(_, { mode }) {
      const env = loadEnv(mode, process.cwd(), ["TYPESAFE_", "JEV_", "LLM_", "ANTHROPIC_"]);
      anthropicKey = env.ANTHROPIC_API_KEY || "";
      llmBackend = env.LLM_BACKEND || (anthropicKey ? "anthropic" : "claude-cli");
      llmModel = env.LLM_MODEL || (llmBackend === "anthropic" ? "claude-sonnet-5-5" : "sonnet");
      key = env.TYPESAFE_API_KEY || "";
      url = env.JEV_UPSTREAM_URL || TYPESAFE_URL;
      model = env.JEV_MODEL || "";
    },
    configureServer(server) { server.middlewares.use(ROUTE, handler); server.middlewares.use(LLM_ROUTE, llmHandler); },
    configurePreviewServer(server) { server.middlewares.use(ROUTE, handler); server.middlewares.use(LLM_ROUTE, llmHandler); },
  };
}
