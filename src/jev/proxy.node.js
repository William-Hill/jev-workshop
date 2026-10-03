// The local proxy for Jev. This file runs in Node only (the Vite server).
// Do not import it from browser code. It adds the Authorization header, so
// that the key stays out of the browser bundle.
import { loadEnv } from "vite";

// The default upstream is Jev. Set JEV_UPSTREAM_URL in .env to use a server
// with the same protocol, for example Ollama (http://localhost:11434/v1/systemone).
// Set JEV_MODEL to replace the model ID in each request, for example "nimble".
const TYPESAFE_URL = "https://api.typesafe.ai/v1/systemone";
const ROUTE = "/api/jev";
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

export function jevProxy() {
  let key = "";
  let url = TYPESAFE_URL;
  let model = "";

  async function handler(req, res) {
    if (req.method !== "POST") return send(res, 405, { error: "Use POST." });
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
      const env = loadEnv(mode, process.cwd(), ["TYPESAFE_", "JEV_"]);
      key = env.TYPESAFE_API_KEY || "";
      url = env.JEV_UPSTREAM_URL || TYPESAFE_URL;
      model = env.JEV_MODEL || "";
    },
    configureServer(server) { server.middlewares.use(ROUTE, handler); },
    configurePreviewServer(server) { server.middlewares.use(ROUTE, handler); },
  };
}
