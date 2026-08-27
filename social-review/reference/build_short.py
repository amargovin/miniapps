#!/usr/bin/env python3
"""Short-form weekly deck: one week-on-week slide + the three post appendices.

Reuses every style helper from the skill's build_deck.py so the two stay visually
identical. All dates are stated as explicit week-ending Sundays.
"""
import importlib.util, json, csv, os, sys, argparse
from datetime import date, timedelta

SKILL = "/root/.claude/skills/synced/weekly-social-review"
spec = importlib.util.spec_from_file_location("bd", f"{SKILL}/scripts/build_deck.py")
bd = importlib.util.module_from_spec(spec); spec.loader.exec_module(bd)

from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

P, fmt, datatable, Rule_ = bd.P, bd.fmt, bd.datatable, bd.Rule_
TITLE, H, KICK, LEAD, SMALL, TD, TDc, TLc, TH = (bd.TITLE, bd.H, bd.KICK, bd.LEAD,
                                                  bd.SMALL, bd.TD, bd.TDc, bd.TLc, bd.TH)
INK, ACC, MUT, RULE, BAND, GOOD, BAD = bd.INK, bd.ACC, bd.MUT, bd.RULE, bd.BAND, bd.GOOD, bd.BAD
PAGE = bd.PAGE

TH2 = P("TH2", fontName="Helvetica-Bold", fontSize=7.2, textColor=colors.white, leading=8.8)
DL  = P("DL", fontName="Helvetica", fontSize=8.6, textColor=colors.HexColor(MUT), leading=11.4)
WD  = P("WD", fontName="Helvetica", fontSize=9.4, textColor=colors.HexColor(INK), leading=12.0)


def sunday_label(iso):
    d = date.fromisoformat(iso)
    return d.strftime("%-d %B %Y")


def delta_cell(prev, cur, invert_neutral=False, pct_of=None):
    """Signed percentage change, coloured unless the metric is direction-neutral."""
    if prev in ("", None) or cur in ("", None):
        return Paragraph("<font color='#5b6472'>&mdash;</font>", WD)
    try:
        p, c = float(prev), float(cur)
    except ValueError:
        return Paragraph("<font color='#5b6472'>&mdash;</font>", WD)
    if p == 0:
        return Paragraph("<font color='#5b6472'>&mdash;</font>", WD)
    v = 100.0 * (c - p) / p
    txt = f"{v:+.1f}%"
    if invert_neutral:
        return Paragraph(f"<font color='#5b6472'>{txt}</font>", WD)
    col = GOOD if v >= 0 else BAD
    return Paragraph(f"<font color='{col}'><b>{txt}</b></font>", WD)


def num(v, blank_zero=False):
    if v in ("", None):
        return "&mdash;"
    try:
        f = float(v)
    except ValueError:
        return str(v)
    if blank_zero and f == 0:
        return "&mdash;"
    return f"{int(f):,}" if f == int(f) else f"{f:,.1f}"


