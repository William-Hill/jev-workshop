"""Two baselines on the same facts: a hand-written rule, and a logistic regression."""
from sklearn.linear_model import LogisticRegression

AGE = {"well before": 0, "near": 1, "past": 2, "unknown": 0}


def rule_prob(f: dict) -> float:
    if f["laps_remaining"] < 3:
        return 0.0
    if (f["safety_car"] or f["virtual_safety_car"]) and f["tyre_age_vs_typical"] in ("near", "past"):
        return 1.0
    if f["tyre_age_vs_typical"] == "past" and (f["stop_still_required"] or f["laps_remaining"] > 8):
        return 1.0
    return 0.0


def features(f: dict) -> list:
    age = f["tyre_age_laps"] or 0
    typical = f["typical_stint_laps"] or 25
    return [
        age, age / typical, AGE[f["tyre_age_vs_typical"]], f["laps_remaining"],
        float(f["safety_car"]), float(f["virtual_safety_car"]), float(f["rain"]),
        f["gap_behind_s"] if f["gap_behind_s"] is not None else 60.0, f["pit_loss_s"],
        float(f["stop_now_loses_position"]), f["stops_done"], float(f["stop_still_required"]),
        float(f["compound"] == "SOFT"), float(f["compound"] == "MEDIUM"), float(f["compound"] == "HARD"),
    ]


def train_logreg(X, y):
    return LogisticRegression(max_iter=2000, class_weight="balanced").fit(X, y)


def logreg_prob(model, f: dict) -> float:
    return float(model.predict_proba([features(f)])[0][1])
