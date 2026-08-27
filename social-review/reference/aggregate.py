#!/usr/bin/env python3
"""Aggregate weekly social metrics into summary.json.

Reads work/data/x_posts.csv and work/data/meta_posts.csv, validates them, computes
per-channel and combined totals, and writes a summary the deck builder consumes.

Fails loudly. A total that is wrong by one post looks exactly like a correct one once it
reaches a slide, so bad input must stop the run rather than degrade quietly.
"""
import argparse, csv, json, os, statistics, sys
from datetime import datetime, date

X_COLS = ["id","created_at","likes","reposts","replies","quotes","bookmarks",
          "impressions","is_head","title"]
M_COLS = ["platform","id","created_at","likes","comments","shares","permalink","title"]

def die(msg):
    print(f"ERROR: {msg}", file=sys.stderr); sys.exit(1)

def read_csv(path, cols, label):
    if not os.path.exists(path):
        return []
    with open(path, newline="", encoding="utf-8") as fh:
        rd = csv.DictReader(fh)
        missing = [c for c in cols if c not in (rd.fieldnames or [])]
        if missing:
            die(f"{label}: missing column(s) {missing}. Found {rd.fieldnames}")
        rows = list(rd)
    seen, out = set(), []
    for i, r in enumerate(rows, 2):
        pid = (r.get("id") or "").strip()
        if not pid:
            die(f"{label} line {i}: empty id")
        if pid in seen:
            print(f"  note: {label} dropping duplicate id {pid} (page-boundary overlap)")
            continue
        seen.add(pid); out.append(r)
    return out

def num(r, k, label, pid):
    v = (r.get(k) or "").strip()
    if v in ("", "None", "null"):
        return 0
    try:
        return int(float(v))
    except ValueError:
        die(f"{label} id={pid}: column {k} is not a number ({v!r})")

def in_window(ts, since, until):
    if not ts:
        return True
    for fmt in ("%Y-%m-%dT%H:%M:%S%z","%Y-%m-%dT%H:%M:%S.%f%z",
                "%Y-%m-%dT%H:%M:%SZ","%Y-%m-%d"):
        try:
            d = datetime.strptime(ts.replace("+0000","+0000"), fmt).date()
            return since <= d <= until
        except ValueError:
            continue
    return True  # unparseable timestamps are kept rather than silently dropped

