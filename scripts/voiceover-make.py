"""Turn one voiceover take into the finished maze video, timed to the voice.

    python3 scripts/voiceover-make.py <take.webm> [output.mp4]
    python3 scripts/voiceover-make.py --captions-only     # after you edit recordings/voiceover-work/captions.json

Steps, all on this Mac:
1. whisper.cpp transcribes the take with a time for each word.
2. Code finds three moments in the script: "Here you can see" (zoom to the decision bars),
   "It gets the state" (zoom to the board state), and "Then it makes a decision" (cut to the win).
   If a phrase is not found, code uses a fixed share of the take length.
3. Code mutes "um", "uh", "er", and "hmm", and keeps the timing.
4. scripts/voiceover-base.py builds the video with the zooms at those moments.
5. scripts/voiceover-bubble.sh adds the round webcam bubble and the voice (16:9).
6. scripts/voiceover-vertical.py makes the 9:16 Instagram Reel from the same parts.
7. Both videos get burned-in captions from the word times (scripts/voiceover-captions.py).
   The captions are saved in recordings/voiceover-work/captions.json. Fix a word there, then
   run --captions-only to render both videos again without a new transcription.
"""

import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

MODEL = Path.home() / ".whisper-models" / "ggml-small.en.bin"
OUT = Path("docs/presentation/media/maze-voiceover-final.mp4")
VERTICAL = Path("docs/presentation/media/maze-voiceover-instagram.mp4")
WORK = Path("recordings/voiceover-work")  # Keeps the base video and the clean take (not in git).
FILLERS = re.compile(r"^(u+m+|u+h+|e+r+m*|a+h+|h+m+|m+m+)$")
FILLER_PAD = 0.06
TAIL = 1.2  # Seconds kept after the last word.
LEAD = 0.25  # Each zoom starts this many seconds before its phrase.
CAPTION_WORDS = 4  # Words in one caption phrase, at most.
CAPTION_CHARS = 24  # Characters in one caption phrase, at most.
CAPTION_HOLD = 0.2  # Seconds a phrase stays after its last word.
# Words that whisper often mishears in this script. Keys are lower case, without punctuation.
CORRECTIONS = {"jail": "Jev", "jealous": "Jev", "jeff": "Jev", "jeb": "Jev", "jev": "Jev", "chef": "Jev",
               "pillars": "pellets", "pillar": "pellet", "pallets": "pellets"}
# (key, phrases to try in order, the share of the take to use when no phrase is found).
# Each phrase is a first word and words that must follow it closely. Ad-libbed wording is common.
ANCHORS = [
    ("decision", [["here", "see"], ["see", "decision"], ["each", "decision"], ["one", "four"]], 0.30),
    ("state", [["gets", "state"], ["pass", "state"], ["state", "board"], ["adversaries"]], 0.55),
    ("finale", [["then", "decision"], ["make", "decision"], ["accordingly"]], 0.82),
]


def sh(args: list[str], **kw) -> subprocess.CompletedProcess:
    """Run a command and fail loudly."""
    return subprocess.run(args, check=True, **kw)


