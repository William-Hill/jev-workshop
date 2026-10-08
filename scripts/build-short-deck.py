"""Build the 25-minute deck from the full deck.

    python3 scripts/build-short-deck.py

Reads docs/presentation/jev-workshop.html (the full deck) and writes
docs/presentation/jev-workshop-25min.html. The full deck stays the source: edit it,
then run this script again. The selection follows the six stakeholder reviews in
docs/presentation/review/README.md.

- KEEP lists the full-deck slides in the short deck, in order.
- MERGE adds one short line from a cut slide to a kept slide, and moves the cut
  slide's speaker notes under the kept slide's notes.
"""

import re
from pathlib import Path

FULL = Path("docs/presentation/jev-workshop.html")
SHORT = Path("docs/presentation/jev-workshop-25min.html")

KEEP = [1, 2, 3, 4, 5, 6, 10, 12, 15, 18, 19, 20, 22, 26, 27, 28, 29, 31, 34, 35, 37, 38]

# kept slide -> (cut slides whose notes move here, one visible line or None)
MERGE = {
    6: ([7, 8, 9], None),
    10: ([11], "Three question types: Choice (one option), Score (a level), Noul (the probability of yes)."),
    12: ([13], None),
    15: ([14], None),
    18: ([16, 17], None),
    22: ([21, 23], "Pin jev-1.13.0, keep a held-out test set, and log every decision."),
    26: ([24, 25], None),
    28: ([], None),
    31: ([32], "F1 2026 pit stops: a trained model beat Jev on all laps (0.147 against 0.076)."),
    34: ([33], None),
    35: ([36], None),
}
# kept slide -> text replacements, where a new line would not fit
REPLACE = {
    6: [(
        '<p class="small">It reads natural language, like an LLM. It returns a typed answer, one of your options, and it writes no text.</p>',
        '<p class="small">It reads language like an LLM and returns one of your options. Think of a classifier whose labels you write in English.</p>',
    )],
    22: [
        ('<div class="kicker">How to use it · rule 4</div>', '<div class="kicker">How to use it · rule 3</div>'),
    ],
    18: [
        ("Five rules make this work. The first one is about the words.", "Three rules make this work. The first one is about the words."),
    ],
    15: [(
        '<p class="src">Left: phuryn/experiments on GitHub, rerun 3 times by us. Right: Rafe and Das preprint, not rerun by us.</p>',
        '<p class="src">Left: phuryn/experiments, rerun 3 times by us. Right: Rafe and Das preprint, not rerun. TypeSafe lists 9 failure modes, for example math, dates, and option order.</p>',
    )],
}
# kept slide -> a new bridge line, where the full-deck bridge points to a cut slide
BRIDGES = {
    6: 'Bridge: "Here is what one request looks like."',
    8: 'Bridge: "Calibrated or not, confidence has a blind spot."',
    9: 'Bridge: "So how do you build with it? Code owns the workflow."',
    12: 'Bridge: "Rule three: let your test results and the stakes decide what code does."',
    13: 'Bridge: "Here is one real workflow at RenderATL."',
    17: 'Bridge: "So where does Jev not fit?"',
    18: 'Bridge: "Where it does fit, here is a second measured case: attendee questions."',
    19: 'Bridge: "Before you build, watch Jev play."',
}
EXTRA_NOTES = {
    28: "<p>Jevons, if there is time: TypeSafe named Jev after William Stanley Jevons. When a resource gets cheaper, we use more of it. Cheaper decisions mean more decisions. That is TypeSafe's bet, and also the risk: many cheap decisions add up to more total mistakes.</p>",
}
MAZE_BULLETS = (
    '<ul class="ev" style="gap:22px">'
    '<li style="font-size:30px">Code counts the steps to each blocker.</li>'
    '<li style="font-size:30px">Jev picks a direction at each intersection.</li>'
    '<li style="font-size:30px">Our best question alone: 6 of 30 new games.</li>'
    '<li style="font-size:30px">With a code planner on the hard 1 in 5 moves: 28 of 30.</li>'
    "</ul>"
)


def notes_of(section: str) -> str:
    """Return the inner HTML of the speaker notes, without the bridge line."""
    match = re.search(r'<aside class="notes">(.*?)</aside>', section, re.S)
    inner = match.group(1) if match else ""
    return re.sub(r'\s*<p class="bridge">.*?</p>', "", inner, flags=re.S).strip()


def add_line(section: str, text: str) -> str:
    """Add one source-style line above the speaker notes."""
    return section.replace('  <aside class="notes">', f'  <p class="src">{text}</p>\n  <aside class="notes">', 1)


def add_notes(section: str, html: str) -> str:
    """Add notes before the bridge line of the kept slide, or at the end."""
    if '<p class="bridge">' in section:
        return section.replace('<p class="bridge">', html + '\n    <p class="bridge">', 1)
    return section.replace("</aside>", html + "\n  </aside>", 1)


def main() -> None:
    """Select, merge, and write the short deck."""
    full = FULL.read_text()
    sections = list(re.finditer(r'<section class="slide[^"]*" data-part="\d">.*?</section>', full, re.S))
    head, tail = full[: sections[0].start()], full[sections[-1].end():]
    by_number = {i + 1: m.group(0) for i, m in enumerate(sections)}
    out = []
    for number in KEEP:
        section = by_number[number]
        cut, line = MERGE.get(number, ([], None))
        if line:
            section = add_line(section, line)
        for old, new in REPLACE.get(number, []):
            assert old in section, old[:60]
            section = section.replace(old, new, 1)
        for other in cut:
            moved = notes_of(by_number[other])
            if moved:
                section = add_notes(section, f'<p><b>From full-deck slide {other}:</b></p>\n    {moved}')
        if number in EXTRA_NOTES:
            section = add_notes(section, EXTRA_NOTES[number])
        if number == 35:
            section = re.sub(
                r'<video class="vid center" style="height:400px" (src="media/maze-teaser.mp4"[^>]*)></video>',
                r'<div class="row center" style="align-items:center"><video class="vid" style="flex:1.4 1 0;height:400px" \1></video>'
                + MAZE_BULLETS + "</div>",
                section,
            )
        position = len(out) + 1
        if position in BRIDGES:
            section = re.sub(r'<p class="bridge">.*?</p>', f'<p class="bridge">{BRIDGES[position]}</p>', section, count=1, flags=re.S)
        out.append(section)
    body = "\n\n".join(out)
    # Slide numbers in the notes refer to the full deck.
    body = re.sub(r"\b(see )?slides? (\d+)( and (\d+))?", lambda m: "full-deck " + m.group(0), body)
    page = head.replace("<title>Jev Workshop", "<title>Jev Workshop (25 min)", 1) + body + tail
    SHORT.write_text(page)
    print(f"Wrote {SHORT}: {len(out)} slides from {len(sections)}.")


if __name__ == "__main__":
    main()
