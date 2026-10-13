#!/usr/bin/env bash
# Silence filler words ("um", "uh", "er", "hmm") in a voiceover take, and keep the timing.
#   scripts/voiceover-clean.sh <take.webm> [cleaned.webm]
# The voice must stay in sync with the gameplay, so the script mutes each filler and does not cut it.
# It uses whisper.cpp (whisper-cli) and the local model ~/.whisper-models/ggml-small.en.bin.
# Everything runs on this Mac.
set -euo pipefail

TAKE="${1:?usage: scripts/voiceover-clean.sh <take.webm> [cleaned.webm]}"
OUT="${2:-${TAKE%.*}-clean.webm}"
MODEL="${WHISPER_MODEL:-$HOME/.whisper-models/ggml-small.en.bin}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

ffmpeg -y -loglevel error -i "$TAKE" -vn -ac 1 -ar 16000 -c:a pcm_s16le "$WORK/voice.wav"

# A prompt with fillers makes Whisper write them out; by default it leaves them out.
whisper-cli -m "$MODEL" -f "$WORK/voice.wav" -ml 1 -sow -ojf -of "$WORK/words" -np \
  --prompt "Umm, uh, so, hmm. Okay, um, here is what I, uh, mean." >/dev/null 2>&1

FILTER=$(python3 - "$WORK/words.json" <<'PY'
import json, re, sys
FILLERS = re.compile(r"^(u+m+|u+h+|e+r+m*|a+h+|h+m+|m+m+)$")
PAD = 0.06  # Seconds of extra silence on each side of a filler.
data = json.load(open(sys.argv[1]))
spans, words = [], []
for seg in data.get("transcription", []):
    text = seg["text"].strip()
    word = re.sub(r"[^a-z]", "", text.lower())
    start, end = seg["offsets"]["from"] / 1000, seg["offsets"]["to"] / 1000
    if not word:
        continue
    if FILLERS.match(word):
        spans.append((max(0.0, start - PAD), end + PAD))
        words.append(f"[{text}]")
    else:
        words.append(text)
print("TRANSCRIPT: " + " ".join(words), file=sys.stderr)
print(f"FILLERS: {len(spans)} " + ", ".join(f"{a:.2f}-{b:.2f}s" for a, b in spans), file=sys.stderr)
print(",".join(f"volume=enable='between(t,{a:.3f},{b:.3f})':volume=0" for a, b in spans) or "anull")
PY
)

ffmpeg -y -loglevel error -i "$TAKE" -c:v copy -af "$FILTER" -c:a libopus -b:a 128k "$OUT"
echo "Wrote $OUT"
