import json, re, statistics as S, sys
sys.path.insert(0, "lunar-terminal/jev-games")
import flappy as F
tot_in=tot_out=0; calls=0; models={}; lats=[]
for p in ["jev_strategy","jev_perception","jev_atomic"]:
    rows=[json.loads(l) for l in open(f"logs/{p}.jsonl")]
    li=[r["lat_ms"] for r in rows]; ti=sum(r["usage"]["input_tokens"] for r in rows); to=sum(r["usage"]["output_tokens"] for r in rows)
    for r in rows: models[r["model"]]=models.get(r["model"],0)+1
    tot_in+=ti; tot_out+=to; calls+=len(rows); lats+=li
    li.sort()
    print(f"{p}: calls={len(rows)} in_tok={ti} out_tok={to} in/call={ti/len(rows):.0f} lat mean={S.mean(li):.0f} p50={li[len(li)//2]} p95={li[int(len(li)*.95)]} max={li[-1]} cost=${ti*0.042/1e6:.6f}")
    if p=="jev_strategy":
        n=0; ok=0; pf=[]
        for r in rows:
            m=re.search(r"bird_row=(\d+).*opening_rows=(\d+)\.\.(\d+)", r["state"]); b,lo,hi=map(int,m.groups())
            a=r["answers"]["act"]; pf.append(a["probabilities"]["flap"])
            want = "flap" if b>(lo+1) else "hold"   # scripted rule
            ok += a["choice"]==want; n+=1
        print(f"   choices: flap={sum(r['answers']['act']['choice']=='flap' for r in rows)} hold={sum(r['answers']['act']['choice']=='hold' for r in rows)}; agree with scripted rule {ok}/{n}; P(flap) range {min(pf):.2f}-{max(pf):.2f}")
    if p=="jev_atomic":
        acc={"above":[0,0],"below":[0,0],"aligned":[0,0]}; dec_ok=0; scr_ok=0
        for r in rows:
            m=re.search(r"bird_row=(\d+).*opening_rows=(\d+)\.\.(\d+)", r["state"]); b,lo,hi=map(int,m.groups())
            truth={"above":b<lo,"below":b>hi,"aligned":lo<=b<=hi}
            for k in acc:
                acc[k][0]+= (r["answers"][k]["noul"]>0.5)==truth[k]; acc[k][1]+=1
        allq=sum(v[0] for v in acc.values()); alln=sum(v[1] for v in acc.values())
        print("   noul accuracy (threshold 0.5):", {k:f"{v[0]}/{v[1]}={v[0]/v[1]:.3f}" for k,v in acc.items()}, f"all={allq}/{alln}={allq/alln:.3f}")
print(f"TOTAL calls={calls} in_tok={tot_in} out_tok={tot_out} cost=${tot_in*0.042/1e6:.6f} models={models}")
# oracle: atomic code rule fed with perfect answers
def oracle(seed):
    r,col=F.ROWS//2,0
    for t in range(F.MAX_TICKS):
        g=F.gap_at(F.next_pipe(col),seed); flap = r>g+F.GAP_HALF
        r+= -1 if flap else 1; col+=1
        if not (0<=r<F.ROWS): return col-1
        gc=F.gap_at(col,seed)
        if col%F.PIPE_EVERY==0 and not (gc-1<=r<=gc+1): return col-1
    return col
sc=[oracle(1000+i) for i in range(8)]; print("atomic rule + perfect answers, seeds 1000-1007:", sc, S.mean(sc))