def words_of(take: Path, work: Path) -> list[dict]:
    """Transcribe the take; return words with start and end times in seconds."""
    wav = work / "voice.wav"
    sh(["ffmpeg", "-y", "-loglevel", "error", "-i", str(take), "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(wav)])
    # No --prompt: a prompt makes whisper.cpp collapse the word times on these takes.
    sh(["whisper-cli", "-m", str(MODEL), "-f", str(wav), "-ml", "1", "-sow", "-ojf", "-of", str(work / "words"), "-np"],
       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    data = json.loads((work / "words.json").read_text())
    out = []
    for seg in data.get("transcription", []):
        text = seg["text"].strip()
        norm = re.sub(r"[^a-z0-9]", "", text.lower())
        if norm:
            out.append({"text": text, "norm": norm, "start": seg["offsets"]["from"] / 1000, "end": seg["offsets"]["to"] / 1000})
    return out


def find_phrase(words: list[dict], phrase: list[str], after: float) -> float | None:
    """Return the start time of the first word of the phrase, found after a time; the words must be close."""
    for i, w in enumerate(words):
        if w["start"] < after or w["norm"] != phrase[0]:
            continue
        window = [x["norm"] for x in words[i + 1:i + 6]]
        if all(p in window for p in phrase[1:]):
            return w["start"]
    return None


def duration(path: Path) -> float:
    """Return the length of a media file in seconds."""
    out = sh(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)], capture_output=True, text=True)
    return float(out.stdout.strip())


def main() -> None:
    """Make the finished video from one take."""
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    if sys.argv[1] == "--captions-only":
        render_outputs(OUT)
        return
    take = Path(sys.argv[1]).expanduser()
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else OUT
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        # Browser recordings have no duration in the header. A copy into a new file writes one.
        fixed = work / "take.mkv"
        sh(["ffmpeg", "-y", "-loglevel", "error", "-fflags", "+genpts", "-i", str(take), "-c", "copy", str(fixed)])
        take = fixed
        words = words_of(take, work)
        speech = [w for w in words if not FILLERS.match(w["norm"])]
        length = min(duration(take), (speech[-1]["end"] if speech else duration(take)) + TAIL)
        times, after = {}, 0.0
        for key, phrases, share in ANCHORS:
            found = next((t for t in (find_phrase(words, ph, after + 0.5) for ph in phrases) if t is not None), None)
            times[key] = max(after + 0.5, (found - LEAD) if found is not None else share * length)
            after = times[key]
            print(f"{key}: {times[key]:.2f} s ({'found' if found is not None else 'not found, used a share of the take'})")
        print("TRANSCRIPT: " + " ".join(f"[{w['text']}]" if FILLERS.match(w["norm"]) else w["text"] for w in words))
        print(f"Length: {length:.2f} s")

        spans = [(max(0.0, w["start"] - FILLER_PAD), w["end"] + FILLER_PAD) for w in words if FILLERS.match(w["norm"])]
        mute = ",".join(f"volume=enable='between(t,{a:.3f},{b:.3f})':volume=0" for a, b in spans) or "anull"
        WORK.mkdir(parents=True, exist_ok=True)
        sh(["ffmpeg", "-y", "-loglevel", "error", "-i", str(take), "-t", f"{length:.3f}", "-c:v", "copy", "-af", mute,
            "-c:a", "libopus", "-b:a", "128k", str(WORK / "clean.mkv")])
        print(f"Muted {len(spans)} filler(s).")
        sh(["python3", "scripts/voiceover-base.py", "--decision", f"{times['decision']:.2f}", "--state", f"{times['state']:.2f}",
            "--finale", f"{times['finale']:.2f}", "--length", f"{length:.2f}", "--out", str(WORK / "base.mp4")],
           stdout=subprocess.DEVNULL)
        (WORK / "captions.json").write_text(json.dumps(caption_phrases(speech), indent=1))
    render_outputs(out)


def caption_phrases(words: list[dict]) -> list[dict]:
    """Group the spoken words (no fillers) into short phrases, and fix the words whisper mishears."""
    fixed: list[dict] = []
    for w in words:
        text = w["text"]
        if fixed and fixed[-1]["text"] == "Render" and w["norm"] == "atl":  # "Render ATL" -> "RenderATL"
            fixed[-1] = {**fixed[-1], "text": "RenderATL" + text[3:], "end": w["end"]}
            continue
        core = re.sub(r"[^A-Za-z0-9]", "", text).lower()
        if core in CORRECTIONS:
            text = re.sub(r"[A-Za-z0-9]+", CORRECTIONS[core], text, count=1)
        fixed.append({"text": text, "start": w["start"], "end": w["end"]})
    phrases, current = [], []
    for w in fixed:
        current.append(w)
        chars = sum(len(x["text"]) + 1 for x in current)
        if len(current) >= CAPTION_WORDS or chars >= CAPTION_CHARS or w["text"][-1:] in ".,?!:;":
            phrases.append(current); current = []
    if current:
        phrases.append(current)
    out = []
    for i, ph in enumerate(phrases):
        nxt = phrases[i + 1][0]["start"] if i + 1 < len(phrases) else ph[-1]["end"] + 1.0
        clean = [{"text": x["text"].rstrip(".,;:"), "start": round(x["start"], 3), "end": round(x["end"], 3)} for x in ph]
        out.append({"start": clean[0]["start"], "end": round(min(ph[-1]["end"] + CAPTION_HOLD, nxt), 3), "words": clean})
    return out


def render_outputs(out: Path) -> None:
    """Render the caption tracks, then the 16:9 video and the 9:16 Reel, from recordings/voiceover-work/."""
    base, clean, captions = WORK / "base.mp4", WORK / "clean.mkv", WORK / "captions.json"
    length = f"{duration(base):.3f}"
    wide, tall = WORK / "captions-wide.mov", WORK / "captions-tall.mov"
    sh(["python3", "scripts/voiceover-captions.py", str(captions), "wide", length, str(wide)], stdout=subprocess.DEVNULL)
    sh(["python3", "scripts/voiceover-captions.py", str(captions), "tall", length, str(tall)], stdout=subprocess.DEVNULL)
    sh(["scripts/voiceover-bubble.sh", str(clean), str(out)], env={**os.environ, "BASE": str(base), "CAPTIONS": str(wide)})
    sh(["python3", "scripts/voiceover-vertical.py", str(base), str(clean), str(VERTICAL), str(tall)])

if __name__ == "__main__":
    main()
