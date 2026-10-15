# Deck review (2026-10-07)

Six read-only reviewers read `deck-text.md` (the 38-slide full deck) and the research files. Each took one stakeholder view:

1. A first-time attendee (a developer who knows LLM APIs, not Jev).
2. A TypeSafe engineer (accuracy about Jev).
3. A skeptical statistician (evidence and numbers).
4. RenderATL leadership (confidentiality, the business story).
5. Obvious, the sponsor (correct mention, no implied partnership).
6. A talk coach (25 minutes, narrative, delivery).

## The three decks

| File | Slides | Use |
|---|---|---|
| `../jev-workshop-original-33.html` | 33 | The version before the new results. Unchanged. |
| `../jev-workshop.html` | 38 | The full deck: the source for all edits. |
| `../jev-workshop-25min.html` | 22 | The talk. Generated: `python3 scripts/build-short-deck.py`. |

Edit the full deck, then run the script again. The script keeps the cut slides' speaker notes under the slide that absorbed them, marked "From full-deck slide N".

## Fixes applied to the full deck (and so to the short deck)

| Slide | Finding | Fix |
|---|---|---|
| 1 notes | "AI agent company"; a partnership could be implied | "AI workspace company"; "a sponsor, not a TypeSafe partner, no public integration; our own key" |
| 6 | "About 170 ms" is the low end | "About 170 to 250 ms in our tests" |
| 12 | The confidence formula is the docs' approximation | "≈ (n × top − 1) / (n − 1)" |
| 15 | Preprint numbers not marked as unreplicated | "Rafe and Das preprint, not rerun by us" (the research file confirms the numbers are for Jev) |
| 26 notes | Named an internal person; implied an Obvious integration | "a senior person"; "a fit, not a product, no public integration" |
| 27 | "One Jev call for each email" | "for each email that code does not stop first" (34 calls for 36 emails) |
| 29 | The constant baseline was only in the notes | Rows for "Always send contract" (28, recall 0.25) and recall for every method; "One RenderATL sales mailbox, redacted locally; counts only" |
| 30 | The judge is Claude; one run | "The judge is Claude, not a person (35 judged pairs). A human check is pending." |
| 32 | The safety-car lead is untested | "The safety-car difference was not tested for significance." |
| 34 | "The same accuracy" covers 19 of 30 | "The same checked accuracy"; "19 of 30 had a fact check; the high LLM cost includes 3 cache-write outliers" |
| 37 | No setup on the slide | Setup line: npm install, the key in `.env`, npm run dev, `/?jev=1`, bench cost under $0.15 |

## Consensus per slide (6 reviewers) and the short-deck decision

K = keep, C = cut, M = merge. The short deck keeps 22 slides. "Merged" means a cut slide's key line or notes moved into the kept slide.

| Full | Slide | K / M / C | Short deck |
|---|---|---|---|
| 1 | Title | 6 / 0 / 0 | 1 |
| 2 | Promise | 4 / 2 / 0 | 2 |
| 3 | The problem | 6 / 0 / 0 | 3 |
| 4 | Four tools | 3 / 2 / 1 | 4 |
| 5 | Assistance against automation | 3 / 2 / 1 | 5 (absorbs 13 in notes) |
| 6 | What Jev is | 6 / 0 / 0 | 6 (absorbs 7, 8, 9) |
| 7 | Jevons | 0 / 1 / 5 | cut; one line in the notes of short 16 |
| 8 | System 1 and 2 origin | 1 / 2 / 3 | cut; notes in 6 |
| 9 | A classifier you write | 2 / 2 / 2 | cut; one line on 6 |
| 10 | One request | 5 / 1 / 0 | 7 (absorbs 11) |
| 11 | Question types | 3 / 2 / 0 | cut; one line on 7 |
| 12 | Probability and confidence | 4 / 1 / 1 | 8 |
| 13 | RLHF, RLVR, RLCD | 0 / 0 / 6 | cut; notes in 8 |
| 14 | Nine failure modes | 3 / 3 / 0 | cut; one line on 9 |
| 15 | Confidence cannot see a bad question | 4 / 2 / 0 | 9 |
| 16 | Production facts | 3 / 1 / 2 | cut; notes in 10 (hand out as a cheat sheet) |
| 17 | Data and security | 3 / 1 / 2 | cut; notes in 10 |
| 18 | Code owns the workflow | 4 / 1 / 1 | 10 |
| 19 | Rule: exact words | 6 / 0 / 0 | 11 |
| 20 | Rule: numbers in code | 5 / 0 / 1 | 12 |
| 21 | Rule: split (weak evidence) | 0 / 2 / 4 | cut; notes in 13 |
| 22 | Rule: thresholds | 4 / 1 / 1 | 13 (now "rule 3"; absorbs 23) |
| 23 | Rule: test and pin | 2 / 3 / 1 | cut; one line on 13 |
| 24 | Where Jev fits | 1 / 2 / 3 | cut; notes in 14 |
| 25 | System 1 and System 2 together | 3 / 0 / 3 | cut; notes in 14 |
| 26 | The sponsor pipeline | 4 / 1 / 1 | 14 |
| 27 | Decision Desk video | 6 / 0 / 0 | 15 |
| 28 | Cost | 6 / 0 / 0 | 16 |
| 29 | Real sales email | 5 / 1 / 0 | 17 |
| 30 | PTSO | 1 / 0 / 5 | cut (kept in the full deck) |
| 31 | When to use something else | 3 / 3 / 0 | 18 (absorbs 32) |
| 32 | F1 | 2 / 1 / 3 | cut; one line on 18 |
| 33 | Ask Your Agent, two paths | 1 / 4 / 1 | cut; notes in 19 |
| 34 | Ask Your Agent, measured | 4 / 2 / 0 | 19 |
| 35 | Maze video | 3 / 2 / 1 | 20 (absorbs 36) |
| 36 | Build time, the maze | 3 / 3 / 0 | cut; bullets on 20 |
| 37 | Tracks and commands | 6 / 0 / 0 | 21 |
| 38 | Now change the question | 6 / 0 / 0 | 22 |