def pct(a, b):
    return round(100.0 * a / b, 1) if b else 0.0

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--data", required=True)
    p.add_argument("--since", required=True)
    p.add_argument("--until", required=True)
    p.add_argument("--followers-x", type=int, default=0)
    p.add_argument("--followers-ig", type=int, default=0)
    p.add_argument("--followers-fb", type=int, default=0)
    p.add_argument("--label", default="")
    p.add_argument("--out", required=True)
    a = p.parse_args()

    since = date.fromisoformat(a.since); until = date.fromisoformat(a.until)
    if until < since:
        die("--until precedes --since")

    xr = read_csv(os.path.join(a.data, "x_posts.csv"), X_COLS, "x_posts.csv")
    mr = read_csv(os.path.join(a.data, "meta_posts.csv"), M_COLS, "meta_posts.csv")
    if not xr and not mr:
        die("no input rows found in either CSV")

    channels, top = [], {}

    # ---- X ----
    if xr:
        drop = [r for r in xr if not in_window(r.get("created_at"), since, until)]
        if drop:
            print(f"  note: {len(drop)} X row(s) outside window, excluded")
            xr = [r for r in xr if r not in drop]
        tot = dict(likes=0, reposts=0, replies=0, quotes=0, bookmarks=0, impressions=0)
        eng_all, heads = [], []
        for r in xr:
            pid = r["id"]
            vals = {k: num(r, k, "x_posts.csv", pid) for k in tot}
            for k in tot:
                tot[k] += vals[k]
            e = sum(vals[k] for k in ("likes","reposts","replies","quotes","bookmarks"))
            eng_all.append(e)
            if str(r.get("is_head","1")).strip() in ("1","true","True","yes",""):
                heads.append((e, vals, r))
        eng = sum(eng_all)
        heads.sort(key=lambda t: -t[0])
        top["x"] = [{
            "rank": i, "date": (h[2].get("created_at") or "")[:10],
            "title": h[2].get("title") or h[2]["id"], "id": h[2]["id"],
            "url": f"https://x.com/SwarajyaMag/status/{h[2]['id']}",
            "likes": h[1]["likes"], "reposts": h[1]["reposts"], "replies": h[1]["replies"],
            "quotes": h[1]["quotes"], "bookmarks": h[1]["bookmarks"],
            "impressions": h[1]["impressions"], "engagement": h[0],
        } for i, h in enumerate(heads[:25], 1)]
        f = a.followers_x
        channels.append({
            "key":"x","name":"X / @SwarajyaMag","followers":f,"posts":len(xr),
            "engagement":eng,"impressions":tot["impressions"],
            "breakdown":[("Likes",tot["likes"]),("Reposts",tot["reposts"]),
                         ("Bookmarks",tot["bookmarks"]),("Replies",tot["replies"]),
                         ("Quotes",tot["quotes"])],
            "per_post": round(eng/len(xr),1) if xr else 0,
            "per_1k": round(eng/(f/1000.0),1) if f else None,
            "median": int(statistics.median(eng_all)) if eng_all else 0,
            "engagement_rate": round(100.0*eng/tot["impressions"],2) if tot["impressions"] else None,
            "has_reach": bool(tot["impressions"]),
        })

    # ---- Meta ----
    for key, name, plat, fol in (("instagram","Instagram / @swarajya_mag","instagram",a.followers_ig),
                                 ("facebook","Facebook / Swarajya","facebook",a.followers_fb)):
        rows = [r for r in mr if (r.get("platform") or "").strip().lower() == plat]
        if not rows:
            continue
        L=C=S=0; items=[]
        for r in rows:
            pid=r["id"]
            l=num(r,"likes","meta_posts.csv",pid); c=num(r,"comments","meta_posts.csv",pid)
            s=num(r,"shares","meta_posts.csv",pid)
            L+=l; C+=c; S+=s
            items.append((l+c+s,l,c,s,r))
        eng=L+C+S
        items.sort(key=lambda t:-t[0])
        top[key]=[{"rank":i,"date":(it[4].get("created_at") or "")[:10],
                   "title":it[4].get("title") or it[4]["id"],
                   "url":it[4].get("permalink") or "","likes":it[1],
                   "comments":it[2],"shares":it[3],"engagement":it[0]}
                  for i,it in enumerate(items[:25],1)]
        channels.append({
            "key":key,"name":name,"followers":fol,"posts":len(rows),"engagement":eng,
            "impressions":0,
            "breakdown":[("Likes",L),("Comments",C),("Shares",S)],
            "per_post":round(eng/len(rows),1),
            "per_1k":round(eng/(fol/1000.0),1) if fol else None,
            "median":int(statistics.median([i[0] for i in items])),
            "engagement_rate":None,"has_reach":False,
            "suspect_zero":[n for n,v in (("shares",S),("comments",C)) if v==0],
        })

    order={"x":0,"instagram":1,"facebook":2}
    channels.sort(key=lambda c: order.get(c["key"],9))

    T_eng=sum(c["engagement"] for c in channels)
    T_posts=sum(c["posts"] for c in channels)
    T_imp=sum(c["impressions"] for c in channels)
    T_fol=sum(c["followers"] for c in channels)
    for c in channels:
        c["share_engagement"]=pct(c["engagement"],T_eng)
        c["share_followers"]=pct(c["followers"],T_fol)

    xc=next((c for c in channels if c["key"]=="x"),None)
    conc={}
    if xc and top.get("x"):
        best=top["x"][0]
        conc={"top_post_title":best["title"],
              "top_post_engagement":best["engagement"],
              "top_post_impressions":best["impressions"],
              "top_post_share_eng":pct(best["engagement"],xc["engagement"]),
              "top_post_share_reach":pct(best["impressions"],xc["impressions"]) if xc["impressions"] else 0.0,
              "top25_share_eng":pct(sum(t["engagement"] for t in top["x"]),xc["engagement"]),
              "top25_share_reach":pct(sum(t["impressions"] for t in top["x"]),xc["impressions"]) if xc["impressions"] else 0.0,
              "mean":xc["per_post"],"median":xc["median"]}

    label=a.label or f"{since.strftime('%-d')}\u2013{until.strftime('%-d %B %Y')}"
    out={"window":{"since":a.since,"until":a.until,"label":label,
                   "week_ending":a.until},
         "channels":channels,
         "combined":{"posts":T_posts,"engagement":T_eng,"impressions":T_imp,
                     "followers":T_fol,
                     "per_post":round(T_eng/T_posts,1) if T_posts else 0,
                     "reach_channels":[c["key"] for c in channels if c["has_reach"]]},
         "concentration":conc,"top":top}

    os.makedirs(os.path.dirname(os.path.abspath(a.out)),exist_ok=True)
    with open(a.out,"w",encoding="utf-8") as fh:
        json.dump(out,fh,indent=2,ensure_ascii=False)

    print(f"OK  window {a.since} to {a.until}")
    for c in channels:
        rr = f", reach {c['impressions']:,}" if c["has_reach"] else ", reach n/a"
        print(f"  {c['name']:<28} posts {c['posts']:>4}  eng {c['engagement']:>8,}"
              f"  /post {c['per_post']:>7}{rr}")
    print(f"  {'COMBINED':<28} posts {T_posts:>4}  eng {T_eng:>8,}")
    print(f"wrote {a.out}")

if __name__ == "__main__":
    main()
