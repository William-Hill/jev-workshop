#!/usr/bin/env bash
# Put a round webcam bubble with a voiceover on the RenderMaze teaser.
#   scripts/voiceover-bubble.sh <webcam recording> [output.mp4]
# The recording comes from docs/presentation/voiceover/record.html (served next to the decks).
# The bubble sits in the empty strip at the right edge of the video, bottom corner.
set -euo pipefail

CAM="${1:?usage: scripts/voiceover-bubble.sh <webcam recording> [output.mp4]}"
OUT="${2:-docs/presentation/media/maze-teaser-voiceover.mp4}"
BASE="docs/presentation/media/maze-teaser.mp4"
SIZE=230          # Bubble diameter in pixels; fits the empty strip right of the Jev panel.
RING=8            # Pink ring width.
X=$((1920 - SIZE - 2 * RING - 12))
Y=$((1080 - SIZE - 2 * RING - 24))
OUTER=$((SIZE + 2 * RING))
R=$((SIZE / 2))
RO=$((OUTER / 2))
# The output keeps the full teaser length, so the closing card never gets cut.
LENGTH=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$BASE")

ffmpeg -y -loglevel error -i "$BASE" -i "$CAM" -filter_complex "
  [1:v]setpts=PTS-STARTPTS,hflip,crop='min(iw,ih)':'min(iw,ih)',scale=${SIZE}:${SIZE},format=yuva420p,
       geq=lum='p(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='if(lte(hypot(X-${R},Y-${R}),${R}),255,0)'[face];
  color=c=0xff88df:s=${OUTER}x${OUTER},format=yuva420p,
       geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='if(lte(hypot(X-${RO},Y-${RO}),${RO}),255,0)'[ring];
  [ring][face]overlay=${RING}:${RING}:shortest=1[bubble];
  [0:v][bubble]overlay=${X}:${Y}:shortest=0:eof_action=pass[v];
  [1:a]asetpts=PTS-STARTPTS,highpass=f=80,loudnorm=I=-16:TP=-1.5:LRA=11,apad[a]
" -map "[v]" -map "[a]" -t "$LENGTH" -c:v libx264 -pix_fmt yuv420p -crf 20 -c:a aac -b:a 160k -movflags +faststart "$OUT"

echo "Wrote $OUT ($(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUT") s)"
