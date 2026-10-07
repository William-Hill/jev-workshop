import pandas as pd
from types import SimpleNamespace
from f1pit.data import build_lap_table, pit_loss_s, typical_stints

def td(s):
    return pd.to_timedelta(s, unit="s")

def fake_session():
    # Two drivers, 5 laps. Driver A pits at the end of lap 3. Lap 4 has a red flag.
    rows = []
    for drv, base in (("AAA", 0.0), ("BBB", 2.0)):
        for lap in range(1, 6):
            rows.append({
                "Driver": drv, "LapNumber": lap, "Time": td(lap * 90 + base), "LapTime": td(90),
                "Stint": 1 if (drv == "BBB" or lap <= 3) else 2,
                "Compound": "MEDIUM" if (drv == "BBB" or lap <= 3) else "HARD",
                "TyreLife": lap if (drv == "BBB" or lap <= 3) else lap - 3,
                "Position": 1 if drv == "AAA" else 2,
                "TrackStatus": "5" if lap == 4 else "1",
                "PitInTime": td(lap * 90) if (drv == "AAA" and lap == 3) else pd.NaT,
                "PitOutTime": td(lap * 90) if (drv == "AAA" and lap == 4) else pd.NaT,
            })
    laps = pd.DataFrame(rows)
    weather = pd.DataFrame({"Time": td([0, 200]), "Rainfall": [False, True]})
    rcm = pd.DataFrame({"Lap": [2, 3], "Category": ["Flag", "Other"], "Message": ["YELLOW IN TRACK SECTOR 4", "SAFETY CAR DEPLOYED"]})
    return SimpleNamespace(laps=laps, weather_data=weather, race_control_messages=rcm)

def test_table_removes_lap_1_the_last_lap_and_red_flag_laps():
    t = build_lap_table(fake_session())
    assert sorted(t["lap"].unique()) == [2, 3]

def test_label_gap_and_messages():
    t = build_lap_table(fake_session()).set_index(["driver", "lap"])
    assert bool(t.loc[("AAA", 3), "pitted"]) is True
    assert bool(t.loc[("BBB", 3), "pitted"]) is False
    assert t.loc[("AAA", 2), "gap_behind_s"] == 2.0
    assert pd.isna(t.loc[("BBB", 2), "gap_behind_s"])  # the last car has no car behind
    assert t.loc[("AAA", 3), "messages"] == ["SAFETY CAR DEPLOYED"]
    assert bool(t.loc[("AAA", 3), "rain"]) is True

def test_a_missing_compound_becomes_unknown():
    s = fake_session()
    s.laps.loc[s.laps["LapNumber"] == 2, "Compound"] = "None"
    t = build_lap_table(s)
    assert set(t.loc[t["lap"] == 2, "compound"]) == {"UNKNOWN"}

def test_pit_loss_has_a_default_when_no_clean_stop_exists():
    assert pit_loss_s(build_lap_table(fake_session())) == 22.0

def test_typical_stints_use_completed_stints_only():
    t = pd.DataFrame({"driver": ["A", "A", "B"], "stint": [1, 1, 1], "compound": ["SOFT", "SOFT", "SOFT"],
                      "tyre_life": [10, 15, 30], "pitted": [False, True, False]})
    assert typical_stints([t]) == {"SOFT": 15}
