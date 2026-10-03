"""Wrapper: runs flappy.py main() unchanged, but logs each API response
(model, usage, latency, answers) to logs/<policy>.jsonl and refuses any
host other than api.typesafe.ai. It does not log the request headers."""
import json, os, sys, time, io, urllib.request, urllib.parse
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "lunar-terminal", "jev-games"))
policy = sys.argv[sys.argv.index("--policy") + 1]
LOG = open(os.path.join(HERE, "logs", f"{policy}.jsonl"), "w")
_orig = urllib.request.urlopen
def logged(req, timeout=None):
    host = urllib.parse.urlparse(req.full_url).hostname
    if host != "api.typesafe.ai":
        raise SystemExit(f"blocked host {host}")
    body = json.loads(req.data.decode())
    t0 = time.perf_counter()
    rec = {"state": body["state"], "model_req": body["model"]}
    try:
        with _orig(req, timeout=timeout) as r:
            raw = r.read()
    except Exception as e:
        rec.update(error=str(e)[:200], lat_ms=round((time.perf_counter()-t0)*1000))
        LOG.write(json.dumps(rec) + "\n"); LOG.flush(); raise
    rec["lat_ms"] = round((time.perf_counter() - t0) * 1000)
    d = json.loads(raw.decode())
    rec.update(model=d.get("model"), usage=d.get("usage"), answers=d.get("answers"))
    LOG.write(json.dumps(rec) + "\n"); LOG.flush()
    return io.BytesIO(raw)
urllib.request.urlopen = logged
import flappy
flappy.urllib.request.urlopen = logged
sys.argv = ["flappy.py"] + sys.argv[1:]
flappy.main()
