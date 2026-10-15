# Prompt: add the voiceover explainer workflow to Signal Reel

Paste everything below the line into a new agent session that runs in `~/Development/signal-reel`.

---

You work in the Signal Reel repository (`~/Development/signal-reel`, GitHub `William-Hill/signal-reel`, private). Your job has two parts: create GitHub issues for a new feature, then implement them, one pull request for each issue.

Write all issue text, commit messages, PR bodies, and code comments in ASD-STE100 Simplified Technical English: short sentences, active voice, "must" for requirements.

## The feature: a voiceover explainer video from a screen recording

A creator records a screen (for example, a game or an app) and then records a face-cam voiceover that explains it. Signal Reel must turn the two recordings into finished social videos:

1. The camera on the screen recording follows the script: it zooms into the part of the screen that the speaker talks about, at the moment the speaker says it.
2. The face cam appears as a round bubble with a ring in the brand color.
3. Word-by-word captions are burned in, with misheard terms corrected.
4. One take produces every shape: 16:9, 9:16 (Reel), and 4:5 (feed and carousel).

A working reference implementation exists outside this repository, in `~/Development/render-maze-jev`. Read it before you design anything. Port the ideas into Signal Reel's architecture. Do not copy the scripts as they are.

| Reference file | What it does |
|---|---|
| `docs/presentation/voiceover/own.html` | The recorder: camera and microphone capture (MediaRecorder), a teleprompter under the camera that highlights each word as the speaker reads it (Web Speech API, with a steady-pace fallback), a 3-second countdown, rehearsal takes, a takes list (play back, keep, delete), "stop and keep" and "stop and discard", and a script editor that saves in localStorage |
| `scripts/voiceover-make.py` | The pipeline from one take: remux the browser recording, transcribe with word times, find the anchor phrases, mute fillers, build the base video, render captions, and compose each output shape |
| `scripts/voiceover-base.py` | The voice-timed camera: smoothstep zoom keyframes (zoom level, centre x, centre y) between camera positions, and a final cut to a chosen time in the source (the "win screen") |
| `scripts/voiceover-bubble.sh` | The 16:9 composition: a round, mirrored face cam with a ring, placed in an empty region of the screen recording |
| `scripts/voiceover-vertical.py` | The 9:16 and 4:5 layouts: a title band, the screen strip, a captions band, and a large bubble, all inside the Instagram safe zones |
| `scripts/voiceover-captions.py` | Phrase captions with the spoken word highlighted, for each layout |

## What Signal Reel already has: reuse it, do not rebuild it

- Burned-in captions with a word-highlight karaoke style, ASR corrections, line overrides, and SRT files: `workers/render/captions.py` (ASS with libass).
- Word timestamps from faster-whisper: `workers/analyze/transcribe.py`.
- The output shapes: `libs/core/recipe_aspect.py` (`ASPECT_DIMS`, `ASPECT_CHOICES`). It has only 9:16, 16:9, and 1:1.
- Recipes and rendering: `workers/render/studio/recipe.py`, `workers/render/studio/compositor.py` (`render_short`), and `workers/render/studio/cli.py`.
- Auto-reframe (`workers/render/studio/reframe.py`), filler trimming (`workers/render/fillertrim.py`), the brand kit, and the cockpit UI (`apps/api/templates/`).
- Audio is AAC at 48 kHz stereo in `workers/render/ffmpeg_render.py`.

## Step 1: create the issues

1. Read the five newest open issues (`gh issue list --limit 10`) and copy their style: title, labels, and body sections.
2. Read `.agents/skills/triage-issues/SKILL.md` for the label rules: type (`enhancement`), priority (`P0` to `P2`), and points (`sp:1` to `sp:8`). Use only labels that already exist.
3. Create one epic issue and the child issues below. Each child must have a problem statement, a scope, acceptance criteria as a checklist, and test notes. Link the children from the epic.
4. Print the issue numbers and links before you write code.

Child issues, in this order:

