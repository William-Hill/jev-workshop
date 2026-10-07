import pandas as pd
from f1pit.metrics import lap_metrics, event_metrics

def test_lap_metrics_perfect_and_calibration():
    m = lap_metrics([0, 0, 1, 1], [0.0, 0.1, 0.9, 1.0], 0.5)
    assert m["precision"] == 1.0 and m["recall"] == 1.0
    assert m["brier"] < 0.01

def test_lap_metrics_skip_missing_probabilities():
    m = lap_metrics([0, 1, 1], [0.0, None, 1.0], 0.5)
    assert m["n"] == 2 and m["missing"] == 1

def test_event_metrics_accept_one_lap_early():
    df = pd.DataFrame({"race": ["r"] * 6, "driver": ["A"] * 6, "lap": [10, 11, 12, 13, 14, 15],
                       "pitted": [False, False, True, False, False, False], "p": [0, 0.9, 0, 0, 0, 0.9]})
    e = event_metrics(df, "p", 0.5, tolerance=1)
    assert e["found_share"] == 1.0           # the real stop on lap 12 has a call on lap 11
    assert e["correct_call_share"] == 0.5    # the call on lap 15 has no stop within 1 lap
