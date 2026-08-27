#!/usr/bin/env python3
"""Render the weekly social review deck (16:9 PDF slides).

Layout and arithmetic live here so they are identical every week. All judgment comes from
narrative.json. Use --verify to check a built PDF for pagination and link problems.
"""
import argparse, csv, json, os, sys
from reportlab.lib.pagesizes import inch
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
                                PageBreak, Flowable)
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Polygon

PAGE = (13.333*inch, 7.5*inch)
INK="#14213d"; ACC="#1d4ed8"; MUT="#5b6472"; RULE="#c9cfda"; BAND="#eef1f6"
GOOD="#15803d"; BAD="#b91c1c"
CCOL={"x":"#1d4ed8","instagram":"#c2410c","facebook":"#7c8598"}

ss=getSampleStyleSheet()
def P(n,**k): return ParagraphStyle(n,parent=ss["Normal"],**k)
TITLE=P("TITLE",fontName="Helvetica-Bold",fontSize=30,textColor=colors.HexColor(INK),leading=34)
SUBT =P("SUBT",fontName="Helvetica",fontSize=12.5,textColor=colors.HexColor(MUT),leading=17)
H    =P("H",fontName="Helvetica-Bold",fontSize=19,textColor=colors.HexColor(INK),leading=23)
KICK =P("KICK",fontName="Helvetica-Bold",fontSize=8.4,textColor=colors.HexColor(ACC),leading=11)
LEAD =P("LEAD",fontName="Helvetica",fontSize=11.6,textColor=colors.HexColor(INK),leading=16.5)
BODY =P("BODY",fontName="Helvetica",fontSize=9.6,textColor=colors.HexColor(INK),leading=13.4)
SMALL=P("SMALL",fontName="Helvetica",fontSize=8.3,textColor=colors.HexColor(MUT),leading=11.6)
KPI  =P("KPI",fontName="Helvetica-Bold",fontSize=21,textColor=colors.HexColor(INK),leading=24)
KPIL =P("KPIL",fontName="Helvetica",fontSize=7.4,textColor=colors.HexColor(MUT),leading=9.4)
TH   =P("TH",fontName="Helvetica-Bold",fontSize=7.6,textColor=colors.white,leading=9.6)
TD   =P("TD",fontName="Helvetica",fontSize=8.0,textColor=colors.HexColor(INK),leading=10.2)
TDc  =P("TDc",fontName="Helvetica",fontSize=7.4,textColor=colors.HexColor(INK),leading=9.0)
TLc  =P("TLc",fontName="Helvetica",fontSize=7.4,textColor=colors.HexColor(ACC),leading=9.0)

def fmt(n):
    return f"{n:,}" if isinstance(n,int) else (f"{n:,.1f}" if isinstance(n,float) else str(n))

class Rule_(Flowable):
    def __init__(s,w,c=RULE,t=0.6): s.w,s.c,s.t=w,c,t; Flowable.__init__(s)
    def wrap(s,*a): return (s.w,s.t)
    def draw(s):
        s.canv.setStrokeColor(colors.HexColor(s.c)); s.canv.setLineWidth(s.t)
        s.canv.line(0,0,s.w,0)

def hbars(items,width=250*mm,rowh=15,labw=52*mm,valw=46*mm):
    mx=max([i[1] for i in items]+[0.0001])
    barmax=width-labw-valw
    d=Drawing(width,rowh*len(items))
    for n,(lab,val,disp,col) in enumerate(items):
        y=rowh*(len(items)-n-1)+3
        d.add(String(0,y+1.5,lab,fontName="Helvetica",fontSize=8.6,fillColor=colors.HexColor(INK)))
        w=max(1.2,barmax*val/mx)
        d.add(Rect(labw,y,w,8.4,fillColor=colors.HexColor(col),strokeColor=None))
        d.add(String(labw+w+5,y+1.5,disp,fontName="Helvetica-Bold",fontSize=8.6,
                     fillColor=colors.HexColor(MUT)))
    return d

