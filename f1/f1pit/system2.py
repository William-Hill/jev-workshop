"""System 2: an LLM decides the uncertain laps. Code decides when, and code checks the answer.

Backends: "claude-cli" (headless Claude Code with the user's own login, the default with no
ANTHROPIC_API_KEY) or "anthropic" (ANTHROPIC_API_KEY). The same choice as src/jev/llm.node.js.
"""
import json
import os
import re
import subprocess
import time

SC_WORDS = ("SAFETY CAR", "VIRTUAL SAFETY CAR", "VSC")
SYSTEM = "You are a Formula 1 race strategist. Answer with yes or no first, then one sentence."


def should_escalate(p, f, low: float = 0.35, high: float = 0.65) -> bool:
    if p is None or low <= p <= high:
        return True
    return any(w in m.upper() for m in f["race_control_messages"] for w in SC_WORDS)


def parse_answer(text: str):
    words = (text or "").strip().split()
    first = re.sub(r"[^a-z]", "", words[0].lower()) if words else ""
    return 1.0 if first == "yes" else 0.0 if first == "no" else None


def _prompt(f: dict) -> str:
    return "Facts about this driver and lap (calculated by code):\n" + json.dumps(f, indent=1) + \
        "\nMust the driver pit at the end of this lap? Answer yes or no first, then one sentence of reason."


def cli_args(model: str) -> list:
    # No user settings, no tools, no saved session: the model sees only our system prompt and the prompt.
    return ["claude", "-p", "--model", model, "--output-format", "json", "--system-prompt", SYSTEM,
            "--tools", "", "--setting-sources", "", "--no-session-persistence"]


def ask_llm(f: dict, backend: str = None) -> dict:
    backend = backend or os.environ.get("LLM_BACKEND") or ("anthropic" if os.environ.get("ANTHROPIC_API_KEY") else "claude-cli")
    model = os.environ.get("LLM_MODEL") or ("claude-sonnet-5-5" if backend == "anthropic" else "sonnet")
    t0 = time.time()
    usage = None
    try:
        if backend == "claude-cli":
            r = subprocess.run(cli_args(model), input=_prompt(f), capture_output=True, text=True, timeout=120, cwd="/tmp")
            d = json.loads(r.stdout) if r.returncode == 0 else {"result": "", "is_error": True}
            text = "" if d.get("is_error") else d.get("result", "")
            usage = d.get("usage")
        else:
            import anthropic
            msg = anthropic.Anthropic().messages.create(model=model, max_tokens=80, system=SYSTEM,
                                                        messages=[{"role": "user", "content": _prompt(f)}])
            text = "".join(c.text for c in msg.content if c.type == "text")
            usage = msg.usage.model_dump()
    except Exception as err:  # A failed call keeps the Jev probability.
        text = f"error: {err}"
    return {"p": parse_answer(text), "text": text, "ms": round((time.time() - t0) * 1000), "usage": usage}
