"""Lay out the voiceover video as a 9:16 Instagram Reel (1080x1920).

    python3 scripts/voiceover-vertical.py <base.mp4> <clean take> [output.mp4] [captions.mov]

voiceover-make.py calls this with its intermediate files (recordings/voiceover-work/).
The layout keeps the Reels interface clear: no content in the top 200 px (the header), the
bottom 340 px (the caption and the username), or the right 140 px below the middle (the buttons).

  y  220-470    title and event line (an image drawn with Pillow; this ffmpeg has no drawtext)
  y  500-1108   the gameplay with its zooms, 1080x608
  y 1120-1230   the captions (optional), between the gameplay and the bubble
  y 1250-1610   the webcam bubble, 360 px, with a pink ring
"""

import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1920
VIDEO_Y = 500
BUBBLE = 360
RING = 10
BUBBLE_Y = 1250
NIGHT = (33, 28, 34)
PAPER = (252, 249, 238)
PINK = (255, 136, 223)
TITLE_FONT = "/System/Library/Fonts/Supplemental/Arial Black.ttf"
BODY_FONT = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
TITLE = ["CAN JEV PLAY", "PAC-MAN?"]
EVENT = "JEV WORKSHOP · RENDERATL × AI SHIP & SOCIAL · OCT 15"
OUT = Path("docs/presentation/media/maze-voiceover-instagram.mp4")


def background(path: Path) -> None:
    """Draw the static layer: the dark background, a faint grid, the title, and the video frame."""
    img = Image.new("RGB", (W, H), NIGHT)
    d = ImageDraw.Draw(img)
    for x in range(0, W, 48):
        d.line([(x, 0), (x, H)], fill=(43, 37, 44))
    for y in range(0, H, 48):
        d.line([(0, y), (W, y)], fill=(43, 37, 44))
    title = ImageFont.truetype(TITLE_FONT, 96)
    y = 220
    for i, line in enumerate(TITLE):
        l, t, r, b = d.textbbox((0, 0), line, font=title)
        d.text(((W - (r - l)) // 2 - l, y - t), line, font=title, fill=PINK if i == 1 else PAPER)
        y += (b - t) + 18
    body = ImageFont.truetype(BODY_FONT, 30)
    l, t, r, b = d.textbbox((0, 0), EVENT, font=body)
    d.text(((W - (r - l)) // 2 - l, y + 14 - t), EVENT, font=body, fill=(252, 249, 238))
    d.rectangle([0, VIDEO_Y - 6, W, VIDEO_Y + 608 + 5], fill=PINK)  # A pink rule above and below the video.
    img.save(path)


def main() -> None:
    """Compose the background, the gameplay, and the round webcam, with the voice."""
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    base, cam = Path(sys.argv[1]), Path(sys.argv[2])
    out = Path(sys.argv[3]) if len(sys.argv) > 3 else OUT
    captions = Path(sys.argv[4]) if len(sys.argv) > 4 else None
    length = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(base)],
                            capture_output=True, text=True, check=True).stdout.strip()
    with tempfile.TemporaryDirectory() as tmp:
        bg = Path(tmp) / "bg.png"
        background(bg)
        r, outer = BUBBLE // 2, BUBBLE + 2 * RING
        ro = outer // 2
        bx = (W - outer) // 2
        graph = (
            f"[0:v]scale={W}:608,setsar=1[game];"
            f"[2:v]setpts=PTS-STARTPTS,hflip,crop='min(iw,ih)':'min(iw,ih)',scale={BUBBLE}:{BUBBLE},format=yuva420p,"
            f"geq=lum='p(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='if(lte(hypot(X-{r},Y-{r}),{r}),255,0)'[face];"
            f"color=c=0xff88df:s={outer}x{outer},format=yuva420p,"
            f"geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='if(lte(hypot(X-{ro},Y-{ro}),{ro}),255,0)'[ring];"
            f"[ring][face]overlay={RING}:{RING}:shortest=1[bubble];"
            f"[1:v][game]overlay=0:{VIDEO_Y}[v1];"
            f"[v1][bubble]overlay={bx}:{BUBBLE_Y}:eof_action=pass[v2];"
            + ("[v2][3:v]overlay=0:0:eof_action=pass,fps=30,format=yuv420p[v];" if captions else "[v2]fps=30,format=yuv420p[v];")
            + 
            "[2:a]asetpts=PTS-STARTPTS,highpass=f=80,loudnorm=I=-14:TP=-1.5:LRA=11,"
            "aresample=48000,aformat=sample_rates=48000:channel_layouts=stereo,apad[a]"
        )
        subprocess.run(
            ["ffmpeg", "-y", "-loglevel", "error", "-i", str(base), "-loop", "1", "-i", str(bg), "-i", str(cam),
             *(["-i", str(captions)] if captions else []), "-filter_complex", graph, "-map", "[v]", "-map", "[a]", "-t", length,
             "-c:v", "libx264", "-profile:v", "high", "-level", "4.1", "-crf", "19", "-maxrate", "8M", "-bufsize", "16M",
             "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(out)],
            check=True,
        )
    print(f"Wrote {out} (1080x1920, {float(length):.1f} s)")


if __name__ == "__main__":
    main()
