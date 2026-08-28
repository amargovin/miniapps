"""The deliverable: a four-slide PDF, and never more than five (brief §8).

Ported from the manual process's two renderers — reference/build_deck.py (palette,
paragraph styles, table helper, page furniture) and reference/build_short.py (the
four-slide layout) — into one module. The visual system is identical on purpose; where
build_short.py and §8 disagreed, §8 won.

  Slide 1     WEEK ON WEEK — one table, a row per channel plus All channels, paired
              columns for posts / engagement / per post / median, each headed by the
              Sunday its week ends on, a change column after each pair.
  Slides 2-4  Appendices in the order X, Instagram, Facebook. Top 25 by engagement, or
              all posts where the channel published fewer. Every title links to the post.

Nothing else: no title slide, no findings panels, no recommendations, no charts. Those go
in the Chat message (app/findings.py).

Two hard rules the layout has to keep:

  - **The date rule (§8).** Never a bare range like "2-9 August". Always name the Sunday a
    week ends on, state the window's first and last day in full at least once per document,
    always name the timezone, and label every comparison column with its week-ending date.
  - **One page per slide, one link per appendix row.** A wrapped title creates a second
    link annotation and a spilled table creates a fifth page; both are §9 failures, so
    `build_deck` returns the counts it intends and app/verify.py checks the bytes.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import inch
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table,
                                TableStyle)

from app.aggregate import ChannelRollup, order_rollups
from app.window import short_label, sunday_label, tz_name, window_sentence

# ---- visual system (reference/build_deck.py) ----
PAGE = (13.333 * inch, 7.5 * inch)
MARGIN = 20 * mm

INK = "#14213d"; ACC = "#1d4ed8"; MUT = "#5b6472"; RULE = "#c9cfda"; BAND = "#eef1f6"
GOOD = "#15803d"; BAD = "#b91c1c"

_ss = getSampleStyleSheet()


def P(name: str, parent: ParagraphStyle | None = None, **kw) -> ParagraphStyle:
    return ParagraphStyle(name, parent=parent or _ss["Normal"], **kw)


H     = P("H",     fontName="Helvetica-Bold", fontSize=19,  textColor=colors.HexColor(INK), leading=23)
KICK  = P("KICK",  fontName="Helvetica-Bold", fontSize=8.4, textColor=colors.HexColor(ACC), leading=11)
LEAD  = P("LEAD",  fontName="Helvetica",      fontSize=11.6, textColor=colors.HexColor(INK), leading=16.5)
SMALL = P("SMALL", fontName="Helvetica",      fontSize=8.3, textColor=colors.HexColor(MUT), leading=11.6)
TH    = P("TH",    fontName="Helvetica-Bold", fontSize=7.6, textColor=colors.white,          leading=9.6)
TH2   = P("TH2",   fontName="Helvetica-Bold", fontSize=6.9, textColor=colors.white,          leading=8.4)
TDc   = P("TDc",   fontName="Helvetica",      fontSize=7.4, textColor=colors.HexColor(INK), leading=9.0)
TLc   = P("TLc",   fontName="Helvetica",      fontSize=7.4, textColor=colors.HexColor(ACC), leading=9.0)
DL    = P("DL",    fontName="Helvetica",      fontSize=8.6, textColor=colors.HexColor(MUT), leading=11.4)
WD    = P("WD",    fontName="Helvetica",      fontSize=8.6, textColor=colors.HexColor(INK), leading=11.2)

# A TableStyle ALIGN does not move text inside a Paragraph cell, so numeric columns get
# right-aligned paragraph styles of their own.
THr   = P("THr",   parent=TH,   alignment=TA_RIGHT)
TH2r  = P("TH2r",  parent=TH2,  alignment=TA_RIGHT)
TDr   = P("TDr",   parent=TDc,  alignment=TA_RIGHT)
WDr   = P("WDr",   parent=WD,   alignment=TA_RIGHT)

DASH = "&mdash;"


def fmt(n) -> str:
    if n is None:
        return DASH
    if isinstance(n, bool):
        return str(n)
    if isinstance(n, int):
        return f"{n:,}"
    if isinstance(n, float):
        return f"{n:,.1f}" if n != int(n) else f"{int(n):,}"
    return str(n)


def datatable(header, rows, widths, align_from=3, pad=2.6, hpad=4.5, header_style=TH,
              header_style_right=None):
    right = header_style_right or (TH2r if header_style is TH2 else THr)
    data = [[Paragraph(h, header_style if i < align_from else right)
             for i, h in enumerate(header)]] + rows
    t = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    st = [("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(INK)),
          ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
          ("ALIGN", (align_from, 0), (-1, -1), "RIGHT"),
          ("TOPPADDING", (0, 0), (-1, -1), pad),
          ("BOTTOMPADDING", (0, 0), (-1, -1), pad),
          ("LEFTPADDING", (0, 0), (-1, -1), hpad),
          ("RIGHTPADDING", (0, 0), (-1, -1), hpad),
          ("LINEBELOW", (0, 1), (-1, -1), 0.25, colors.HexColor(RULE))]
    for i in range(1, len(rows) + 1):
        if i % 2 == 0:
            st.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#f7f9fc")))
    t.setStyle(TableStyle(st))
    return t


# ---- week-on-week helpers ----

def _num(v, decimals: int = 0) -> str:
    if v in ("", None):
        return DASH
    try:
        f = float(v)
    except (TypeError, ValueError):
        return str(v)
    if decimals or f != int(f):
        return f"{f:,.1f}"
    return f"{int(f):,}"


def _delta(prev, cur, *, neutral: bool = False, comparable: bool = True) -> Paragraph:
    """Signed percentage change. `comparable=False` refuses the delta outright — §3 forbids
    a week-on-week delta across rows whose week_tz differs unless the older row has been
    verified equivalent."""
    if not comparable:
        return Paragraph(f"<font color='{MUT}'>n/c</font>", WDr)
    if prev in ("", None) or cur in ("", None):
        return Paragraph(f"<font color='{MUT}'>{DASH}</font>", WDr)
    try:
        p, c = float(prev), float(cur)
    except (TypeError, ValueError):
        return Paragraph(f"<font color='{MUT}'>{DASH}</font>", WDr)
    if p == 0:
        return Paragraph(f"<font color='{MUT}'>{DASH}</font>", WDr)
    v = 100.0 * (c - p) / p
    txt = f"{v:+.1f}%"
    if neutral:
        return Paragraph(f"<font color='{MUT}'>{txt}</font>", WDr)
    col = GOOD if v >= 0 else BAD
    return Paragraph(f"<font color='{col}'><b>{txt}</b></font>", WDr)


# Weeks whose stored UTC rows have been verified to contain the identical post set under
# the IST definition, and may therefore be compared with IST rows (§3, §5). The
# 2026-08-16 week was verified and is already *tagged* Asia/Kolkata, so it needs no entry
# here; 2026-08-09 was not verified and must not be silently compared.
VERIFIED_EQUIVALENT_WEEKS: frozenset[date] = frozenset()

# The 2026-08-09 source deck labelled its window "2-9 August 2026" and both dates were
# Sundays, so that window is either eight days or the seven days Monday 3 - Sunday 9 and
# the source does not say which (§5).
AMBIGUOUS_WINDOW_WEEKS: frozenset[date] = frozenset({date(2026, 8, 9)})


def comparable(prior_row: dict | None, week_tz: str) -> bool:
    if not prior_row:
        return False
    if prior_row.get("week_tz") == week_tz:
        return True
    we = prior_row.get("week_ending")
    return we in VERIFIED_EQUIVALENT_WEEKS


@dataclass
class Deck:
    pdf: bytes
    filename: str
    slide_count: int
    link_count: int
    notes: list[dict]


def deck_filename(week_ending: date) -> str:
    return f"swarajya_social_review_{week_ending.isoformat()}.pdf"


def build_deck(
    *,
    week_ending: date,
    week_tz: str,
    rollups: list[ChannelRollup],
    prior_rows: dict[str, dict] | None = None,
    prior_week_ending: date | None = None,
    unavailable: list[str] | None = None,
) -> Deck:
    rollups = order_rollups(rollups)
    prior_rows = prior_rows or {}
    unavailable = unavailable or []
    notes: list[dict] = []

    C_LAB = sunday_label(week_ending)
    P_LAB = sunday_label(prior_week_ending) if prior_week_ending else None
    C_SHORT = short_label(week_ending)
    P_SHORT = short_label(prior_week_ending) if prior_week_ending else DASH

    story: list = []

    def slide(*flowables):
        story.extend(flowables)
        story.append(PageBreak())

    # ================= slide 1: WEEK ON WEEK =================
    header = ["Channel"]
    for label in ("Posts", "Engagement", "Per post", "Median"):
        header += [f"{label}<br/>w/e<br/>{P_SHORT}", f"{label}<br/>w/e<br/>{C_SHORT}", "Change"]

    body = []
    tot = {"p_posts": 0, "c_posts": 0, "p_eng": 0, "c_eng": 0}
    any_incomparable = False
    ambiguous = False

    for r in rollups:
        prev = prior_rows.get(r.channel)
        cmpable = comparable(prev, week_tz)
        any_incomparable = any_incomparable or (prev is not None and not cmpable)
        if prev and prev.get("week_ending") in AMBIGUOUS_WINDOW_WEEKS:
            ambiguous = True
        pv = prev or {}
        body.append([
            Paragraph(f"<b>{r.name}</b>", WD),
            Paragraph(_num(pv.get("posts")), WDr),
            Paragraph(f"<b>{_num(r.posts)}</b>", WDr),
            _delta(pv.get("posts"), r.posts, neutral=True, comparable=cmpable),
            Paragraph(_num(pv.get("engagement")), WDr),
            Paragraph(f"<b>{_num(r.engagement)}</b>", WDr),
            _delta(pv.get("engagement"), r.engagement, comparable=cmpable),
            Paragraph(_num(pv.get("engagement_per_post"), 1), WDr),
            Paragraph(f"<b>{_num(r.engagement_per_post, 1)}</b>", WDr),
            _delta(pv.get("engagement_per_post"), r.engagement_per_post, comparable=cmpable),
            Paragraph(_num(pv.get("median_engagement")), WDr),
            Paragraph(_num(r.median_engagement), WDr),
            _delta(pv.get("median_engagement"), r.median_engagement, comparable=cmpable),
        ])
        if prev:
            tot["p_posts"] += int(pv.get("posts") or 0)
            tot["p_eng"] += int(pv.get("engagement") or 0)
        tot["c_posts"] += r.posts
        tot["c_eng"] += r.engagement

    all_cmp = all(comparable(prior_rows.get(r.channel), week_tz) for r in rollups) \
        and bool(prior_rows)
    pp = round(tot["p_eng"] / tot["p_posts"], 1) if tot["p_posts"] else None
    cp = round(tot["c_eng"] / tot["c_posts"], 1) if tot["c_posts"] else None
    body.append([
        Paragraph("<b>All channels</b>", WD),
        Paragraph(f"<b>{_num(tot['p_posts'] or None)}</b>", WDr),
        Paragraph(f"<b>{_num(tot['c_posts'])}</b>", WDr),
        _delta(tot["p_posts"] or None, tot["c_posts"], neutral=True, comparable=all_cmp),
        Paragraph(f"<b>{_num(tot['p_eng'] or None)}</b>", WDr),
        Paragraph(f"<b>{_num(tot['c_eng'])}</b>", WDr),
        _delta(tot["p_eng"] or None, tot["c_eng"], comparable=all_cmp),
        Paragraph(f"<b>{_num(pp, 1)}</b>", WDr),
        Paragraph(f"<b>{_num(cp, 1)}</b>", WDr),
        _delta(pp, cp, comparable=all_cmp),
        # Medians are per-post distributions; they do not sum across channels.
        Paragraph(DASH, WDr), Paragraph(DASH, WDr), Paragraph(DASH, WDr),
    ])

    W = [40 * mm] + [22 * mm, 22 * mm, 17 * mm] * 4          # 40 + 4*61 = 284mm of 298.7
    table = datatable(header, body, W, align_from=1, pad=7.0, hpad=3.2, header_style=TH2)
    table.setStyle(TableStyle([
        ("LINEABOVE", (0, len(body)), (-1, len(body)), 0.9, colors.HexColor(INK)),
        ("BACKGROUND", (0, len(body)), (-1, len(body)), colors.HexColor(BAND)),
        ("LINEAFTER", (3, 0), (3, -1), 0.5, colors.HexColor(RULE)),
        ("LINEAFTER", (6, 0), (6, -1), 0.5, colors.HexColor(RULE)),
        ("LINEAFTER", (9, 0), (9, -1), 0.5, colors.HexColor(RULE)),
    ]))

    below: list[str] = []
    x = next((r for r in rollups if r.channel == "x"), None)
    xp = prior_rows.get("x")
    if x and x.impressions:
        bits = f"<b>X reach</b> {_num((xp or {}).get('impressions'))} &rarr; {_num(x.impressions)}"
        if xp and comparable(xp, week_tz) and (xp.get("impressions") or 0):
            d = 100.0 * (x.impressions - float(xp["impressions"])) / float(xp["impressions"])
            bits += f" ({d:+.1f}%)"
        below.append(bits)
        if x.engagement_rate_pct is not None:
            prior_er = (xp or {}).get("engagement_rate_pct")
            below.append(f"<b>X engagement rate</b> "
                         f"{f'{float(prior_er):.2f}%' if prior_er else DASH} &rarr; "
                         f"{x.engagement_rate_pct:.2f}%")
    below.append("<b>Reach is X-only</b> &mdash; the Meta Graph API returns no impressions "
                 "on these edges, so Instagram and Facebook have no reach figure and no "
                 "engagement rate. Those are unreported, not zero.")
    if unavailable:
        below.append(f"<b>{', '.join(unavailable)} unavailable this week</b> &mdash; "
                     f"reported as unavailable rather than zero.")

    caveats: list[str] = []
    if any_incomparable:
        prior_tz = next((p.get("week_tz") for p in prior_rows.values()
                         if p.get("week_tz") != week_tz), "another timezone")
        caveats.append(
            f"Change columns read <b>n/c</b> where the prior row was computed on "
            f"{tz_name(prior_tz)} weeks and this one on {tz_name(week_tz)} weeks: the two "
            f"windows are not the same seven days, and a delta across them would be a "
            f"comparison of definitions rather than of performance."
        )
        notes.append({"note": "week_tz_mismatch", "prior_week_tz": prior_tz,
                      "week_tz": week_tz})
    if ambiguous:
        weeks = ", ".join(sunday_label(w) for w in sorted(AMBIGUOUS_WINDOW_WEEKS)
                          if any(p.get("week_ending") == w for p in prior_rows.values()))
        caveats.append(
            f"The comparison row for week ending Sunday {weeks} came from a deck whose "
            f"window was labelled “2–9 August 2026”. Both of those dates were "
            f"Sundays, so that window is either eight days or the seven days Monday 3 to "
            f"Sunday 9 August 2026, and the source does not say which."
        )
        notes.append({"note": "ambiguous_prior_window", "weeks": weeks})

    prior_sentence = (
        f", against week ending Sunday {P_LAB}" if P_LAB else
        ", with no prior week stored to compare against"
    )
    slide(
        Paragraph("WEEK ON WEEK", KICK), Spacer(1, 3),
        Paragraph(f"Week ending Sunday {C_LAB}{prior_sentence}", H), Spacer(1, 4),
        Paragraph(
            f"This week is {window_sentence(week_ending, week_tz)}. Every column below is "
            f"labelled by the Sunday its week ends on. Engagement = likes + "
            f"shares/reposts + comments/replies, plus quotes and bookmarks on X, which "
            f"inflates X slightly against the two Meta channels.", DL),
        Spacer(1, 11), table, Spacer(1, 11),
        Paragraph(" &nbsp;&middot;&nbsp; ".join(below), SMALL), Spacer(1, 7),
        *[f for c in caveats for f in (Paragraph(c, SMALL), Spacer(1, 5))],
        Spacer(1, 4),
        Paragraph("Where posting volume swung sharply, <b>engagement per post is the honest "
                  "comparison</b> and the totals are not.", LEAD),
    )

    # ================= slides 2-4: appendices =================
    letters = "ABCDEFG"
    link_count = 0
    for n, r in enumerate(rollups):
        rows = r.top
        if not rows:
            continue
        if r.channel == "x":
            body = [[Paragraph(str(t["rank"]), TDc), Paragraph(t["date"][5:], TDc),
                     Paragraph(f'<link href="{t["url"]}">{t["title"]}</link>', TLc),
                     Paragraph(fmt(t["likes"]), TDr), Paragraph(fmt(t["reposts"]), TDr),
                     Paragraph(fmt(t["replies"]), TDr), Paragraph(fmt(t["quotes"]), TDr),
                     Paragraph(fmt(t["bookmarks"]), TDr),
                     Paragraph(f"<b>{fmt(t['engagement'])}</b>", TDr),
                     Paragraph(fmt(t["impressions"]), TDr)] for t in rows]
            tb = datatable(["#", "Date", "Post", "Likes", "Reposts", "Repl.", "Quo.", "Bkmk",
                            "Engagement", "Impressions"], body,
                           [8 * mm, 14 * mm, 104 * mm, 20 * mm, 22 * mm, 16 * mm, 16 * mm,
                            20 * mm, 28 * mm, 28 * mm], pad=1.55)
        else:
            body = [[Paragraph(str(t["rank"]), TDc), Paragraph(t["date"][5:], TDc),
                     Paragraph(f'<link href="{t["url"]}">{t["title"]}</link>' if t["url"]
                               else t["title"], TLc if t["url"] else TDc),
                     Paragraph(fmt(t["likes"]), TDr), Paragraph(fmt(t["comments"]), TDr),
                     Paragraph(fmt(t["shares"]), TDr),
                     Paragraph(f"<b>{fmt(t['engagement'])}</b>", TDr)] for t in rows]
            tb = datatable(["#", "Date", "Post", "Likes", "Comments", "Shares", "Engagement"],
                           body, [8 * mm, 14 * mm, 150 * mm, 26 * mm, 30 * mm, 26 * mm,
                                  32 * mm], pad=1.55)

        linked = sum(1 for t in rows if t.get("url"))
        link_count += linked
        if linked != len(rows):
            notes.append({"note": "appendix_row_without_link", "channel": r.channel,
                          "rows": len(rows), "linked": linked})

        shown = len(rows)
        cap = (f"all {shown} posts in the week" if shown >= r.posts
               else f"top {shown} of {r.posts} posts by engagement")
        blurb = [f"Week ending Sunday {C_LAB} &mdash; {window_sentence(week_ending, week_tz)}."]
        if not r.has_reach:
            blurb.append("No reach data available from this API.")
        if r.unreported:
            blurb.append(", ".join(r.unreported).capitalize() +
                         " returned no value on every post and are treated as unreported, "
                         "not zero.")
        if r.channel == "x":
            blurb.append(f"Threads are counted once, credited to the head post: "
                         f"{r.ranked_posts} ranked items from {r.posts} posts.")
        blurb.append("Titles link to the original post.")

        slide(Paragraph(f"APPENDIX {letters[n]}", KICK), Spacer(1, 3),
              Paragraph(f"{r.name} &mdash; {cap}", H), Spacer(1, 5),
              Paragraph(" ".join(blurb), SMALL), Spacer(1, 5), tb)

    if story and isinstance(story[-1], PageBreak):
        story.pop()
    slide_count = 1 + sum(1 for f in story if isinstance(f, PageBreak))

    foot = f"Swarajya  |  social performance, week ending Sunday {C_LAB} ({tz_name(week_tz)})"

    def deco(canv, doc):
        canv.saveState()
        canv.setStrokeColor(colors.HexColor(RULE))
        canv.setLineWidth(0.5)
        canv.line(MARGIN, 15 * mm, PAGE[0] - MARGIN, 15 * mm)
        canv.setFont("Helvetica", 7.2)
        canv.setFillColor(colors.HexColor(MUT))
        canv.drawString(MARGIN, 10.5 * mm, foot)
        canv.drawRightString(PAGE[0] - MARGIN, 10.5 * mm, str(doc.page))
        canv.setFillColor(colors.HexColor(INK))
        canv.rect(0, PAGE[1] - 3.2 * mm, PAGE[0], 3.2 * mm, fill=1, stroke=0)
        canv.restoreState()

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=PAGE, leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=15 * mm, bottomMargin=18 * mm,
        title=f"Swarajya - social performance, week ending Sunday {C_LAB}",
        author="Swarajya",
    )
    doc.build(story, onFirstPage=deco, onLaterPages=deco)

    return Deck(pdf=buf.getvalue(), filename=deck_filename(week_ending),
                slide_count=slide_count, link_count=link_count, notes=notes)
