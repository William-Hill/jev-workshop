"""Command line for the F1 pit test.

  cd f1 && set -a && . ../.env && set +a
  .venv/bin/python -m f1pit.run train
  .venv/bin/python -m f1pit.run tune                       # Jev only: choose the thresholds
  .venv/bin/python -m f1pit.run tune --system2 on --dry-run  # count the System 2 calls, no LLM call
  .venv/bin/python -m f1pit.run tune --system2 on          # decide if System 2 stays
  .venv/bin/python -m f1pit.run test --system2 off|on      # once, after every choice is fixed
"""
import argparse
import asyncio
import hashlib
import json
import os
import pickle
import statistics
import time
from concurrent.futures import ThreadPoolExecutor
import pandas as pd
from .config import TRAIN_RACES, TUNE_RACES, TEST_RACES, RESULTS_DIR, DATA_DIR, JEV_MODEL
from .data import load_race, pit_loss_s, typical_stints
from .facts import lap_facts
from .baselines import rule_prob, features, train_logreg, logreg_prob
from .jev import jev_probs, INSTRUCTIONS
from .metrics import lap_metrics, event_metrics
from .system2 import should_escalate, ask_llm

JEV_PER_MTOK = 0.042
TOKENS_PER_LAP = 750  # Measured: about 733 input tokens for each lap (40 laps, 2026-10-07).
SPEND_CAP_USD = 5.0
THRESHOLDS = (0.2, 0.3, 0.4, 0.5, 0.6, 0.7)
# Pickle is safe here: cmd_train() writes this file itself in f1/data/ (not committed). Never load a pickle from elsewhere.
MODEL_PATH = os.path.join(DATA_DIR, "model.pkl")
CHOICES_PATH = os.path.join(DATA_DIR, "choices.json")


def facts_for(races, typical):
    rows = []
    for year, rnd in races:
        t = load_race(year, rnd)
        loss = pit_loss_s(t)
        for _, r in t.iterrows():
            rows.append({"race": r["race"], "driver": r["driver"], "lap": int(r["lap"]), "pitted": bool(r["pitted"]),
                         "facts": lap_facts(r, typical, loss)})
    return rows


def cmd_train():
    tables = [load_race(*r) for r in TRAIN_RACES]
    typical = typical_stints(tables)
    rows = facts_for(TRAIN_RACES, typical)
    model = train_logreg([features(r["facts"]) for r in rows], [int(r["pitted"]) for r in rows])
    with open(MODEL_PATH, "wb") as fh:
        pickle.dump({"model": model, "typical": typical}, fh)
    print("typical stint lengths:", typical, "| training rows:", len(rows), "| stops:", sum(r["pitted"] for r in rows))


def prepared_rows(races):
    with open(MODEL_PATH, "rb") as fh:
        saved = pickle.load(fh)
    rows = facts_for(races, saved["typical"])
    for r in rows:
        r["rule"] = rule_prob(r["facts"])
        r["logreg"] = logreg_prob(saved["model"], r["facts"])
    return rows


def add_jev(rows):
    """Jev probabilities, cached on disk for each question version, so a second scoring sends no request."""
    key = hashlib.sha1((JEV_MODEL + INSTRUCTIONS).encode()).hexdigest()[:10]
    path = os.path.join(DATA_DIR, f"jev-{key}.json")
    cache = json.load(open(path)) if os.path.exists(path) else {}
    rid = lambda r: f"{r['race']}|{r['driver']}|{r['lap']}"
    todo = [r for r in rows if cache.get(rid(r)) is None]
    est = len(todo) * TOKENS_PER_LAP * JEV_PER_MTOK / 1e6
    print(f"{len(rows)} driver-laps, {len(todo)} not in the cache; Jev estimate ${est:.2f}")
    if est > SPEND_CAP_USD:
        raise SystemExit(f"The estimate is over the ${SPEND_CAP_USD} cap. Stop.")
    usage = errors = 0
    if todo:
        probs = asyncio.run(jev_probs([r["facts"] for r in todo]))
        usage, errors = jev_probs.last_usage, jev_probs.last_errors
        for r, p in zip(todo, probs):
            cache[rid(r)] = p
        with open(path, "w") as fh:
            json.dump(cache, fh)
    for r in rows:
        r["jev"] = cache.get(rid(r))
    return {"jev_input_tokens": usage, "jev_errors": errors, "jev_cost_usd": round(usage * JEV_PER_MTOK / 1e6, 4),
            "jev_missing": sum(r["jev"] is None for r in rows)}


def frame(rows):
    df = pd.DataFrame([{k: v for k, v in r.items() if k != "facts"} for r in rows])
    df["neutral"] = [r["facts"]["safety_car"] or r["facts"]["virtual_safety_car"] for r in rows]
    return df


def event_f1(e):
    a, b = e["found_share"] or 0, e["correct_call_share"] or 0
    return round(2 * a * b / (a + b), 3) if a + b else 0.0


def score(df, col, threshold):
    out = {"threshold": threshold, **lap_metrics(df["pitted"], df[col].tolist(), threshold), **event_metrics(df, col, threshold)}
    out["event_f1"] = event_f1(out)
    sc = df[df["neutral"]]
    if len(sc) and sc["pitted"].any():
        out["safety_car_laps"] = {**lap_metrics(sc["pitted"], sc[col].tolist(), threshold), **event_metrics(sc, col, threshold)}
    return out


