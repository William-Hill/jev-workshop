"""Turn one voiceover take into the finished maze video, timed to the voice.

    python3 scripts/voiceover-make.py <take.webm> [output.mp4]

Steps, all on this Mac:
1. whisper.cpp transcribes the take with a time for each word.
2. Code finds three moments in the script: "Here you can see" (zoom to the decision bars),
   "It gets the state" (zoom to the board state), and "Then it makes a decision" (cut to the win).
   If a phrase is not found, code uses a fixed share of the take length.
3. Code mutes "um", "uh", "er", and "hmm", and keeps the timing.
4. scripts/voiceover-base.py builds the video with the zooms at those moments.
5. scripts/voiceover-bubble.sh adds the round webcam bubble and the voice.
"""

import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

MODEL = Path.home() / ".whisper-models" / "ggml-small.en.bin"
OUT = Path("docs/presentation/media/maze-voiceover-final.mp4")
FILLERS = re.compile(r"^(u+m+|u+h+|e+r+m*|a+h+|h+m+|m+m+)$")
FILLER_PAD = 0.06
TAIL = 1.2  # Seconds kept after the last word.
LEAD = 0.25  # Each zoom starts this many seconds before its phrase.
# (key, words in order, the share of the take to use when the phrase is not found)
ANCHORS = [("decision", ["here", "see"], 0.30), ("state", ["gets", "state"], 0.55), ("finale", ["then", "decision"], 0.82)]


def sh(args: list[str], **kw) -> subprocess.CompletedProcess:
    """Run a command and fail loudly."""
    return subprocess.run(args, check=True, **kw)


def words_of(take: Path, work: Path) -> list[dict]:
    """Transcribe the take; return words with start and end times in seconds."""
    wav = work / "voice.wav"
    sh(["ffmpeg", "-y", "-loglevel", "error", "-i", str(take), "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(wav)])
    sh(["whisper-cli", "-m", str(MODEL), "-f", str(wav), "-ml", "1", "-sow", "-ojf", "-of", str(work / "words"), "-np",
        "--prompt", "Umm, uh, so, hmm. Okay, um, here is what I, uh, mean."],
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
    take = Path(sys.argv[1]).expanduser()
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else OUT
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        words = words_of(take, work)
        speech = [w for w in words if not FILLERS.match(w["norm"])]
        length = min(duration(take), (speech[-1]["end"] if speech else duration(take)) + TAIL)
        times, after = {}, 0.0
        for key, phrase, share in ANCHORS:
            found = find_phrase(words, phrase, after)
            times[key] = max(after + 0.5, (found - LEAD) if found is not None else share * length)
            after = times[key]
            print(f"{key}: {times[key]:.2f} s ({'found' if found is not None else 'not found, used a share of the take'})")
        print("TRANSCRIPT: " + " ".join(f"[{w['text']}]" if FILLERS.match(w["norm"]) else w["text"] for w in words))
        print(f"Length: {length:.2f} s")

        spans = [(max(0.0, w["start"] - FILLER_PAD), w["end"] + FILLER_PAD) for w in words if FILLERS.match(w["norm"])]
        mute = ",".join(f"volume=enable='between(t,{a:.3f},{b:.3f})':volume=0" for a, b in spans) or "anull"
        clean = work / "clean.webm"
        sh(["ffmpeg", "-y", "-loglevel", "error", "-i", str(take), "-t", f"{length:.3f}", "-c:v", "copy", "-af", mute,
            "-c:a", "libopus", "-b:a", "128k", str(clean)])
        print(f"Muted {len(spans)} filler(s).")

        base = work / "base.mp4"
        sh(["python3", "scripts/voiceover-base.py", "--decision", f"{times['decision']:.2f}", "--state", f"{times['state']:.2f}",
            "--finale", f"{times['finale']:.2f}", "--length", f"{length:.2f}", "--out", str(base)], stdout=subprocess.DEVNULL)
        sh(["scripts/voiceover-bubble.sh", str(clean), str(out)], env={**__import__("os").environ, "BASE": str(base)})


if __name__ == "__main__":
    main()
