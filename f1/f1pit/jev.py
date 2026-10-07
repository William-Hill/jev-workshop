"""System 1: one Jev Noul for each driver and lap. Code calculates every fact first."""
import asyncio
from typesafe_sdk import AsyncTypeSafeClient, Noul, NoulCriteria
from .config import JEV_MODEL

INSTRUCTIONS = " ".join([
    "Must the driver in `lap` enter the pit lane at the end of this lap? Decide by these steps, in order.",
    "1. If `laps_remaining` is below 3, the answer is no.",
    "2. If `safety_car` or `virtual_safety_car` is true and `tyre_age_vs_typical` is near or past, the answer is yes: a stop now costs less time.",
    "3. If `tyre_age_vs_typical` is past and `stop_still_required` is true, the answer is yes.",
    "4. If `tyre_age_vs_typical` is past and `laps_remaining` is above 8, the answer is yes.",
    "5. If `stop_now_loses_position` is true and steps 2 to 4 do not apply, the answer is no.",
    "6. If a message in `race_control_messages` says that a safety car or a virtual safety car starts, treat it as step 2.",
    "7. Otherwise the answer is no.",
])


def pit_question() -> dict:
    return {"pit_now": Noul(
        instructions=INSTRUCTIONS,
        criteria=NoulCriteria(true="The driver must pit at the end of this lap.", false="The driver must stay out this lap."),
    )}


async def jev_probs(facts_list, concurrency: int = 8, client=None):
    own = client is None
    client = client or AsyncTypeSafeClient(model=JEV_MODEL)
    sem = asyncio.Semaphore(concurrency)
    usage = errors = 0
    questions = pit_question()

    async def one(f):
        nonlocal usage, errors
        async with sem:
            try:
                r = await client.system_one(state={"lap": f}, questions=questions)
                usage += getattr(getattr(r, "usage", None), "input_tokens", 0) or 0
                return float(r.nouls["pit_now"].noul)
            except Exception:  # The error is counted; the lap gets no probability.
                errors += 1
                return None

    try:
        probs = await asyncio.gather(*(one(f) for f in facts_list))
    finally:
        if own:
            close = getattr(client, "aclose", None) or getattr(client, "close", None)
            if close:
                await close()
    jev_probs.last_usage, jev_probs.last_errors = usage, errors
    return list(probs)
