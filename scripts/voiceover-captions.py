"""Burn-in captions for the voiceover videos: short phrases, with the spoken word in pink.

    python3 scripts/voiceover-captions.py <captions.json> wide|tall|feed <length s> <out.mov>

voiceover-make.py writes captions.json (recordings/voiceover-work/), one entry per phrase:
  {"start": 1.2, "end": 2.9, "words": [{"text": "Jev", "start": 1.2, "end": 1.5}, ...]}
Edit the "text" values to fix a word, then run voiceover-make.py with --captions-only.

This ffmpeg build has no drawtext or subtitles filter, so Pillow draws one transparent frame for
each change, and the ffmpeg concat demuxer turns them into a track with alpha (PNG in MOV).
"""

import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FONT = "/System/Library/Fonts/Supplemental/Arial Black.ttf"
PAPER = (252, 249, 238, 255)
PINK = (255, 136, 223, 255)
BOX = (33, 28, 34, 225)
# (frame width, frame height, font size, caption centre x, caption centre y, max line width)
LAYOUTS = {
    "wide": (1920, 1080, 54, 835, 985, 1350),  # Bottom centre, left of the webcam bubble.
    "tall": (1080, 1920, 58, 540, 1175, 980),  # Between the gameplay and the webcam bubble.
    "feed": (1080, 1350, 50, 540, 908, 980),  # The 4:5 carousel post: between the gameplay and the bubble.
}


def frame(layout: str, words: list[dict] | None, current: int) -> Image.Image:
    """Draw one transparent frame: the phrase on a dark box, the current word in pink."""
    w, h, size, cx, cy, max_w = LAYOUTS[layout]
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    if not words:
        return img
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT, size)
    space = d.textlength(" ", font=font)
    widths = [d.textlength(x["text"], font=font) for x in words]
    # Wrap into lines no wider than max_w.
    lines, line, line_w = [], [], 0.0
    for i, width in enumerate(widths):
        add = width if not line else line_w + space + width
        if line and add > max_w:
            lines.append((line, line_w)); line, line_w = [i], width
        else:
            line.append(i); line_w = add
    lines.append((line, line_w))
    line_h = int(size * 1.25)
    total_h = line_h * len(lines)
    pad = 22
    box_w = max(lw for _, lw in lines) + 2 * pad
    top = cy - total_h // 2
    d.rounded_rectangle([cx - box_w / 2, top - pad / 2, cx + box_w / 2, top + total_h + pad / 2], radius=18, fill=BOX)
    for n, (idx, lw) in enumerate(lines):
        x = cx - lw / 2
        y = top + n * line_h
        for i in idx:
            d.text((x, y), words[i]["text"], font=font, fill=PINK if i == current else PAPER)
            x += widths[i] + space
    return img


def main() -> None:
    """Render the caption track for one layout."""
    if len(sys.argv) < 5:
        raise SystemExit(__doc__)
    captions = json.loads(Path(sys.argv[1]).read_text())
    layout, length, out = sys.argv[2], float(sys.argv[3]), Path(sys.argv[4])
    # Events: each word start changes the frame; each phrase end clears it.
    events: list[tuple[float, list[dict] | None, int]] = []
    for c in captions:
        for i, word in enumerate(c["words"]):
            events.append((word["start"], c["words"], i))
        events.append((c["end"], None, -1))
    events.sort(key=lambda e: e[0])
    with tempfile.TemporaryDirectory() as tmp:
        work = Path(tmp)
        blank = work / "blank.png"
        frame(layout, None, -1).save(blank)
        entries, t, n = [], 0.0, 0
        current = (None, -1)
        for when, words, index in events + [(length, None, -1)]:
            when = min(max(when, t), length)
            if when > t:
                path = blank
                if current[0]:
                    path = work / f"f{n:04d}.png"
                    frame(layout, current[0], current[1]).save(path)
                    n += 1
                entries.append((path, when - t))
                t = when
            current = (words, index)
        lines = [f"file '{p}'\nduration {d:.3f}" for p, d in entries] + [f"file '{entries[-1][0]}'"]
        (work / "list.txt").write_text("\n".join(lines) + "\n")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(work / "list.txt"),
                        "-vf", "fps=30,format=rgba", "-c:v", "png", "-t", f"{length:.3f}", str(out)], check=True)
    print(f"Wrote {out} ({n} caption frames, {layout})")


if __name__ == "__main__":
    main()