def build(summary, history, out, prev_week, cur_week, prev_note):
    chans = summary["channels"]
    top = summary.get("top", {})
    P_LAB = sunday_label(prev_week)      # e.g. "9 August 2026"
    C_LAB = sunday_label(cur_week)
    P_SHORT = date.fromisoformat(prev_week).strftime("%-d %b")
    C_SHORT = date.fromisoformat(cur_week).strftime("%-d %b")
    cur_start = (date.fromisoformat(cur_week) - timedelta(days=6)).strftime("%A %-d %B")

    hrow = lambda w, ch: next((r for r in history
                               if r["week_ending"] == w and r["channel"] == ch), None)

    S = []
    def slide(*fl):
        S.extend(list(fl)); S.append(PageBreak())

    # ---------------- slide 1: week on week ----------------
    NAMES = {"x": "X / @SwarajyaMag", "instagram": "Instagram / @swarajya_mag",
             "facebook": "Facebook / Swarajya"}
    order = [c["key"] for c in chans]

    header = ["Channel",
              f"Posts<br/>w/e {P_SHORT}", f"Posts<br/>w/e {C_SHORT}", "Change",
              f"Engagement<br/>w/e {P_SHORT}", f"Engagement<br/>w/e {C_SHORT}", "Change",
              f"Per post<br/>w/e {P_SHORT}", f"Per post<br/>w/e {C_SHORT}", "Change",
              f"Median<br/>w/e {P_SHORT}", f"Median<br/>w/e {C_SHORT}"]
    body, tot = [], {"p_posts": 0, "c_posts": 0, "p_eng": 0, "c_eng": 0}
    for k in order:
        a, b = hrow(prev_week, k), hrow(cur_week, k)
        if not b:
            continue
        pv = a or {}
        body.append([
            Paragraph(f"<b>{NAMES.get(k,k)}</b>", WD),
            Paragraph(num(pv.get("posts")), WD), Paragraph(num(b["posts"]), WD),
            delta_cell(pv.get("posts"), b["posts"], invert_neutral=True),
            Paragraph(num(pv.get("engagement")), WD),
            Paragraph(f"<b>{num(b['engagement'])}</b>", WD),
            delta_cell(pv.get("engagement"), b["engagement"]),
            Paragraph(num(pv.get("engagement_per_post")), WD),
            Paragraph(f"<b>{num(b['engagement_per_post'])}</b>", WD),
            delta_cell(pv.get("engagement_per_post"), b["engagement_per_post"]),
            Paragraph(num(pv.get("median_engagement")), WD),
            Paragraph(num(b.get("median_engagement")), WD),
        ])
        if a:
            tot["p_posts"] += int(float(a["posts"])); tot["p_eng"] += int(float(a["engagement"]))
        tot["c_posts"] += int(float(b["posts"])); tot["c_eng"] += int(float(b["engagement"]))

    pp = round(tot["p_eng"] / tot["p_posts"], 1) if tot["p_posts"] else ""
    cp = round(tot["c_eng"] / tot["c_posts"], 1) if tot["c_posts"] else ""
    body.append([
        Paragraph("<b>All channels</b>", WD),
        Paragraph(f"<b>{num(tot['p_posts'])}</b>", WD), Paragraph(f"<b>{num(tot['c_posts'])}</b>", WD),
        delta_cell(tot["p_posts"], tot["c_posts"], invert_neutral=True),
        Paragraph(f"<b>{num(tot['p_eng'])}</b>", WD), Paragraph(f"<b>{num(tot['c_eng'])}</b>", WD),
        delta_cell(tot["p_eng"], tot["c_eng"]),
        Paragraph(f"<b>{num(pp)}</b>", WD), Paragraph(f"<b>{num(cp)}</b>", WD),
        delta_cell(pp, cp), Paragraph("&mdash;", WD), Paragraph("&mdash;", WD)])

    W = [52*mm, 21*mm, 21*mm, 20*mm, 27*mm, 27*mm, 20*mm, 21*mm, 21*mm, 20*mm, 21*mm, 21*mm]
    tb = datatable([h for h in header], body, W, align_from=1, pad=8.5)
    tb._argW = W
    tb.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(INK)),
                            ("LINEABOVE", (0, len(body)), (-1, len(body)), 0.9, colors.HexColor(INK)),
                            ("BACKGROUND", (0, len(body)), (-1, len(body)), colors.HexColor(BAND))]))

    x = hrow(cur_week, "x"); xp = hrow(prev_week, "x")
    reach_bits = []
    if x and x.get("impressions") not in ("", None) and float(x["impressions"]) > 0:
        pr = xp.get("impressions") if xp else ""
        d = ""
        if pr not in ("", None) and float(pr) > 0:
            d = f" ({100*(float(x['impressions'])-float(pr))/float(pr):+.1f}%)"
        reach_bits.append(f"<b>X reach</b> {num(pr)} &rarr; {num(x['impressions'])}{d}")
        if x.get("engagement_rate_pct") and xp and xp.get("engagement_rate_pct"):
            reach_bits.append(f"<b>X engagement rate</b> {xp['engagement_rate_pct']}% &rarr; "
                              f"{x['engagement_rate_pct']}%")
    reach_bits.append("<b>Reach is X-only</b> &mdash; the Meta connector returns no impressions, "
                      "so Instagram and Facebook have no reach and no engagement rate.")

    slide(
        Paragraph("WEEK ON WEEK", KICK), Spacer(1, 3),
        Paragraph(f"Week ending Sunday {C_LAB}, against week ending Sunday {P_LAB}", H),
        Spacer(1, 4),
        Paragraph(f"This week is the seven full days {cur_start} to Sunday {C_LAB}, in UTC. "
                  f"Every column below is labelled by the Sunday its week ends on. "
                  f"Engagement = likes + shares/reposts + comments/replies, plus quotes and "
                  f"bookmarks on X.", DL),
        Spacer(1, 13), tb, Spacer(1, 13),
        Paragraph(" &nbsp;&middot;&nbsp; ".join(reach_bits), SMALL), Spacer(1, 9),
        Paragraph(prev_note, SMALL), Spacer(1, 11),
        Paragraph("Posting volume moved sharply on every channel, so <b>engagement per post is "
                  "the honest comparison</b> and totals are not. Per-post engagement is also "
                  "unaffected by how long the comparison window was.", LEAD))

    # ---------------- slides 2-4: appendices ----------------
    letters = "ABCDEFG"
    for n, c in enumerate(chans):
        rows = top.get(c["key"]) or []
        if not rows:
            continue
        if c["key"] == "x":
            b = [[Paragraph(str(r["rank"]), TDc), Paragraph(r["date"][5:], TDc),
                  Paragraph(f'<link href="{r["url"]}">{r["title"]}</link>', TLc),
                  Paragraph(fmt(r["likes"]), TDc), Paragraph(fmt(r["reposts"]), TDc),
                  Paragraph(fmt(r["replies"]), TDc), Paragraph(fmt(r["quotes"]), TDc),
                  Paragraph(fmt(r["bookmarks"]), TDc),
                  Paragraph(f"<b>{fmt(r['engagement'])}</b>", TDc),
                  Paragraph(fmt(r["impressions"]), TDc)] for r in rows]
            tb = datatable(["#", "Date", "Post", "Likes", "Reposts", "Repl.", "Quo.", "Bkmk",
                            "Engagement", "Impressions"], b,
                           [8*mm, 14*mm, 104*mm, 20*mm, 22*mm, 16*mm, 16*mm, 20*mm, 28*mm, 28*mm],
                           pad=1.55)
        else:
            b = [[Paragraph(str(r["rank"]), TDc), Paragraph(r["date"][5:], TDc),
                  Paragraph(f'<link href="{r["url"]}">{r["title"]}</link>' if r["url"]
                            else r["title"], TLc if r["url"] else TDc),
                  Paragraph(fmt(r["likes"]), TDc), Paragraph(fmt(r["comments"]), TDc),
                  Paragraph(fmt(r["shares"]), TDc),
                  Paragraph(f"<b>{fmt(r['engagement'])}</b>", TDc)] for r in rows]
            tb = datatable(["#", "Date", "Post", "Likes", "Comments", "Shares", "Engagement"], b,
                           [8*mm, 14*mm, 150*mm, 26*mm, 30*mm, 26*mm, 32*mm], pad=1.55)
        shown, total = len(rows), c["posts"]
        cap = (f"all {shown} posts in the week" if shown >= total
               else f"top {shown} of {total} posts")
        notes = [f"Week ending Sunday {C_LAB}."]
        if not c["has_reach"]:
            notes.append("No reach data available from this connector.")
        if c.get("suspect_zero"):
            notes.append(", ".join(c["suspect_zero"]).capitalize() +
                         " returned 0 on every post and are treated as unreported.")
        if c["key"] == "x":
            notes.append("Threads are counted once, credited to the head post.")
        notes.append("Titles link to the original post.")
        slide(Paragraph(f"APPENDIX {letters[n]}", KICK), Spacer(1, 3),
              Paragraph(f"{c['name']} &mdash; {cap}", H), Spacer(1, 5),
              Paragraph(" ".join(notes), SMALL), Spacer(1, 5), tb)

    if S and isinstance(S[-1], PageBreak):
        S.pop()
    slides = 1 + sum(1 for f in S if isinstance(f, PageBreak))

    foot = f"Swarajya  |  social performance, week ending Sunday {C_LAB}"

    def deco(canv, doc):
        canv.saveState()
        canv.setStrokeColor(colors.HexColor(RULE)); canv.setLineWidth(0.5)
        canv.line(20*mm, 15*mm, PAGE[0]-20*mm, 15*mm)
        canv.setFont("Helvetica", 7.2); canv.setFillColor(colors.HexColor(MUT))
        canv.drawString(20*mm, 10.5*mm, foot)
        canv.drawRightString(PAGE[0]-20*mm, 10.5*mm, str(doc.page))
        canv.setFillColor(colors.HexColor(INK))
        canv.rect(0, PAGE[1]-3.2*mm, PAGE[0], 3.2*mm, fill=1, stroke=0)
        canv.restoreState()

    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    doc = SimpleDocTemplate(out, pagesize=PAGE, leftMargin=20*mm, rightMargin=20*mm,
                            topMargin=15*mm, bottomMargin=18*mm,
                            title=f"Swarajya - Social Performance, week ending {C_LAB}",
                            author="Swarajya")
    doc.build(S, onFirstPage=deco, onLaterPages=deco)
    return slides, sum(len(v) for v in top.values() if v)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--summary", required=True)
    ap.add_argument("--history", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--prev-week", required=True)
    ap.add_argument("--cur-week", required=True)
    ap.add_argument("--prev-note", default="")
    a = ap.parse_args()
    summary = json.load(open(a.summary, encoding="utf-8"))
    history = list(csv.DictReader(open(a.history, encoding="utf-8")))
    s, l = build(summary, history, a.out, a.prev_week, a.cur_week, a.prev_note)
    print(f"built {a.out}")
    sys.exit(0 if bd.verify(a.out, s, l) else 1)
