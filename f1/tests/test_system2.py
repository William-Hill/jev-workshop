from f1pit.system2 import should_escalate, parse_answer, cli_args

F = {"safety_car": False, "virtual_safety_car": False, "race_control_messages": []}

def test_escalate_in_the_uncertain_band_only():
    assert should_escalate(0.5, F) is True
    assert should_escalate(0.9, F) is False
    assert should_escalate(None, F) is True   # a Jev error goes to System 2

def test_escalate_when_a_safety_car_message_arrives():
    assert should_escalate(0.1, {**F, "race_control_messages": ["SAFETY CAR DEPLOYED"]}) is True

def test_parse_answer():
    assert parse_answer("Yes. The tyres are past their typical life.") == 1.0
    assert parse_answer("no - stay out") == 0.0
    assert parse_answer("It depends on the gap.") is None
    assert parse_answer("") is None

def test_the_cli_runs_with_no_tools_no_settings_and_no_saved_session():
    a = cli_args("sonnet")
    assert a[:2] == ["claude", "-p"]
    assert a[a.index("--tools") + 1] == "" and a[a.index("--setting-sources") + 1] == ""
    assert "--no-session-persistence" in a
