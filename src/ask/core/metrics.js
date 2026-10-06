// Scores for the A/B test.
const norm = (s) => String(s).toLowerCase().replace(/\s+/g, " ");

export function checkFacts(answer, expect) {
  const a = norm(answer);
  return expect.every((e) => a.includes(norm(e)));
}

const pct = (xs, p) => { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };

// The LLM cost of one row: the reported cost (claude -p) when it exists, else tokens times list prices.
function llmCost(x, prices) {
  if (typeof x.llmCostUsd === "number") return x.llmCostUsd;
  const u = x.llmUsage || {};
  return (u.input_tokens || 0) * prices.llmInPerMTok / 1e6 + (u.output_tokens || 0) * prices.llmOutPerMTok / 1e6;
}

export function summarize(rows, prices) {
  const out = {};
  for (const variant of ["llm_only", "jev_first"]) {
    const r = rows.filter((x) => x.variant === variant);
    if (!r.length) continue;
    const ms = r.map((x) => x.ms);
    const cost = r.reduce((sum, x) => sum + ((x.jevUsage && x.jevUsage.input_tokens) || 0) * prices.jevPerMTok / 1e6 + llmCost(x, prices), 0);
    out[variant] = {
      n: r.length,
      factAccuracy: r.filter((x) => x.ok).length / r.length,
      msMean: Math.round(ms.reduce((a, b) => a + b, 0) / r.length),
      msP50: pct(ms, 0.5),
      msP95: pct(ms, 0.95),
      costPer1000: Math.round(cost / r.length * 1000 * 100) / 100,
      wordsMean: Math.round(r.reduce((a, x) => a + x.words, 0) / r.length),
      errors: r.filter((x) => x.error).length,
    };
    if (variant === "jev_first") {
      out[variant].system2Share = r.filter((x) => x.path === "system2").length / r.length;
      out[variant].intentAccuracy = r.filter((x) => x.intentOk).length / r.length;
    }
  }
  return out;
}
