// Compare variants that played the same seeds: wins, a 95% Wilson interval, and exact McNemar tests.
import fs from "node:fs";
const [base, ...variants] = process.argv.slice(2); // base seed, then variant names
const load = (v) => {
  const f = fs.readdirSync("bench-results").filter((x) => x.startsWith(v + "-normal-") && x.endsWith(".json")).sort()
    .map((x) => JSON.parse(fs.readFileSync("bench-results/" + x))).filter((r) => r.summary.seed_base === Number(base)).pop();
  if (!f) throw new Error(`No run of ${v} with seed ${base}`);
  return Object.fromEntries(f.games.map((g) => [g.seed, g]));
};
const wilson = (k, n) => { const z = 1.96, p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), m = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return [(c - m) / d, (c + m) / d].map((x) => Math.round(x * 100)); };
const choose = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return r; };
const R = Object.fromEntries(variants.map((v) => [v, load(v)]));
for (const v of variants) {
  const g = Object.values(R[v]); const k = g.filter((x) => x.result === "won").length;
  console.log(`${v.padEnd(20)} won ${k} of ${g.length}, 95% interval ${wilson(k, g.length).join("-")}%, lives lost ${(g.reduce((a, x) => a + 3 - x.lives, 0) / g.length).toFixed(2)}`);
}
for (let i = 0; i < variants.length; i++) for (let j = i + 1; j < variants.length; j++) {
  const a = variants[i], b = variants[j]; let ab = 0, ba = 0;
  for (const s of Object.keys(R[a])) { if (!R[b][s]) continue; const wa = R[a][s].result === "won", wb = R[b][s].result === "won"; if (wa && !wb) ab++; if (wb && !wa) ba++; }
  const m = ab + ba; let p = 0; for (let x = 0; x <= Math.min(ab, ba); x++) p += choose(m, x) * 0.5 ** m;
  console.log(`  ${a} vs ${b}: only ${a} won ${ab}, only ${b} won ${ba}, exact p ${m ? Math.min(1, 2 * p).toFixed(3) : "n/a"}`);
}
