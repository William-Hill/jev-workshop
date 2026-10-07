"""The facts that code calculates for one driver and lap. Jev gets these, never raw timing."""
import math

WET = ("INTERMEDIATE", "WET")


def _num(x):
    return None if x is None or (isinstance(x, float) and math.isnan(x)) else x


def lap_facts(r, typical: dict, pit_loss: float) -> dict:
    t = typical.get(r["compound"])
    age = _num(r["tyre_life"])
    if t is None or age is None:
        age_vs = "unknown"
    elif age > t:
        age_vs = "past"
    elif age >= t - 3:
        age_vs = "near"
    else:
        age_vs = "well before"
    gap = _num(r["gap_behind_s"])
    wet = r["compound"] in WET or bool(r["rain"])
    return {
        "lap": int(r["lap"]),
        "laps_remaining": int(r["laps_remaining"]),
        "compound": r["compound"],
        "tyre_age_laps": None if age is None else int(age),
        "typical_stint_laps": t,
        "tyre_age_vs_typical": age_vs,
        "safety_car": bool(r["safety_car"]),
        "virtual_safety_car": bool(r["vsc"]),
        "rain": bool(r["rain"]),
        "gap_behind_s": None if gap is None else round(float(gap), 1),
        "pit_loss_s": round(float(pit_loss), 1),
        "stop_now_loses_position": gap is not None and bool(gap < pit_loss),
        "stops_done": int(r["stops_done"]),
        "stop_still_required": int(r["stops_done"]) == 0 and not wet,
        "race_control_messages": list(r["messages"])[-5:],
    }
