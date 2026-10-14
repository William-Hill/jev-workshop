"""Build the text-free maze video for William's own voiceover script.

    python3 scripts/voiceover-base.py

Input: recordings/maze-clean.mp4 (CLEAN=1 node scripts/record-maze.mjs; seed 5003, real speed).
Output: docs/presentation/media/maze-voiceover-base.mp4, about 41 s, no captions and no cards.

The camera follows the script:
  0-13 s   the whole game     "Jev is a decision-making model ... quick decisions."
  13-22 s  zoom: the decision and its four bars    "... up, down, left, or right."
  22-32 s  zoom: the board state sent to Jev       "It gets the state of the game board ..."
  32-33 s  zoom out; then a cut to the last seconds of the game and the win screen.
"""

import subprocess
from pathlib import Path

SRC = Path("recordings/maze-clean.mp4")
OUT = Path("docs/presentation/media/maze-voiceover-base.mp4")
GAME_END = 61.3  # Seconds into maze-clean.mp4 where the game ends (from the recording log).
FINALE = 4.0  # Seconds of play before the end that the final cut keeps.
FPS = 25

# Keyframes: (start, end of the move, zoom, centre x, centre y) on the 1920x1080 frame.
WIDE = (1.0, 960, 540)
DECISION = (2.67, 1440, 372)  # The "JEV · DOWN" label and the UP / LEFT / RIGHT / DOWN bars.
STATE = (2.53, 1440, 565)  # The bars and the "STATE SENT" JSON: tile, power time, steps to each blocker.
MOVES = [(13.0, 14.0, WIDE, DECISION), (22.0, 23.0, DECISION, STATE), (32.0, 33.2, STATE, WIDE)]
PART_A = 33.2


def eased(start: float, end: float) -> str:
    """A smoothstep from 0 to 1 between two times, as an ffmpeg expression in 'it'."""
    f = f"clip((it-{start})/({end}-{start}),0,1)"
    return f"({f}*{f}*(3-2*{f}))"


def track(index: int) -> str:
    """Build the expression for one keyframe value (0 zoom, 1 x, 2 y) over all moves."""
    expr = str(WIDE[index])
    for start, end, a, b in MOVES:
        expr = f"if(lt(it,{start}),{expr},{a[index]}+({b[index]}-{a[index]})*{eased(start, end)})"
    return expr


def main() -> None:
    """Render part A with the moving camera, add the finale, and join them."""
    zoom, cx, cy = track(0), track(1), track(2)
    zoompan = (
        f"zoompan=z='{zoom}':x='max(0,min(iw-iw/zoom,{cx}-iw/zoom/2))':"
        f"y='max(0,min(ih-ih/zoom,{cy}-ih/zoom/2))':d=1:s=1920x1080:fps={FPS}"
    )
    finale_start = GAME_END - FINALE
    graph = (
        f"[0:v]trim=0:{PART_A},setpts=PTS-STARTPTS,fps={FPS},{zoompan},setsar=1[a];"
        f"[0:v]trim={finale_start},setpts=PTS-STARTPTS,fps={FPS},setsar=1[b];"
        "[a][b]concat=n=2:v=1:a=0[v]"
    )
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(SRC), "-filter_complex", graph, "-map", "[v]",
         "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "19", "-movflags", "+faststart", str(OUT)],
        check=True,
    )
    length = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(OUT)],
                            capture_output=True, text=True, check=True).stdout.strip()
    print(f"Wrote {OUT} ({length} s)")


if __name__ == "__main__":
    main()
