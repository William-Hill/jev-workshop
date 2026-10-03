# Jev-only rerun of 02-house-rules-n24 against the direct TypeSafe API.
# The data (ITEMS, TEAMS, NEUTRAL, HOUSE, EXAMPLES, CONDITIONS) is read verbatim from the upstream
# script with ast, so the upstream OpenRouter import chain does not run.
# The request body (state, questions) is the same as upstream jev_one(); only URL, model and key change.
import ast
import concurrent.futures as cf
import json
import os
import pathlib
import sys
import time
import urllib.error
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
SRC = HERE / "experiments/jev-decisions-api/02-house-rules-n24/bench/jev_houserule_n24_20260919.py"
URL = "https://api.typesafe.ai/v1/systemone"
MODEL = "jev-latest"
KEEP = {"ITEMS", "TEAMS", "NEUTRAL", "HOUSE", "EXAMPLES", "CONDITIONS"}

ns = {}
for node in ast.parse(SRC.read_text(encoding="utf-8")).body:
    if isinstance(node, ast.Assign) and any(getattr(t, "id", None) in KEEP for t in node.targets):
        exec(compile(ast.Module([node], []), str(SRC), "exec"), ns)
ITEMS, EXAMPLES, CONDITIONS = ns["ITEMS"], ns["EXAMPLES"], ns["CONDITIONS"]

KEY = os.environ.get("TYPESAFE_API_KEY") or sys.exit("set TYPESAFE_API_KEY")
HDR = {"Authorization": "Bearer " + KEY, "Content-Type": "application/json"}


def post(body, timeout=120):
    req = urllib.request.Request(URL, method="POST", data=json.dumps(body).encode(), headers=HDR)
    for attempt in (0, 1):
        t0 = time.time()
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return {"ok": True, "ms": int((time.time() - t0) * 1000), "d": json.load(r)}
        except urllib.error.HTTPError as e:
            err = "HTTP %d %s" % (e.code, e.read().decode("utf-8", "replace")[:160])
        except Exception as exc:  # noqa: BLE001
            err = repr(exc)[:160]
        time.sleep(2)
    return {"ok": False, "error": err}


def jev_one(crit, examples, text):
    state = {"message": text}
    if examples:
        state["past_routing_decisions"] = EXAMPLES
    r = post({"model": MODEL, "state": state,
              "questions": {"team": {"type": "choice", "criteria": crit,
                                     "instructions": "Route this message to a team."}}})
    if not r["ok"]:
        return {"error": r["error"]}
    a = r["d"]["answers"]["team"]
    u = r["d"].get("usage") or {}
    return {"picked": a["choice"], "conf": a.get("confidence"), "probs": a.get("probabilities"),
            "model": r["d"].get("model"), "ms": r["ms"],
            "in": u.get("input_tokens") or 0, "out": u.get("output_tokens") or 0}


def run_once(run_id):
    tasks = [(ci, ii) for ci in range(len(CONDITIONS)) for ii in range(len(ITEMS))]
    res = [[None] * len(ITEMS) for _ in CONDITIONS]

    def work(t):
        ci, ii = t
        _, crit, ex = CONDITIONS[ci]
        text, truth = ITEMS[ii]
        out = jev_one(crit, ex, text)
        out["truth"] = truth
        if "picked" in out:
            out["hit"] = out["picked"] == truth
        return ci, ii, out

    with cf.ThreadPoolExecutor(max_workers=4) as pool:
        for ci, ii, out in pool.map(work, tasks):
            res[ci][ii] = out
    return res


def main():
    n_runs = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    all_runs = []
    for k in range(n_runs):
        t0 = time.time()
        res = run_once(k)
        all_runs.append(res)
        print("run %d (%.0fs)" % (k + 1, time.time() - t0))
        for ci, (label, _, _) in enumerate(CONDITIONS):
            rows = res[ci]
            ok = [r for r in rows if "picked" in r]
            hit = [r["conf"] for r in ok if r["hit"]]
            mis = [r["conf"] for r in ok if not r["hit"]]
            print("  %-42s %2d/%d  errors=%d  hitconf=%s missconf=%s miss>0.90=%d"
                  % (label, len(hit), len(ok), len(rows) - len(ok),
                     "%.3f" % (sum(hit) / len(hit)) if hit else "-",
                     "%.3f" % (sum(mis) / len(mis)) if mis else "-",
                     sum(c > 0.90 for c in mis)))
    out = HERE / "results-direct.json"
    out.write_text(json.dumps({"items": ITEMS, "runs": all_runs}, indent=1), encoding="utf-8")
    print("written: %s" % out)


if __name__ == "__main__":
    main()