def pick_threshold(df, col):
    """The best stops-found share with at least half the calls correct; else the most correct calls."""
    table = {t: event_metrics(df, col, t) for t in THRESHOLDS}
    ok = [t for t, e in table.items() if (e["correct_call_share"] or 0) >= 0.5]
    best = max(ok, key=lambda t: table[t]["found_share"] or 0) if ok else max(table, key=lambda t: table[t]["correct_call_share"] or 0)
    return best, {str(t): e for t, e in table.items()}


def run_system2(rows, threshold_col, dry_run):
    esc = [r for r in rows if should_escalate(r[threshold_col], r["facts"])]
    print(f"System 2 would get {len(esc)} of {len(rows)} driver-laps ({len(esc) / len(rows):.1%}).")
    for r in rows:
        r["final"] = r[threshold_col]
    if dry_run or not esc:
        return {"system2_calls": len(esc), "dry_run": dry_run}
    with ThreadPoolExecutor(max_workers=4) as pool:
        answers = list(pool.map(lambda r: ask_llm(r["facts"]), esc))
    for r, a in zip(esc, answers):
        r["system2"] = a["text"]
        if a["p"] is not None:
            r["final"] = a["p"]  # SYSTEM 2: the LLM answer replaces the Jev probability for this lap.
    ms = sorted(a["ms"] for a in answers)
    tok = lambda k: sum((a["usage"] or {}).get(k, 0) or 0 for a in answers)
    return {"system2_calls": len(esc), "system2_unparsed": sum(a["p"] is None for a in answers),
            "system2_changed": sum(1 for r, a in zip(esc, answers) if a["p"] is not None and (a["p"] >= 0.5) != ((r["jev"] or 0) >= r["_t"])),
            "system2_ms_p50": ms[len(ms) // 2], "system2_ms_p95": ms[int(len(ms) * 0.95)],
            "system2_tokens": {k: tok(k) for k in ("input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens", "output_tokens")}}


def save(result, label):
    os.makedirs(RESULTS_DIR, exist_ok=True)
    path = os.path.join(RESULTS_DIR, f"{label}-{time.strftime('%Y%m%dT%H%M%S')}.json")
    with open(path, "w") as fh:
        json.dump(result, fh, indent=1)
    print("Results:", path)


def summary_line(name, s):
    return (f"{name:8} t={s['threshold']}  precision {s['precision']}  recall {s['recall']}  AP {s['average_precision']}  "
            f"Brier {s['brier']}  ECE {s['ece']}  found {s['found_share']}  correct {s['correct_call_share']}  event F1 {s['event_f1']}")


def cmd_tune(system2, dry_run):
    rows = prepared_rows(TUNE_RACES)
    cost = add_jev(rows)
    df = frame(rows)
    choices = json.load(open(CHOICES_PATH)) if os.path.exists(CHOICES_PATH) else {}
    if not system2:
        choices["logreg"], logreg_table = pick_threshold(df, "logreg")
        choices["jev"], jev_table = pick_threshold(df, "jev")
        choices["rule"] = 0.5
        scores = {c: score(df, c, choices[c]) for c in ("rule", "logreg", "jev")}
        for c, s in scores.items():
            print(summary_line(c, s))
        with open(CHOICES_PATH, "w") as fh:
            json.dump(choices, fh, indent=1)
        save({"step": "tune", "races": [r for r in sorted(df["race"].unique())], **cost, "choices": choices,
              "threshold_tables": {"logreg": logreg_table, "jev": jev_table}, "scores": scores}, "tune")
        return
    for r in rows:
        r["_t"] = choices["jev"]
    s2 = run_system2(rows, "jev", dry_run)
    if dry_run:
        return
    df = frame(rows)
    jev_s, final_s = score(df, "jev", choices["jev"]), score(df, "final", choices["jev"])
    choices["system2"] = final_s["event_f1"] > jev_s["event_f1"]
    print(summary_line("jev", jev_s))
    print(summary_line("jev+s2", final_s))
    print("Keep System 2:", choices["system2"])
    with open(CHOICES_PATH, "w") as fh:
        json.dump(choices, fh, indent=1)
    save({"step": "tune-system2", **cost, **s2, "choices": choices, "scores": {"jev": jev_s, "final": final_s}}, "tune-s2")


def cmd_test(system2, dry_run):
    choices = json.load(open(CHOICES_PATH))
    rows = prepared_rows(TEST_RACES)
    cost = add_jev(rows)
    s2 = {}
    if system2:
        for r in rows:
            r["_t"] = choices["jev"]
        s2 = run_system2(rows, "jev", dry_run)
        if dry_run:
            return
    df = frame(rows)
    cols = ("rule", "logreg", "jev") + (("final",) if system2 else ())
    scores = {c: score(df, c, choices["jev" if c == "final" else c]) for c in cols}
    for c, s in scores.items():
        print(summary_line("jev+s2" if c == "final" else c, s))
    save({"step": "test", "system2": system2, "races": sorted(df["race"].unique()), **cost, **s2, "choices": choices,
          "scores": scores}, f"test-s2{'on' if system2 else 'off'}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("step", choices=["train", "tune", "test"])
    ap.add_argument("--system2", choices=["on", "off"], default="off")
    ap.add_argument("--dry-run", action="store_true", help="count the System 2 calls; make no LLM call")
    a = ap.parse_args()
    if a.step == "train":
        cmd_train()
    elif a.step == "tune":
        cmd_tune(a.system2 == "on", a.dry_run)
    else:
        cmd_test(a.system2 == "on", a.dry_run)


if __name__ == "__main__":
    main()
