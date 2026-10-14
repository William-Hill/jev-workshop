"""Build the text-free maze video for William's own voiceover, timed to his take.

    python3 scripts/voiceover-base.py                       # default timing, about 20 s
    python3 scripts/voiceover-base.py --decision 6.1 --state 11.4 --finale 17.2 --length 20.5
    python3 scripts/voiceover-base.py --preview             # wide gameplay for the recorder page

Input: recordings/maze-clean.mp4 (CLEAN=1 node scripts/record-maze.mjs; seed 5003, real speed).
Output: docs/presentation/media/maze-voiceover-base.mp4 (or --out). No captions and no cards.

The camera follows the script. scripts/voiceover-make.sh finds the times in the take:
  0 to --decision        the whole game         "Jev is a decision-making model ..."
  --decision to --state  zoom: the decision and its four bars    "Here you can see each decision ..."
  --state to --finale    zoom: the board state sent to Jev        "It gets the state of the game board ..."
  --finale to --length   a cut to the last seconds of the game, ending on the win screen.
"""

import argparse
import subprocess
from pathlib import Path

SRC = Path("recordings/maze-clean.mp4")
OUT = Path("docs/presentation/media/maze-voiceover-base.mp4")
PREVIEW = Path("docs/presentation/media/maze-clean-preview.mp4")
GAME_END = 61.3  # Seconds into maze-clean.mp4 where the game ends (from the recording log).
WIN_HOLD = 2.5  # Seconds of the win screen at the end of the video.
MOVE = 0.8  # Seconds for each camera move.
MIN_FINALE = 3.0
FPS = 25

# Camera positions: (zoom, centre x, centre y) on the 1920x1080 frame.
WIDE = (1.0, 960, 540)
DECISION = (2.67, 1440, 372)  # The "JEV · DOWN" label and the UP / LEFT / RIGHT / DOWN bars.
STATE = (2.53, 1440, 565)  # The bars and the "STATE SENT" JSON: tile, power time, steps to each blocker.


def eased(start: float, end: float) -> str:
    """A smoothstep from 0 to 1 between two times, as an ffmpeg expression in 'it'."""
    f = f"clip((it-{start:.3f})/({end:.3f}-{start:.3f}),0,1)"
    return f"({f}*{f}*(3-2*{f}))"


def track(index: int, moves: list[tuple[float, float, tuple, tuple]]) -> str:
    """Build the expression for one camera value (0 zoom, 1 x, 2 y) over all moves."""
    expr = str(WIDE[index])
    for start, end, a, b in moves:
        expr = f"if(lt(it,{start:.3f}),{expr},{a[index]}+({b[index]}-{a[index]})*{eased(start, end)})"
    return expr


def run(args: list[str]) -> None:
    """Run ffmpeg quietly and fail loudly."""
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *args], check=True)


def build(decision: float, state: float, finale: float, length: float, out: Path) -> None:
    """Render the zoomed part up to the finale, then the end of the game, and join them."""
    finale_length = max(MIN_FINALE, length - finale)
    moves = [(decision, decision + MOVE, WIDE, DECISION), (state, state + MOVE, DECISION, STATE)]
    zoom, cx, cy = (track(i, moves) for i in range(3))
    zoompan = (
        f"zoompan=z='{zoom}':x='max(0,min(iw-iw/zoom,{cx}-iw/zoom/2))':"
        f"y='max(0,min(ih-ih/zoom,{cy}-ih/zoom/2))':d=1:s=1920x1080:fps={FPS}"
    )
    # The finale ends WIN_HOLD seconds into the win screen.
    finale_start = GAME_END + WIN_HOLD - finale_length
    graph = (
        f"[0:v]trim=0:{finale:.3f},setpts=PTS-STARTPTS,fps={FPS},{zoompan},setsar=1[a];"
        f"[0:v]trim={finale_start:.3f}:{GAME_END + WIN_HOLD:.3f},setpts=PTS-STARTPTS,fps={FPS},setsar=1[b];"
        "[a][b]concat=n=2:v=1:a=0[v]"
    )
    run(["-i", str(SRC), "-filter_complex", graph, "-map", "[v]", "-c:v", "libx264", "-pix_fmt", "yuv420p",
         "-crf", "19", "-movflags", "+faststart", str(out)])


def main() -> None:
    """Parse the times and build the video, or the preview for the recorder page."""
    parser = argparse.ArgumentParser()
    parser.add_argument("--decision", type=float, default=6.0)
    parser.add_argument("--state", type=float, default=11.0)
    parser.add_argument("--finale", type=float, default=17.0)
    parser.add_argument("--length", type=float, default=20.5)
    parser.add_argument("--out", type=Path, default=OUT)
    parser.add_argument("--preview", action="store_true")
    args = parser.parse_args()
    if args.preview:
        # Wide gameplay only, small, for the recorder page to loop while William reads.
        run(["-i", str(SRC), "-t", "40", "-vf", "scale=1280:-2", "-c:v", "libx264", "-pix_fmt", "yuv420p",
             "-crf", "28", "-an", "-movflags", "+faststart", str(PREVIEW)])
        print(f"Wrote {PREVIEW}")
        return
    if not args.decision < args.state < args.finale < args.length:
        raise SystemExit("The times must rise: decision < state < finale < length.")
    build(args.decision, args.state, args.finale, args.length, args.out)
    length = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0",
                             str(args.out)], capture_output=True, text=True, check=True).stdout.strip()
    print(f"Wrote {args.out} ({length} s)")


if __name__ == "__main__":
    main()
