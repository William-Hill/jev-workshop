# F1 pit decision: System 1 → System 2 design

Date: 2026-10-06. Owner: William MJ Hill (@emjay_hill). Repository: `render-maze-jev`, folder `f1/`. Optional third track, after Plan A (the pivot) and Plan B (the maze backup).

## Goal

Test Jev on a real decision with real labels: **"Should this driver pit at the end of this lap?"** Use historical Formula 1 races from FastF1 (<https://github.com/theOehrly/Fast-F1>).

- **System 1 = Jev:** one Noul for each driver and lap. Code calculates every number first.
- **System 2 = an LLM:** only for uncertain laps or when the race changes (safety car, rain).
- **Baselines:** a hand-written rule, and a logistic regression trained on the same numbers.

This track is the honest other side of the talk. The data has labels, so our research predicts that the trained model wins on the numbers. Jev may add value on text (race-control messages) and on written rules. The test shows which.

## What the data gives (FastF1)

- For each lap: `LapNumber`, `Time`, `LapTime`, `Stint`, `Compound`, `TyreLife`, `FreshTyre`, `PitInTime`, `PitOutTime`, `Position`, `TrackStatus`.
- For each session: `weather_data` (including rainfall), `race_control_messages` (`Category`, `Message` text, `Flag`, `Scope`, `Lap`).
- Track status codes in `TrackStatus`: `2` yellow, `4` safety car, `5` red flag, `6` virtual safety car.

## The label

`pitted = PitInTime is not null` on that lap (the in-lap). This is the team's real decision, not the best decision. Report every metric as agreement with the teams.

## The facts that code calculates (rule 2 of the talk)

For each driver and lap: the lap, laps remaining, compound, tire age, the typical stint length for the compound (from the training season), tire age against typical ("well before", "near", "past"), safety car, virtual safety car, rain, the gap to the car behind, the pit loss for this race, "a stop now loses a position" (gap behind < pit loss), stops done, "a stop is still required" (dry race, no stop yet), and the race-control messages of this lap.

## Splits

- **Train and tune:** 2023 races (the logistic regression, the typical stint lengths, the Jev threshold). The Jev threshold uses 2 races only, to keep the cost low.
- **Held-out test:** 6 races from 2024, chosen to include a safety car and rain: Bahrain, Saudi Arabia, Spain, Great Britain, Hungary, Italy. Task 1 checks that each one loads.
- Exclude lap 1, the last lap, and laps under a red flag.

## Metrics

Pit laps are rare (a few percent of laps), so accuracy alone misleads.

- **Lap level:** precision, recall, and F1 at the chosen threshold; average precision (area under the precision-recall curve); Brier score; calibration error (10 bins).
- **Event level, ±1 lap:** a real stop counts as found if the model says "pit" within 1 lap of it. A "pit" call counts as correct if a real stop is within 1 lap.
- **Under a safety car:** the same metrics on safety-car laps only.
- **Cost and speed:** Jev requests, tokens, dollars; System 2 calls and their latency.

## Global constraints

- Python 3.11 or later, in a virtual environment `f1/.venv`. Dependencies: `fastf1`, `pandas`, `scikit-learn`, `typesafe-sdk`, `pytest`.
- Keep `TYPESAFE_API_KEY` in `.env` only. The FastF1 cache folder `f1/cache/` is not committed.
- Pin `jev-1.13.0`.
- System 2 backend: the Anthropic API (`ANTHROPIC_API_KEY`) or headless Claude Code (`LLM_BACKEND=claude-cli`), as in the amendment to `2026-10-06-system1-system2-design.md`.
- Spend cap: $5 for each run. About 1,100 driver-laps for each race; at about 600 input tokens each, one race costs about $0.03 in Jev tokens.
- Tune on 2023 only. Report on 2024 only, once.
- Write docs and comments in ASD-STE100 Simplified Technical English.

## What needs the user

- `TYPESAFE_API_KEY` (exists). An LLM option for System 2.
- A check of the race list, if a different set of races matters for the talk.
