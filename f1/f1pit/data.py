"""Turn one FastF1 race into one row for each driver and lap.

The label is the team's real decision: pitted = the car entered the pit lane on this lap.
"""
import os
import pandas as pd
from .config import CACHE_DIR, DATA_DIR

DEFAULT_PIT_LOSS_S = 22.0  # Used only when a race has no clean stop to measure.


def build_lap_table(session) -> pd.DataFrame:
    laps = session.laps
    compound = laps["Compound"].fillna("UNKNOWN").astype(str)
    df = pd.DataFrame({
        "driver": laps["Driver"].astype(str),
        "lap": laps["LapNumber"].astype(int),
        "end_s": laps["Time"].dt.total_seconds(),
        "lap_time_s": laps["LapTime"].dt.total_seconds(),
        "stint": laps["Stint"],
        "compound": compound.where(compound != "None", "UNKNOWN"),
        "tyre_life": laps["TyreLife"],
        "position": laps["Position"],
        "track_status": laps["TrackStatus"].fillna("").astype(str),
        "pitted": laps["PitInTime"].notna(),
        "pit_out": laps["PitOutTime"].notna(),
    })
    total = int(df["lap"].max())
    df["laps_remaining"] = total - df["lap"]
    df["safety_car"] = df["track_status"].str.contains("4")
    df["vsc"] = df["track_status"].str.contains("6")
    df["red"] = df["track_status"].str.contains("5")

    # The gap to the car behind at the end of the lap.
    df = df.sort_values(["lap", "end_s"])
    df["gap_behind_s"] = df.groupby("lap")["end_s"].shift(-1) - df["end_s"]

    # Stops done before this lap.
    df = df.sort_values(["driver", "lap"])
    df["stops_done"] = df.groupby("driver")["pitted"].cumsum() - df["pitted"].astype(int)

    # Rain in the 2 minutes before the end of the lap.
    w = session.weather_data
    rain_s = w.loc[w["Rainfall"].astype(bool), "Time"].dt.total_seconds() if len(w) else pd.Series(dtype=float)
    df["rain"] = df["end_s"].apply(lambda t: bool(((rain_s > t - 120) & (rain_s <= t)).any()))

    # Race-control messages of this lap (text).
    m = session.race_control_messages
    msgs = {}
    if len(m) and "Lap" in m:
        m = m.dropna(subset=["Lap"])
        msgs = m.groupby(m["Lap"].astype(int))["Message"].apply(list).to_dict()
    df["messages"] = df["lap"].map(lambda lap: msgs.get(lap, []))

    df = df[(df["lap"] > 1) & (df["laps_remaining"] > 0) & (~df["red"])]
    return df.reset_index(drop=True)


def pit_loss_s(table: pd.DataFrame) -> float:
    """Median time lost by a stop: in-lap + out-lap minus two typical green laps of that driver."""
    neutral = table["safety_car"] | table["vsc"]
    green = table[~neutral & ~table["pitted"] & ~table["pit_out"]].groupby("driver")["lap_time_s"].median()
    losses = []
    for drv, g in table.assign(neutral=neutral).groupby("driver"):
        g = g.set_index("lap")
        for lap in g.index[g["pitted"]]:
            if lap + 1 in g.index and bool(g.loc[lap + 1, "pit_out"]) and drv in green \
                    and not bool(g.loc[lap, "neutral"]) and not bool(g.loc[lap + 1, "neutral"]):
                losses.append(g.loc[lap, "lap_time_s"] + g.loc[lap + 1, "lap_time_s"] - 2 * green[drv])
    s = pd.Series(losses, dtype=float).dropna()
    return float(s.median()) if len(s) else DEFAULT_PIT_LOSS_S


def typical_stints(tables) -> dict:
    """Median length of completed stints (stints that end with a stop), for each compound."""
    lengths = []
    for t in tables:
        for _, r in t[t["pitted"]].iterrows():
            if pd.notna(r["tyre_life"]):
                lengths.append({"compound": r["compound"], "length": int(r["tyre_life"])})
    df = pd.DataFrame(lengths)
    return {} if df.empty else {k: int(v) for k, v in df.groupby("compound")["length"].median().items()}


def load_race(year: int, rnd: int) -> pd.DataFrame:
    """Load a race from FastF1 (cached), build the table, and keep a copy in f1/data/."""
    import fastf1
    os.makedirs(CACHE_DIR, exist_ok=True)
    os.makedirs(DATA_DIR, exist_ok=True)
    # Pickle is safe here: this code writes these files itself in f1/data/ (not committed). Never load a pickle from elsewhere.
    path = os.path.join(DATA_DIR, f"{year}-R{rnd:02d}.pkl")
    if os.path.exists(path):
        return pd.read_pickle(path)
    fastf1.Cache.enable_cache(CACHE_DIR)
    s = fastf1.get_session(year, rnd, "R")
    s.load(laps=True, weather=True, messages=True, telemetry=False)
    t = build_lap_table(s)
    t["race"] = f"{year} R{rnd:02d} {s.event['EventName']}"
    t.to_pickle(path)
    return t