1. **4:5 feed shape (1080x1350).** Add `"4:5"` to `ASPECT_DIMS` and `ASPECT_CHOICES` (label "Portrait feed", note "Instagram feed · carousels"). Make every render path accept it: recipes, the cockpit selector, `output_for` file names, captions, and bookends. The reason goes in the issue: Instagram crops each carousel item to the shape of the first item, and never taller than 4:5, so a 9:16 video loses its top and bottom in a carousel. Suggested `P0`, `sp:2`.
2. **Audio format regression test.** Add a test that renders a short clip and asserts AAC, 48000 Hz, 2 channels. In the reference work, `loudnorm` silently produced 96 kHz mono AAC, which plays as silence on many phones. Any `loudnorm` must be followed by `aresample=48000` and a stereo `aformat`. Suggested `P0`, `sp:1`.
3. **Explainer composition: screen recording plus a face-cam bubble.** A new recipe mode with two sources: a screen recording and a face-cam take. A round mask, a ring in the brand color, a mirrored face cam, and a layout for each shape: 16:9 (the bubble in a free corner region that the recipe sets), and 9:16 and 4:5 (stacked: title band, screen strip, captions band, large bubble, with the safe zones kept clear). Captions use the existing caption module, with one position for each layout. Suggested `P1`, `sp:5`.
4. **Voice-timed camera moves.** In the recipe, the creator defines named screen regions (zoom level and centre) and anchors: phrases with fallback phrases, each tied to a region. The pipeline transcribes the take, finds each anchor (the first match after the previous anchor; accept ad-libbed wording), starts each move about 0.25 s before its phrase with a 0.8 s smoothstep, and ends with a cut to a source time that the recipe sets. If an anchor is not found, it uses a fixed share of the take length and logs it. Suggested `P1`, `sp:5`.
5. **Recorder and teleprompter in the cockpit.** Port `own.html` into the cockpit, with the same controls and keyboard shortcuts (Space, Enter, Esc, P, E). Takes upload to the asset library instead of downloading. Label rehearsal takes. The page must say that Chrome's speech recognition sends audio to Google. Suggested `P2`, `sp:8`.

## Step 2: implement

For each child issue, in the order above:

1. Create a branch from `main`, named like the existing ones (for example, `feat/<issue>-<slug>`).
2. Write the tests first. Watch them fail. Then implement.
3. Run `make test` and `make lint` (pytest, `ruff check`, `ruff format --check`). All of them must pass.
4. Commit in the repository's style: `feat(#<issue>): <summary>`.
5. Push the branch and open a PR with `gh pr create`. The body must contain `Closes #<issue>`, a summary, and a test plan.
6. Do not merge. Do not push to `main`. Start the next issue on its own branch from `main`, unless it depends on an open PR. In that case, stack the branch and say so in the PR.

## Problems the reference work hit: handle them

- **Browser recordings:** WebM files from MediaRecorder carry no duration in the header. Remux them (`ffmpeg -fflags +genpts -i in.webm -c copy out.mkv`) before you probe or trim.
- **Word timestamps:** a transcription prompt (whisper.cpp `--prompt`) collapsed all word times to one value on real takes. If you use `initial_prompt` in faster-whisper, check the word times on a real take, or leave the prompt out.
- **Misheard terms:** product names get misheard ("Jev" heard as "Jail" or "Jeff"; "RenderATL" as "Render ATL"; "pellets" as "pillars"). Feed a recipe-level corrections map into the existing `apply_corrections`.
- **Fillers:** mute fillers in the voiceover and keep the timing. Do not cut them: a cut moves the voice ahead of the screen recording and makes the face cam jump.
- **The face cam:** the browser preview is mirrored, so mirror the face cam in the render too.
- **Safe zones in 9:16:** keep the top 200 px, the bottom 340 px, and the right 140 px below the middle free of content.

## Definition of done

- The epic and five child issues exist, with labels and acceptance criteria.
- One PR exists for each child issue, with passing tests and lint, and each PR is linked to its issue.
- A short handoff in `docs/handoffs/` lists the issues, the PRs, what you verified, and what you did not verify.
