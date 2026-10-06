// The demo page. Both paths run in parallel, through the local server routes.
import facts from "./data/facts.json";
import guideText from "./data/guide.txt?raw";
import { llmOnly, jevFirst } from "./core/pipelines.js";

const $ = (id) => document.getElementById(id);
const words = (s) => (s ? s.trim().split(/\s+/).length : 0);

async function post(path, body) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${path} HTTP ${res.status}`);
  return res.json();
}
const jev = (body) => post("/api/jev", body);
const llm = (body) => post("/api/llm", body);

function showJev(r) {
  $("jev-path").textContent = r.path === "system1" ? "SYSTEM 1" : "SYSTEM 2";
  $("jev-path").dataset.path = r.path;
  $("jev-meta").textContent = `${r.ms} ms · ${words(r.answer)} words`;
  $("jev-why").textContent = r.route ? r.route.why : "";
  $("jev-answer").textContent = r.answer || r.error || "";
  const bars = $("jev-bars");
  bars.innerHTML = "";
  const probs = (r.jev && r.jev.intent && r.jev.intent.probabilities) || {};
  for (const [name, p] of Object.entries(probs).sort((a, b) => b[1] - a[1]).slice(0, 4)) {
    const li = document.createElement("li");
    li.textContent = `${name} ${Math.round(p * 100)}%`;
    li.style.setProperty("--p", String(p));
    bars.appendChild(li);
  }
}

function showLlm(r) {
  $("llm-meta").textContent = `${r.ms} ms · ${words(r.answer)} words`;
  $("llm-answer").textContent = r.answer || r.error || "";
}

$("form").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const q = $("question").value.trim();
  if (!q) return;
  for (const id of ["jev-path", "jev-meta", "jev-why", "jev-answer", "llm-meta", "llm-answer"]) $(id).textContent = "…";
  $("jev-bars").innerHTML = "";
  const fail = (id) => (err) => { $(id).textContent = `Error: ${String((err && err.message) || err)}`; };
  jevFirst(q, { jev, llm, guide: guideText, facts }).then(showJev, fail("jev-answer"));
  llmOnly(q, { llm, guide: guideText }).then(showLlm, fail("llm-answer"));
});