def sparkpanel(series,width=250*mm,height=52*mm):
    """series: list of (channel_key, label, [(week, value), ...])"""
    d=Drawing(width,height)
    pad_l,pad_b,pad_t=30*mm,10*mm,6*mm
    plotw,ploth=width-pad_l-34*mm,height-pad_b-pad_t
    allv=[v for _,_,pts in series for _,v in pts]
    if not allv: return d
    mx=max(allv) or 1
    weeks=sorted({w for _,_,pts in series for w,_ in pts})
    xs={w:pad_l+(plotw*i/max(1,len(weeks)-1)) for i,w in enumerate(weeks)}
    d.add(Line(pad_l,pad_b,pad_l+plotw,pad_b,strokeColor=colors.HexColor(RULE),strokeWidth=0.6))
    for w in weeks:
        d.add(String(xs[w],pad_b-6,w[5:],fontName="Helvetica",fontSize=6.6,
                     fillColor=colors.HexColor(MUT),textAnchor="middle"))
    for key,label,pts in series:
        col=CCOL.get(key,MUT); pts=sorted(pts)
        prev=None
        for w,v in pts:
            x=xs[w]; y=pad_b+ploth*v/mx
            if prev: d.add(Line(prev[0],prev[1],x,y,strokeColor=colors.HexColor(col),strokeWidth=1.6))
            d.add(Rect(x-1.4,y-1.4,2.8,2.8,fillColor=colors.HexColor(col),strokeColor=None))
            prev=(x,y)
        if pts:
            d.add(String(pad_l+plotw+4,prev[1]-2,f"{label}  {int(pts[-1][1]):,}",
                         fontName="Helvetica-Bold",fontSize=7.4,fillColor=colors.HexColor(col)))
    d.add(String(0,pad_b+ploth-3,f"peak {int(mx):,}",fontName="Helvetica",fontSize=6.8,
                 fillColor=colors.HexColor(MUT)))
    return d

def kpirow(items,w):
    t=Table([[Paragraph(v,KPI) for _,v in items],[Paragraph(k.upper(),KPIL) for k,_ in items]],
            colWidths=[w]*len(items),hAlign="LEFT")
    t.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),colors.HexColor(BAND)),
      ("TOPPADDING",(0,0),(-1,0),9),("BOTTOMPADDING",(0,0),(-1,0),0),
      ("TOPPADDING",(0,1),(-1,1),2),("BOTTOMPADDING",(0,1),(-1,1),9),
      ("LEFTPADDING",(0,0),(-1,-1),10),("LINEAFTER",(0,0),(-2,-1),0.5,colors.white)]))
    return t

def datatable(header,rows,widths,align_from=3,pad=2.6):
    data=[[Paragraph(h,TH) for h in header]]+rows
    t=Table(data,colWidths=widths,repeatRows=1,hAlign="LEFT")
    st=[("BACKGROUND",(0,0),(-1,0),colors.HexColor(INK)),("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ("ALIGN",(align_from,0),(-1,-1),"RIGHT"),("TOPPADDING",(0,0),(-1,-1),pad),
        ("BOTTOMPADDING",(0,0),(-1,-1),pad),("LEFTPADDING",(0,0),(-1,-1),4.5),
        ("RIGHTPADDING",(0,0),(-1,-1),4.5),("LINEBELOW",(0,1),(-1,-1),0.25,colors.HexColor(RULE))]
    for i in range(1,len(rows)+1):
        if i%2==0: st.append(("BACKGROUND",(0,i),(-1,i),colors.HexColor("#f7f9fc")))
    t.setStyle(TableStyle(st)); return t

def panel(title,lines,accent,w=148*mm):
    fl=[Paragraph(title,P("pt",fontName="Helvetica-Bold",fontSize=10.6,
        textColor=colors.HexColor(accent),leading=13.6)),Spacer(1,4)]
    for l in lines:
        fl.append(Paragraph(l,BODY)); fl.append(Spacer(1,5.5))
    t=Table([[fl]],colWidths=[w],hAlign="LEFT")
    t.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),colors.HexColor("#f7f9fc")),
      ("LINEBEFORE",(0,0),(0,0),2.2,colors.HexColor(accent)),
      ("LEFTPADDING",(0,0),(-1,-1),9),("RIGHTPADDING",(0,0),(-1,-1),9),
      ("TOPPADDING",(0,0),(-1,-1),8),("BOTTOMPADDING",(0,0),(-1,-1),3)]))
    return t

