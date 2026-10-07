import pandas as pd
from f1pit.facts import lap_facts
from f1pit.baselines import rule_prob, features, train_logreg, logreg_prob

TYPICAL = {"MEDIUM": 25, "HARD": 32}

def row(**kw):
    base = dict(lap=20, laps_remaining=30, compound="MEDIUM", tyre_life=10, safety_car=False, vsc=False,
                rain=False, gap_behind_s=5.0, stops_done=0, messages=[])
    base.update(kw)
    return pd.Series(base)

def test_tyre_age_against_typical():
    assert lap_facts(row(tyre_life=10), TYPICAL, 22.0)["tyre_age_vs_typical"] == "well before"
    assert lap_facts(row(tyre_life=23), TYPICAL, 22.0)["tyre_age_vs_typical"] == "near"
    assert lap_facts(row(tyre_life=27), TYPICAL, 22.0)["tyre_age_vs_typical"] == "past"

def test_position_loss_and_last_car():
    assert lap_facts(row(gap_behind_s=5.0), TYPICAL, 22.0)["stop_now_loses_position"] is True
    f = lap_facts(row(gap_behind_s=float("nan")), TYPICAL, 22.0)
    assert f["gap_behind_s"] is None and f["stop_now_loses_position"] is False

def test_facts_encode_as_json_with_numpy_values():
    import json
    import numpy as np
    f = lap_facts(row(gap_behind_s=np.float64(7.0), tyre_life=np.float64(26), stops_done=np.int64(1)), TYPICAL, 20.4)
    json.dumps(f)

def test_wet_tyres_do_not_need_a_stop():
    assert lap_facts(row(compound="INTERMEDIATE"), TYPICAL, 22.0)["stop_still_required"] is False
    assert lap_facts(row(), TYPICAL, 22.0)["stop_still_required"] is True

def test_rule_pits_under_safety_car_with_worn_tyres():
    assert rule_prob(lap_facts(row(tyre_life=24, safety_car=True), TYPICAL, 22.0)) == 1.0
    assert rule_prob(lap_facts(row(tyre_life=5, safety_car=True), TYPICAL, 22.0)) == 0.0
    assert rule_prob(lap_facts(row(tyre_life=40, laps_remaining=2), TYPICAL, 22.0)) == 0.0

def test_logreg_learns_a_simple_pattern():
    rows = [lap_facts(row(tyre_life=a), TYPICAL, 22.0) for a in range(1, 40)]
    y = [1 if a >= 30 else 0 for a in range(1, 40)]
    m = train_logreg([features(f) for f in rows], y)
    assert logreg_prob(m, lap_facts(row(tyre_life=38), TYPICAL, 22.0)) > logreg_prob(m, lap_facts(row(tyre_life=3), TYPICAL, 22.0))
