"""Read-side SQL queries used by the web/api layers."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

import numpy as np

from app import db
from app.enrich.embed import unpack
from app.sources import Source, by_id, load_sources
from app.textmatch import is_same_event

ALL_BEATS = ("national", "politics", "economy", "tech", "infra", "other")
BEAT_LABELS = {
    "national": "National",
    "politics": "Politics",
    "economy": "Economy",
    "tech": "Tech / Policy",
    "infra": "Infra / Rail",
    "other": "Other",
}
SINCE_PRESETS = {"24h": 24, "48h": 48}
DEFAULT_SINCE = "24h"


def _hours_for(since: str) -> int:
    return SINCE_PRESETS.get(since, SINCE_PRESETS[DEFAULT_SINCE])


def _age_class_and_label(last_updated: datetime | None, now: datetime) -> tuple[str | None, str]:
    """Tier the story age for visual cue. Latest = vivid red, oldest = muted grey."""
    if last_updated is None:
        return None, ""
    if last_updated.tzinfo is None:
        last_updated = last_updated.replace(tzinfo=timezone.utc)
    minutes = max(0.0, (now - last_updated).total_seconds() / 60.0)
    if minutes < 60:
        return "age-fresh", f"{int(minutes)}m"
    hours = minutes / 60.0
    if hours < 4:
        return "age-recent", f"{int(hours)}h"
    if hours < 12:
        return "age-mid", f"{int(hours)}h"
    if hours < 24:
        return "age-stale", f"{int(hours)}h"
    days = hours / 24.0
    return "age-old", f"{int(days)}d"


def _row_to_story(row, srcmap: dict[str, Source]) -> dict[str, Any]:
    sources_covered = json.loads(row["sources_covered"] or "[]")
    breakdown = json.loads(row["score_breakdown"] or "{}")
    key_facts = json.loads(row["key_facts"]) if row["key_facts"] else []
    best_tier = min(
        (srcmap[s].tier for s in sources_covered if s in srcmap),
        default=3,
    )
    last_updated = row["last_updated_at"]
    first_seen = row["first_seen_at"]
    if isinstance(last_updated, str):
        last_updated = datetime.fromisoformat(last_updated)
    if isinstance(first_seen, str):
        first_seen = datetime.fromisoformat(first_seen)
    age_class, age_label = _age_class_and_label(last_updated, datetime.now(timezone.utc))
    return {
        "id": row["id"],
        "canonical_title": row["canonical_title"],
        "brief": row["brief"],
        "angle": row["angle"],
        "key_facts": key_facts,
        "beat": row["beat"] or "other",
        "score": row["score"],
        "score_breakdown": breakdown,
        "member_count": row["member_count"],
        "sources_covered": sources_covered,
        "source_names": [
            srcmap[s].name if s in srcmap else s for s in sources_covered
        ],
        "best_tier": best_tier,
        "first_seen_at": first_seen,
        "last_updated_at": last_updated,
        "age_class": age_class,
        "age_label": age_label,
        "status": row["status"],
        "swarajya_covered": bool(row["swarajya_covered"]) if "swarajya_covered" in row.keys() else False,
        "swarajya_match_url": row["swarajya_match_url"] if "swarajya_match_url" in row.keys() else None,
        "swarajya_match_title": row["swarajya_match_title"] if "swarajya_match_title" in row.keys() else None,
        "swarajya_match_similarity": row["swarajya_match_similarity"] if "swarajya_match_similarity" in row.keys() else None,
        "editorial_pass": row["editorial_pass"] if "editorial_pass" in row.keys() else None,
        "editorial_reason": row["editorial_reason"] if "editorial_reason" in row.keys() else None,
        "editorial_significance": row["editorial_significance"] if "editorial_significance" in row.keys() else None,
        "cms_pushed_at": row["cms_pushed_at"] if "cms_pushed_at" in row.keys() else None,
        "auto_pushed_at": row["auto_pushed_at"] if "auto_pushed_at" in row.keys() else None,
    }


def list_top_stories(
    *,
    beat: str | None = None,
    since: str = DEFAULT_SINCE,
    search: str | None = None,
    limit: int = 100,
    include_editorially_excluded: bool = False,
) -> list[dict[str, Any]]:
    hours = _hours_for(since)
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    where = ["last_updated_at > ?"]
    args: list[Any] = [cutoff]
    if beat and beat != "all":
        where.append("beat = ?")
        args.append(beat)
    if search:
        where.append("(canonical_title LIKE ? OR brief LIKE ?)")
        args.extend([f"%{search}%", f"%{search}%"])
    if not include_editorially_excluded:
        # NULL means "not yet checked" — show those (fails open).
        # 0 means "checked and excluded by AI" — hide.
        where.append("(editorial_pass IS NULL OR editorial_pass = 1)")
    # Ranking: AI-judged significance is the primary sort; within a tier,
    # most-recently-updated stories come first. The math score column is
    # vestigial (kept in DB but no longer used).
    sql = (
        "SELECT * FROM stories WHERE "
        + " AND ".join(where)
        + " ORDER BY COALESCE(editorial_significance, 0) DESC,"
        + " last_updated_at DESC LIMIT ?"
    )
    args.append(limit)

    srcmap = by_id(load_sources())
    with db.connect() as conn:
        rows = conn.execute(sql, args).fetchall()
    return [_row_to_story(r, srcmap) for r in rows]


def get_story(story_id: int) -> dict[str, Any] | None:
    srcmap = by_id(load_sources())
    with db.connect() as conn:
        row = conn.execute("SELECT * FROM stories WHERE id = ?", (story_id,)).fetchone()
        if not row:
            return None
        members = conn.execute(
            """
            SELECT id, source_id, title, url, canonical_url, body, author,
                   published_at, fetched_at
            FROM raw_items
            WHERE story_id = ?
            ORDER BY (published_at IS NULL), published_at DESC, fetched_at DESC
            """,
            (story_id,),
        ).fetchall()
    story = _row_to_story(row, srcmap)
    story["members"] = [
        {
            "id": m["id"],
            "source_id": m["source_id"],
            "source_name": srcmap[m["source_id"]].name
            if m["source_id"] in srcmap
            else m["source_id"],
            "source_tier": srcmap[m["source_id"]].tier
            if m["source_id"] in srcmap
            else 3,
            "title": m["title"],
            "url": m["url"],
            "canonical_url": m["canonical_url"],
            "body": m["body"],
            "author": m["author"],
            "published_at": m["published_at"],
            "fetched_at": m["fetched_at"],
        }
        for m in members
    ]
    # Pre-compute the "primary link" — highest-tier source's canonical_url.
    if story["members"]:
        story["primary_link"] = sorted(
            story["members"], key=lambda m: (m["source_tier"], -1)
        )[0]["url"]
    else:
        story["primary_link"] = None
    return story


def list_top_with_primary_link(
    *,
    beat: str | None = None,
    since: str = DEFAULT_SINCE,
    search: str | None = None,
    limit: int = 100,
    include_editorially_excluded: bool = False,
) -> list[dict[str, Any]]:
    """list_top_stories enriched with primary_link + source_chips per story.

    One extra query per page (not per story).
    """
    stories = list_top_stories(
        beat=beat, since=since, search=search, limit=limit,
        include_editorially_excluded=include_editorially_excluded,
    )
    if not stories:
        return stories
    ids = [s["id"] for s in stories]
    placeholders = ",".join("?" * len(ids))
    srcmap = by_id(load_sources())
    with db.connect() as conn:
        rows = conn.execute(
            f"""
            SELECT story_id, source_id, url
            FROM raw_items
            WHERE story_id IN ({placeholders})
            """,
            ids,
        ).fetchall()
    by_story: dict[int, list[dict]] = {sid: [] for sid in ids}
    for r in rows:
        sid = r["story_id"]
        src = srcmap.get(r["source_id"])
        by_story.setdefault(sid, []).append({
            "source_id": r["source_id"],
            "source_name": src.name if src else r["source_id"],
            "source_tier": src.tier if src else 3,
            "url": r["url"],
        })
    for s in stories:
        chips = sorted(by_story.get(s["id"], []), key=lambda c: c["source_tier"])
        s["source_chips"] = chips
        s["primary_link"] = chips[0]["url"] if chips else None
    return stories


def list_by_beat(
    *,
    since: str = DEFAULT_SINCE,
    search: str | None = None,
    limit_per_beat: int = 25,
    include_editorially_excluded: bool = False,
) -> list[dict]:
    """Return [{beat, label, stories: [...]}] for each beat that has stories.

    Beats are ordered by the canonical ALL_BEATS sequence, with empty beats
    omitted. Stories within a beat are score-DESC, capped at limit_per_beat.

    Cross-beat dedup: when clustering fails to merge variants of the same
    event that span beats (e.g. a fuel-price story tagged both national
    and economy), the duplicate is dropped from the lower-priority section
    so the editor doesn't see the same news twice.
    """
    sections: list[dict] = []
    for beat in ALL_BEATS:
        stories = list_top_with_primary_link(
            beat=beat,
            since=since,
            search=search,
            limit=limit_per_beat,
            include_editorially_excluded=include_editorially_excluded,
        )
        if stories:
            sections.append({
                "beat": beat,
                "label": BEAT_LABELS.get(beat, beat.capitalize()),
                "stories": stories,
            })
    return _prune_cross_section_duplicates(sections)


def _prune_cross_section_duplicates(sections: list[dict]) -> list[dict]:
    """Remove near-duplicate stories across beat sections.

    Walks all visible stories in significance-DESC order; for each one,
    checks if it's the same event as an already-kept story (via the same
    hybrid cosine + token-overlap primitive used for Swarajya matching).
    Higher-significance wins. The dropped story keeps its DB row — only
    its display in *this* render is suppressed.
    """
    if len(sections) < 2:
        return sections

    ids: list[int] = []
    for sec in sections:
        ids.extend(s["id"] for s in sec["stories"])
    if not ids:
        return sections

    placeholders = ",".join("?" * len(ids))
    with db.connect() as conn:
        rows = conn.execute(
            f"SELECT id, centroid FROM stories WHERE id IN ({placeholders})",
            ids,
        ).fetchall()
    centroids = {r["id"]: unpack(r["centroid"]) for r in rows if r["centroid"]}

    flat: list[tuple[int, float, int, dict]] = []
    for sec_idx, sec in enumerate(sections):
        for story in sec["stories"]:
            sig = story.get("editorial_significance") or 0
            recency_tie = story.get("last_updated_at")
            ts = recency_tie.timestamp() if hasattr(recency_tie, "timestamp") else 0.0
            flat.append((-sig, -ts, sec_idx, story))
    # Sort only on the leading sortable fields — dict isn't orderable, so
    # never let tuple comparison fall through to it.
    flat.sort(key=lambda t: (t[0], t[1], t[2]))

    kept_centroids: list[tuple[np.ndarray, str]] = []   # (centroid, title)
    drop_ids: set[tuple[int, int]] = set()
    for _, _, sec_idx, story in flat:
        cent = centroids.get(story["id"])
        if cent is None:
            continue
        is_dup = False
        for k_cent, k_title in kept_centroids:
            cos = float(np.dot(cent, k_cent))
            if is_same_event(cos, story["canonical_title"], k_title):
                is_dup = True
                break
        if is_dup:
            drop_ids.add((sec_idx, story["id"]))
        else:
            kept_centroids.append((cent, story["canonical_title"]))

    out: list[dict] = []
    for sec_idx, sec in enumerate(sections):
        kept = [s for s in sec["stories"] if (sec_idx, s["id"]) not in drop_ids]
        if kept:
            out.append({**sec, "stories": kept})
    return out


def last_refresh_at() -> datetime | None:
    """Most recent successful fetch timestamp, sourced from the DB.

    In-memory `jobs.last_fetch_at` resets when the container restarts; this
    survives because raw_items live on the persistent volume.
    """
    with db.connect() as conn:
        row = conn.execute("SELECT MAX(fetched_at) AS ts FROM raw_items").fetchone()
    raw = row["ts"] if row else None
    if not raw:
        return None
    if isinstance(raw, str):
        try:
            raw = datetime.fromisoformat(raw)
        except ValueError:
            return None
    if raw.tzinfo is None:
        raw = raw.replace(tzinfo=timezone.utc)
    return raw


def humanize_age(dt: datetime | None, now: datetime | None = None) -> str:
    """'just now' / '5m ago' / '2h ago' / '3d ago' — short relative time."""
    if dt is None:
        return "never"
    now = now or datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    seconds = max(0, int((now - dt).total_seconds()))
    if seconds < 60:
        return "just now"
    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes}m ago"
    hours = minutes // 60
    if hours < 48:
        return f"{hours}h ago"
    days = hours // 24
    return f"{days}d ago"


def beat_distribution(since: str = DEFAULT_SINCE) -> dict[str, int]:
    hours = _hours_for(since)
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    with db.connect() as conn:
        rows = conn.execute(
            "SELECT beat, COUNT(*) c FROM stories WHERE last_updated_at > ? GROUP BY beat",
            (cutoff,),
        ).fetchall()
    return {r["beat"] or "other": r["c"] for r in rows}


def source_health() -> list[dict[str, Any]]:
    srcmap = by_id(load_sources())
    with db.connect() as conn:
        rows = conn.execute(
            "SELECT * FROM source_state ORDER BY source_id"
        ).fetchall()
    state_map = {r["source_id"]: dict(r) for r in rows}
    out = []
    for sid, src in srcmap.items():
        st = state_map.get(sid)
        out.append({
            "id": sid,
            "name": src.name,
            "tier": src.tier,
            "last_fetched_at": st["last_fetched_at"] if st else None,
            "last_ok_at": st["last_ok_at"] if st else None,
            "last_error": st["last_error"] if st else None,
            "consecutive_failures": st["consecutive_failures"] if st else 0,
        })
    return out
