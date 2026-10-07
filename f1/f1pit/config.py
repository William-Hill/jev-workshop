"""Races, model, and paths for the F1 pit-decision test."""
import os

JEV_MODEL = "jev-1.13.0"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE_DIR = os.path.join(ROOT, "cache")
DATA_DIR = os.path.join(ROOT, "data")
RESULTS_DIR = os.path.join(ROOT, "results")

# Races are (year, round). Two 2026 races are in Spain (round 7 Barcelona, round 14 Madrid), so use round numbers.
# New technical rules started in 2026, so all races come from the 2026 season.

# Train the logistic regression and the typical stint lengths on these races.
TRAIN_RACES = [(2026, r) for r in range(1, 11)]
# Tune the Jev threshold and the escalation band on these races (a subset of TRAIN_RACES).
# Round 7 (Barcelona, VSC) and round 9 (Great Britain, safety car and VSC).
TUNE_RACES = [(2026, 7), (2026, 9)]
# Report on these races only, once: the last 6 completed races on 2026-10-06.
TEST_RACES = [(2026, r) for r in range(11, 17)]
