// The decision panel. It shows how Jev makes each decision.
import "./panel.css";

const NAMES = ["up", "left", "right", "down"];
const LABEL = { jev: "JEV", override: "OVERRIDE", system2: "SYSTEM 2", fallback: "FALLBACK", code: "CODE" };
const SPEEDS = [0.25, 0.5, 1, 2];
const LOG_ROWS = 40;

const pct = (p) => Math.round((p || 0) * 100) + "%";
const num = (n) => (typeof n === "number" ? n.toFixed(2) : "n/a");

export function createPanel({ variant, wait, speed, onEnable, onWait, onPause, onStep, onSpeed, getLog }) {
  const speeds = SPEEDS.includes(speed) ? SPEEDS : [...SPEEDS, speed].sort((a, b) => a - b);
  const root = document.createElement("aside");
  root.className = "jevpanel";
  root.setAttribute("aria-label", "Jev decision panel");
  root.innerHTML = `
    <div class="jev-head">
      <h3 class="mono">Jev Player <span class="jev-variant" data-jev="variant"></span></h3>
      <label class="mono"><input type="checkbox" data-jev="enable" checked> Jev plays</label>
    </div>
    <div class="jev-ctrl">
      <button class="ctrl-btn head" data-jev="pause">Pause Jev</button>
      <button class="ctrl-btn head" data-jev="step">Step</button>
      <label class="mono">Speed
        <select data-jev="speed">
          ${speeds.map((s) => `<option value="${s}"${s === speed ? " selected" : ""}>${s}×</option>`).join("")}
        </select>
      </label>
      <label class="mono" title="Stop the game while a request runs, so that the latency does not change the result">
        <input type="checkbox" data-jev="wait"${wait ? " checked" : ""}> Wait for Jev
      </label>
    </div>
    <dl class="jev-score mono" data-jev="score">
      <div><dt>Points</dt><dd data-jev="points">0</dd></div>
      <div><dt>Jev share</dt><dd data-jev="share">—</dd></div>
      <div><dt>By Jev</dt><dd data-jev="byjev">0</dd></div>
      <div><dt>By fallback</dt><dd data-jev="byfallback">0</dd></div>
      <div><dt>Lives lost</dt><dd data-jev="lost">0</dd></div>
    </dl>
    <div class="jev-decision">
      <span class="jev-source mono" data-jev="source">WAIT</span>
      <strong class="disp" data-jev="choice">—</strong>
      <span class="mono" data-jev="meta"></span>
    </div>
    <p class="jev-reason mono" data-jev="reason" hidden></p>
    <ul class="jev-bars" data-jev="bars">
      ${NAMES.map((n) => `<li data-dir="${n}"><span class="mono">${n}</span><span class="jev-bar"><i></i></span><span class="mono jev-p">—</span></li>`).join("")}
    </ul>
    <details open>
      <summary class="mono">State sent</summary>
      <pre class="mono" data-jev="state">No request at this time.</pre>
    </details>
    <details>
      <summary class="mono">Questions sent</summary>
      <pre class="mono" data-jev="questions">No request at this time.</pre>
    </details>
    <div class="jev-loghead">
      <h3 class="mono">Decision log <span data-jev="count">0</span></h3>
      <button class="ctrl-btn head" data-jev="download">Download JSONL</button>
    </div>
    <ol class="jev-log mono" data-jev="log"></ol>
  `;
  document.body.classList.add("jev-on");
  document.querySelector(".wrap").appendChild(root);

  const el = (name) => root.querySelector(`[data-jev="${name}"]`);
  let paused = false;
  el("variant").textContent = variant;
  el("wait").onchange = (ev) => onWait(ev.target.checked);

  function setPaused(value) {
    paused = value;
    el("pause").textContent = paused ? "Resume Jev" : "Pause Jev";
    el("pause").setAttribute("aria-pressed", String(paused));
  }

  el("enable").onchange = (ev) => onEnable(ev.target.checked);
  el("pause").onclick = () => { setPaused(!paused); onPause(paused); };
  el("step").onclick = () => { setPaused(false); onStep(); };
  el("speed").onchange = (ev) => onSpeed(Number(ev.target.value));
  el("download").onclick = () => {
    const text = getLog().map((entry) => JSON.stringify(entry)).join("\n") + "\n";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "application/x-ndjson" }));
    a.download = "decisions.jsonl";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  function showDecision(entry) {
    root.dataset.source = entry.source;
    el("source").textContent = LABEL[entry.source];
    el("choice").textContent = entry.choice || "—";
    const meta = [`${entry.latency_ms} ms`];
    if (typeof entry.confidence === "number") meta.unshift(`confidence ${num(entry.confidence)}`);
    if (entry.model) meta.push(entry.model);
    if (entry.usage) meta.push(`${entry.usage.input_tokens} tokens in`);
    el("meta").textContent = meta.join(" · ");

    const why = entry.source === "override"
      ? `Code changed the move of Jev (${entry.jev_choice}): ${entry.reason}.`
      : entry.reason && `Code made this decision: ${entry.reason}.`;
    const reason = [why, entry.note].filter(Boolean).join(" ");
    el("reason").textContent = reason;
    el("reason").hidden = !reason;

    root.querySelectorAll(".jev-bars li").forEach((li) => {
      const name = li.dataset.dir;
      const legal = entry.options.includes(name);
      const p = entry.probabilities ? entry.probabilities[name] : null;
      li.classList.toggle("illegal", !legal);
      li.classList.toggle("chosen", name === entry.choice);
      li.querySelector("i").style.width = legal && p != null ? pct(p) : "0%";
      li.querySelector(".jev-p").textContent = !legal ? "wall" : p != null ? pct(p) : "—";
    });
    el("state").textContent = JSON.stringify(entry.state, null, 1);
    el("questions").textContent = JSON.stringify(entry.questions, null, 1);
  }

  let lastScore = "";
  function showScore(s) {
    const text = JSON.stringify(s);
    if (text === lastScore) return;
    lastScore = text;
    el("points").textContent = String(s.points);
    el("share").textContent = s.decisions.jev + s.decisions.override + s.decisions.fallback ? pct(s.jev_share) : "—";
    el("byjev").textContent = String(s.collected.jev);
    el("byfallback").textContent = String(s.collected.fallback);
    el("lost").textContent = String(s.lives_lost.jev + s.lives_lost.fallback);
  }

  function addLog(entry) {
    el("count").textContent = String(entry.n);
    const li = document.createElement("li");
    li.dataset.source = entry.source;
    const detail = entry.source === "jev"
      ? `${num(entry.confidence)} · ${entry.latency_ms} ms`
      : entry.source === "override"
        ? `Jev: ${entry.jev_choice} · ${entry.reason}`
        : entry.reason;
    li.textContent = `#${entry.n} ${LABEL[entry.source]} ${entry.choice} (${entry.tile.row},${entry.tile.col}) ${detail}`;
    const list = el("log");
    list.prepend(li);
    while (list.children.length > LOG_ROWS) list.lastChild.remove();
  }

  function destroy() {
    root.remove();
    document.body.classList.remove("jev-on");
  }

  return { showDecision, showScore, addLog, setPaused, destroy };
}
