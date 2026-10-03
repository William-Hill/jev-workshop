# Maze benchmark summaries

The `.json` summary files from `npm run bench`, copied from `bench-results/` (which git ignores). Each file has a `summary` block and one entry for each game. The full decision logs (`.jsonl`, about 1.5 MB each) are not committed.

File names: `<variant>-<difficulty>-<UTC time>.json`. Two runs have no file:

- The first Normal run of `level1` (3 games, all won) crashed on game 4 before it wrote its summary.
- The first 13 games of `level1b` on Normal (6 won, 7 lost) ran in a run that hung on game 14. The 7 games that complete the 20-game test are in `level1b-normal-2026-10-03T14-07-13-561Z.json`.

See `docs/HANDOFF.md` and `docs/research/question-design-finding.md` for the tables.
