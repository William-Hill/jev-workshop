"""Scores against the teams' real stops. Pit laps are rare, so accuracy alone misleads."""
import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score, brier_score_loss, precision_recall_fscore_support


def lap_metrics(y, p, threshold: float) -> dict:
    pairs = [(int(a), float(b)) for a, b in zip(y, p) if b is not None and not (isinstance(b, float) and np.isnan(b))]
    missing = len(list(y)) - len(pairs)
    yy = np.array([a for a, _ in pairs])
    pp = np.array([b for _, b in pairs])
    pred = (pp >= threshold).astype(int)
    prec, rec, f1, _ = precision_recall_fscore_support(yy, pred, average="binary", zero_division=0)
    bins = np.clip((pp * 10).astype(int), 0, 9)
    ece = sum(abs(pp[bins == b].mean() - yy[bins == b].mean()) * (bins == b).sum() for b in range(10) if (bins == b).any()) / len(pp)
    return {
        "n": len(pp), "missing": missing, "positives": int(yy.sum()),
        "precision": round(float(prec), 3), "recall": round(float(rec), 3), "f1": round(float(f1), 3),
        "average_precision": round(float(average_precision_score(yy, pp)), 3) if yy.any() else None,
        "brier": round(float(brier_score_loss(yy, pp)), 4), "ece": round(float(ece), 4),
    }


def event_metrics(df: pd.DataFrame, prob_col: str, threshold: float, tolerance: int = 1) -> dict:
    found = total_stops = correct = total_calls = 0

    def near(lap, laps):
        return any(abs(lap - x) <= tolerance for x in laps)

    for _, g in df.groupby(["race", "driver"]):
        stops = set(g.loc[g["pitted"], "lap"])
        calls = set(g.loc[g[prob_col].astype(float).fillna(-1) >= threshold, "lap"])
        total_stops += len(stops)
        found += sum(1 for s in stops if near(s, calls))
        total_calls += len(calls)
        correct += sum(1 for c in calls if near(c, stops))
    return {
        "stops": total_stops, "calls": total_calls,
        "found_share": round(found / total_stops, 3) if total_stops else None,
        "correct_call_share": round(correct / total_calls, 3) if total_calls else None,
    }