def twocol(l,r,lw=148*mm,rw=148*mm,gap=10*mm):
    t=Table([[l,"",r]],colWidths=[lw,gap,rw],hAlign="LEFT")
    t.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"TOP"),
      ("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0),
      ("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0)]))
    return t

def read_history(path):
    if not path or not os.path.exists(path): return []
    with open(path,newline="",encoding="utf-8") as fh:
        return list(csv.DictReader(fh))

FIXED_GAPS=[
 "<b>Meta has no reach.</b> The connector returns likes, comments and shares with no "
 "impressions field, so Instagram and Facebook have no reach figure and no engagement rate. "
 "Those numbers exist in Meta Business Suite but are not exposed here.",
 "<b>X reach is understated.</b> Impressions count views on Swarajya's own posts. Views on "
 "other people's reposts are not attributed, so true audience reached is higher and is not "
 "knowable through the API.",
 "<b>Follower totals overlap.</b> The audiences are not additive; an unknown share of people "
 "follow more than one channel.",
]

def build(summary,narr,history,out):
    win=summary["window"]; chans=summary["channels"]; comb=summary["combined"]
    conc=summary.get("concentration") or {}
    top=summary.get("top",{})
    need=["headline","glance_note","working","not_working","actions"]
    miss=[k for k in need if k not in narr]
    if miss: raise SystemExit(f"ERROR: narrative.json missing required key(s): {miss}")

    S=[]
    def slide(*fl): S.extend(list(fl)); S.append(PageBreak())

    # 1 title
    slide(Spacer(1,44*mm),Paragraph("SOCIAL PERFORMANCE REVIEW",KICK),Spacer(1,5),
      Paragraph("What is working across<br/>"+" , ".join(
          c["name"].split("/")[0].strip() for c in chans),TITLE),Spacer(1,9),
      Rule_(150*mm,INK,1.4),Spacer(1,9),
      Paragraph(f"Swarajya &middot; {win['label']} &middot; {comb['posts']:,} posts across "
                f"{len(chans)} channel(s)<br/>Engagement = likes + shares/reposts + "
                "comments/replies (+ quotes and bookmarks on X)",SUBT))

    # 2 glance
    rows=[]
    for c in chans:
        rows.append([Paragraph(f"<b>{c['name']}</b>",TD),
            Paragraph(fmt(c["followers"]),TD),Paragraph(fmt(c["posts"]),TD),
            Paragraph(f"<b>{fmt(c['engagement'])}</b>",TD),Paragraph(fmt(c["per_post"]),TD),
            Paragraph(fmt(c["per_1k"]) if c["per_1k"] is not None else "&mdash;",TD),
            Paragraph(fmt(c["impressions"]) if c["has_reach"] else
                      "<font color='#b91c1c'>n/a</font>",TD)])
    lead=max(chans,key=lambda c:c["engagement"]) if chans else None
    k=[("Posts",fmt(comb["posts"])),("Total engagement",fmt(comb["engagement"]))]
    if lead: k.append((f"{lead['name'].split('/')[0].strip()} share of eng.",
                       f"{lead['share_engagement']}%"))
    if comb["impressions"]: k.append(("Reach measured",fmt(comb["impressions"])))
    k.append(("Channels",str(len(chans))))
    slide(Paragraph("THE WEEK AT A GLANCE",KICK),Spacer(1,3),
      Paragraph(narr["headline"],H),Spacer(1,7),kpirow(k,56*mm),Spacer(1,8),
      datatable(["Channel","Followers","Posts","Engagement","Per post","Per 1k followers","Reach"],
                rows,[80*mm,36*mm,26*mm,38*mm,32*mm,42*mm,32*mm],align_from=1),
      Spacer(1,7),Paragraph(narr["glance_note"],LEAD))

    # 3 mismatch
    fol=[(c["name"].split("/")[0].strip(),c["share_followers"],f"{c['share_followers']}%",
          CCOL.get(c["key"],MUT)) for c in chans]
    eng=[(c["name"].split("/")[0].strip(),c["share_engagement"],f"{c['share_engagement']}%",
          CCOL.get(c["key"],MUT)) for c in chans]
    p1k=[(c["name"].split("/")[0].strip(),c["per_1k"] or 0,fmt(c["per_1k"]) if c["per_1k"] is not None else "n/a",
          CCOL.get(c["key"],MUT)) for c in chans]
    slide(Paragraph("THE MISMATCH",KICK),Spacer(1,3),
      Paragraph("Where the audience sits vs where the engagement happens",H),Spacer(1,9),
      Paragraph("<b>Share of followers</b>",BODY),Spacer(1,4),
      hbars(sorted(fol,key=lambda t:-t[1])),Spacer(1,10),
      Paragraph("<b>Share of engagement</b>",BODY),Spacer(1,4),
      hbars(sorted(eng,key=lambda t:-t[1])),Spacer(1,10),
      Paragraph("<b>Engagement per 1,000 followers</b>",BODY),Spacer(1,4),
      hbars(sorted(p1k,key=lambda t:-t[1])),Spacer(1,8),
      Paragraph("Read the third chart as return on audience: engagement earned per thousand "
                "people already following the channel.",SMALL))

    # 4 trend (only with 2+ weeks)
    weeks=sorted({r["week_ending"] for r in history}) if history else []
    if len(weeks)>=2:
        series=[]
        for c in chans:
            pts=[(r["week_ending"],float(r["engagement"] or 0)) for r in history
                 if r["channel"]==c["key"] and r["engagement"] not in ("",None)]
            if pts: series.append((c["key"],c["name"].split("/")[0].strip(),pts))
        drows=[]
        for c in chans:
            hs=[r for r in history if r["channel"]==c["key"]]
            hs.sort(key=lambda r:r["week_ending"])
            prev=hs[-2] if len(hs)>=2 else None
            def d(cur,key):
                if not prev or not prev.get(key): return "&mdash;"
                try: p0=float(prev[key])
                except ValueError: return "&mdash;"
                if not p0: return "&mdash;"
                v=100.0*(cur-p0)/p0
                col=GOOD if v>=0 else BAD
                return f"<font color='{col}'>{v:+.1f}%</font>"
            drows.append([Paragraph(f"<b>{c['name']}</b>",TD),
                Paragraph(fmt(c["engagement"]),TD),Paragraph(d(c["engagement"],"engagement"),TD),
                Paragraph(fmt(c["posts"]),TD),Paragraph(d(c["posts"],"posts"),TD),
                Paragraph(fmt(c["per_post"]),TD),
                Paragraph(d(float(c["per_post"]),"engagement_per_post"),TD)])
        slide(Paragraph("TREND",KICK),Spacer(1,3),
          Paragraph(f"Engagement by channel over {len(weeks)} weeks",H),Spacer(1,8),
          sparkpanel(series),Spacer(1,7),
          datatable(["Channel","Engagement","vs prev","Posts","vs prev","Per post","vs prev"],
                    drows,[74*mm,34*mm,28*mm,26*mm,28*mm,30*mm,28*mm],align_from=1),
          Spacer(1,6),
          Paragraph("Where posting volume moved sharply, per-post engagement is the honest "
                    "comparison rather than the total.",SMALL))

    # 5 working / 6 not working
    def panels(items,accent):
        ps=[panel(i["title"],i["points"],accent) for i in items[:2]]
        return twocol(ps[0],ps[1]) if len(ps)==2 else ps[0]
    slide(Paragraph("WHAT IS WORKING",KICK),Spacer(1,3),
      Paragraph(narr.get("working_headline","What the data supports keeping"),H),Spacer(1,8),
      panels(narr["working"],GOOD),Spacer(1,7),
      Paragraph(narr.get("working_implication",""),LEAD))
    slide(Paragraph("WHAT IS NOT WORKING",KICK),Spacer(1,3),
      Paragraph(narr.get("not_working_headline","Where the effort is not returning"),H),Spacer(1,8),
      panels(narr["not_working"],BAD),Spacer(1,7),
      Paragraph(narr.get("not_working_implication",""),LEAD))

    # 7 cross channel
    cc=narr.get("cross_channel")
    if cc and cc.get("rows"):
        rr=[]
        for r in cc["rows"]:
            cells=[Paragraph(f"<b>{r[0]}</b>",TD)]
            for v in r[1:]:
                v=str(v)
                cells.append(Paragraph(f"<font color='{BAD}'>{v}</font>" if "not posted" in v.lower()
                                       else v,TD))
            rr.append(cells)
        hdr=["Story"]+[c["name"].split("/")[0].strip() for c in chans]
        widths=[120*mm]+[(160*mm/max(1,len(chans)))]*len(chans)
        slide(Paragraph("THE SAME STORY, ACROSS CHANNELS",KICK),Spacer(1,3),
          Paragraph("Distribution, not demand, decides the outcome",H),Spacer(1,8),
          datatable(hdr,rr,widths,align_from=1),Spacer(1,9),
          Paragraph(cc.get("lead",""),LEAD),Spacer(1,6),
          Paragraph(cc.get("note",""),SMALL))

    # 8 behaviour
    xc=next((c for c in chans if c["key"]=="x"),None)
    if xc:
        bars=[(n,v,f"{fmt(v)}   {100.0*v/xc['engagement']:.1f}%",
               BAD if n in ("Replies","Quotes","Comments") else CCOL["x"])
              for n,v in xc["breakdown"]]
        bh=narr.get("behaviour",{})
        fl=[Paragraph("AUDIENCE BEHAVIOUR",KICK),Spacer(1,3),
            Paragraph(bh.get("headline","How the engagement breaks down"),H),Spacer(1,8),
            Paragraph(f"<b>X engagement by type</b> ({fmt(xc['engagement'])} total)",BODY),
            Spacer(1,4),hbars(bars),Spacer(1,9)]
        if bh.get("left") and bh.get("right"):
            fl.append(twocol(panel(bh["left"]["title"],bh["left"]["points"],BAD),
                             panel(bh["right"]["title"],bh["right"]["points"],GOOD)))
        slide(*fl)

    # 9 gaps
    gaps=list(FIXED_GAPS)
    sus=[]
    for c in chans:
        for z in c.get("suspect_zero") or []:
            sus.append(f"{c['name'].split('/')[0].strip()} {z}")
    if sus:
        gaps.insert(1,"<b>Suspicious zeros.</b> "+", ".join(sus)+
                    " returned 0 across every post. Treat as unreported rather than true "
                    "zeros and verify against the page.")
    gaps+= [g for g in narr.get("extra_gaps",[])]
    gaps.append(f"<b>Window.</b> {win['label']}. One week is a direction of travel, not a "
                "trend. Impressions keep accruing after publication, so the final day or two "
                "of any window is measured less generously than the first.")
    slide(Paragraph("WHAT WE CANNOT SEE",KICK),Spacer(1,3),
      Paragraph("Read these caveats before circulating the numbers",H),Spacer(1,9),
      panel("Gaps and cautions",gaps,MUT,w=296*mm),Spacer(1,7),
      Paragraph("All totals were reconciled against each API's own aggregate counts before use.",SMALL))

    # 10 actions
    slide(Paragraph("WHERE TO ACT",KICK),Spacer(1,3),
      Paragraph(narr.get("actions_headline","What the data supports changing"),H),Spacer(1,8),
      panels(narr["actions"],ACC),Spacer(1,7),
      Paragraph(narr.get("closing",""),LEAD))

    # appendices
    letters="ABCDEFG"
    for n,c in enumerate(chans):
        rows=top.get(c["key"]) or []
        if not rows: continue
        if c["key"]=="x":
            body=[[Paragraph(str(r["rank"]),TDc),Paragraph(r["date"][5:],TDc),
                   Paragraph(f'<link href="{r["url"]}">{r["title"]}</link>',TLc),
                   Paragraph(fmt(r["likes"]),TDc),Paragraph(fmt(r["reposts"]),TDc),
                   Paragraph(fmt(r["replies"]),TDc),Paragraph(fmt(r["quotes"]),TDc),
                   Paragraph(fmt(r["bookmarks"]),TDc),
                   Paragraph(f"<b>{fmt(r['engagement'])}</b>",TDc),
                   Paragraph(fmt(r["impressions"]),TDc)] for r in rows]
            tb=datatable(["#","Date","Post","Likes","Reposts","Repl.","Quo.","Bkmk",
                          "Engagement","Impressions"],body,
                         [8*mm,14*mm,104*mm,20*mm,22*mm,16*mm,16*mm,20*mm,28*mm,28*mm],pad=1.55)
        else:
            body=[[Paragraph(str(r["rank"]),TDc),Paragraph(r["date"][5:],TDc),
                   Paragraph(f'<link href="{r["url"]}">{r["title"]}</link>' if r["url"]
                             else r["title"],TLc if r["url"] else TDc),
                   Paragraph(fmt(r["likes"]),TDc),Paragraph(fmt(r["comments"]),TDc),
                   Paragraph(fmt(r["shares"]),TDc),
                   Paragraph(f"<b>{fmt(r['engagement'])}</b>",TDc)] for r in rows]
            tb=datatable(["#","Date","Post","Likes","Comments","Shares","Engagement"],body,
                         [8*mm,14*mm,150*mm,26*mm,30*mm,26*mm,32*mm],pad=1.55)
        shown=len(rows); total=c["posts"]
        cap=(f"all {shown} posts in window" if shown>=total
             else f"top {shown} of {total} posts")
        notes=[]
        if not c["has_reach"]: notes.append("No reach data available from this connector.")
        if c.get("suspect_zero"):
            notes.append(", ".join(c["suspect_zero"]).capitalize()+
                         " returned 0 on every post and are treated as unreported.")
        notes.append("Titles link to the original post.")
        slide(Paragraph(f"APPENDIX {letters[n]}",KICK),Spacer(1,3),
          Paragraph(f"{c['name']} &mdash; {cap}",H),Spacer(1,5),
          Paragraph(" ".join(notes),SMALL),Spacer(1,5),tb)

    if S and isinstance(S[-1],PageBreak): S.pop()
    slides=1+sum(1 for f in S if isinstance(f,PageBreak))

    def deco(canv,doc):
        canv.saveState()
        canv.setStrokeColor(colors.HexColor(RULE)); canv.setLineWidth(0.5)
        canv.line(20*mm,15*mm,PAGE[0]-20*mm,15*mm)
        canv.setFont("Helvetica",7.2); canv.setFillColor(colors.HexColor(MUT))
        canv.drawString(20*mm,10.5*mm,f"Swarajya  |  social performance, {win['label']}")
        if doc.page>1: canv.drawRightString(PAGE[0]-20*mm,10.5*mm,str(doc.page))
        canv.setFillColor(colors.HexColor(INK))
        canv.rect(0,PAGE[1]-3.2*mm,PAGE[0],3.2*mm,fill=1,stroke=0)
        canv.restoreState()

    os.makedirs(os.path.dirname(os.path.abspath(out)),exist_ok=True)
    doc=SimpleDocTemplate(out,pagesize=PAGE,leftMargin=20*mm,rightMargin=20*mm,
        topMargin=15*mm,bottomMargin=18*mm,
        title=f"Swarajya - Social Performance Review, {win['label']}",author="Swarajya")
    doc.build(S,onFirstPage=deco,onLaterPages=deco)
    nlinks=sum(len(v) for v in top.values() if v)
    return slides,nlinks

def verify(path,slides=None,links=None):
    from pypdf import PdfReader
    r=PdfReader(path)
    pages=len(r.pages)
    got=sum(len(p.get("/Annots",[]) or []) for p in r.pages)
    ok=True
    print(f"pages: {pages}")
    if slides is not None:
        if pages!=slides:
            print(f"  FAIL expected {slides} slides; a table has spilled onto a "
                  f"continuation page. Reduce rows or padding."); ok=False
        else: print(f"  OK one page per slide ({slides})")
    print(f"links: {got}")
    if links is not None:
        if got!=links:
            print(f"  FAIL expected {links} post links"); ok=False
        else: print("  OK link count matches appendix rows")
    return ok

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--summary"); ap.add_argument("--narrative")
    ap.add_argument("--history"); ap.add_argument("--out")
    ap.add_argument("--verify",metavar="PDF")
    a=ap.parse_args()
    if a.verify:
        sys.exit(0 if verify(a.verify) else 1)
    for f in ("summary","narrative","out"):
        if not getattr(a,f): ap.error(f"--{f} is required unless using --verify")
    summary=json.load(open(a.summary,encoding="utf-8"))
    narr=json.load(open(a.narrative,encoding="utf-8"))
    slides,links=build(summary,narr,read_history(a.history),a.out)
    print(f"built {a.out}")
    sys.exit(0 if verify(a.out,slides,links) else 1)

if __name__=="__main__":
    main()