## Target timing (25:00)

| Short | Slide | Seconds |
|---|---|---|
| 1–2 | Title, promise | 50 |
| 3–5 | Problem, four tools, assistance against automation | 270 |
| 6–9 | What Jev is, one request, confidence, the blind spot | 300 |
| 10–13 | Code owns the workflow, three rules | 300 |
| 14–15 | Pipeline, Decision Desk (play about 50 s of video) | 150 |
| 16–17 | Cost, real email | 150 |
| 18–19 | When not to use Jev, Ask Your Agent | 150 |
| 20 | Maze video (49 s) | 80 |
| 21–22 | Tracks, close | 60 |
| | Total | 1,510 s (25:10) |

If the rehearsal runs long, the next cuts are short 2, 4, and 12 (the coach's list).

## Open items for William

1. **Approval for the real-mailbox slide (short 17).** RenderATL leadership asked for written approval from Justin before the talk, because redacted prospect text went to TypeSafe and Anthropic. Names inside free text can remain after redaction. Do not claim the redaction was perfect.
2. **Attendee access.** `William-Hill/render-maze-jev` is private. Attendees need a public copy or an invite before build time. The slide gives no repo URL yet.
3. **The Jev key for attendees.** The deck says the key comes from Obvious. Confirm how attendees get it.
4. **Video cue points.** Mark the timestamps in `decision-desk-demo.mp4` for the pricing request, the repeat deck request, and the injection email. Play only those.
5. **PTSO human check.** The 23-pair blind review is open. The PTSO slide is in the full deck only.
6. **The term for the maze fallback.** The maze uses "confidence below 0.2" for the fallback, while slide 22 advises a threshold on the chosen option's probability. The TypeSafe reviewer asked for one rule or a short explanation.

## Update for Jev 1.14 and images (2026-10-15)

TypeSafe released `jev-1.14.0` and experimental images on 14 October 2026. The full deck now has 39 slides, and the short deck has 23.

- New full-deck slide 12 (short-deck slide 8): images, the Box question type, the header, and our maze test. The image is `media/jev-box-maze.jpg`.
- Full-deck slides 12 to 38 are now 13 to 39. The tables above use the old numbers. `scripts/build-short-deck.py` uses the new numbers.
- Changed facts: rate limits (now "set for each organization", see the console), versions (`jev-latest` moves to `jev-1.14.0` about 21 October; 60 and 30 days of notice), a DPA is now listed, long context to 262,000 tokens with a header, the opt-in for data use.
- Our test (one maze frame, `jev-preview` = `jev-1.14.0`): Box found the runner in 4 of 4 runs, confidence 0.55 to 0.67, about 1,411 input tokens, 192 to 332 ms. Without the header, the API returned 400.
- The short deck is now about 75 seconds longer. The next cuts stay the same: short slides 2, 4, and 13.
