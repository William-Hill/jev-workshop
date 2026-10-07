import asyncio
from types import SimpleNamespace
from f1pit.jev import pit_question, jev_probs

class FakeClient:
    def __init__(self, fail_on=None):
        self.calls = 0
        self.fail_on = fail_on
    async def system_one(self, state, questions):
        self.calls += 1
        if state["lap"]["lap"] == self.fail_on:
            raise RuntimeError("HTTP 529")
        p = 0.9 if state["lap"]["tyre_age_vs_typical"] == "past" else 0.1
        return SimpleNamespace(nouls={"pit_now": SimpleNamespace(noul=p)}, usage=SimpleNamespace(input_tokens=600))

def facts(lap, age_vs):
    return {"lap": lap, "tyre_age_vs_typical": age_vs}

def test_the_question_is_one_noul_with_the_rules():
    q = pit_question()
    assert list(q) == ["pit_now"]

def test_probabilities_keep_the_order_and_mark_errors():
    client = FakeClient(fail_on=3)
    probs = asyncio.run(jev_probs([facts(1, "past"), facts(2, "well before"), facts(3, "past")], client=client))
    assert probs[0] == 0.9 and probs[1] == 0.1 and probs[2] is None
    assert jev_probs.last_errors == 1
    assert jev_probs.last_usage == 1200
