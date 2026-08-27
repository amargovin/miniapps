"""Meta Graph API client — Facebook Page + Instagram Business (brief §4).

Read-only. Two content edges, two profile lookups, and one independently-fetched
aggregate used by the §9 reconciliation check.

Two things here have already cost a completed report its accuracy, so both are load-bearing:

1. **`since`/`until` are Unix timestamps and `until` is EXCLUSIVE.** The MCP connector this
   replaces documented it as inclusive; it is not, and that silently dropped all eight of
   one Sunday's Facebook posts. `until` is the first instant *after* the window.
2. **NULL is not 0.** Meta returns no impressions on these edges, Instagram has no `shares`
   field on the media edge at all, and Facebook `comments` come back 0 under this token
   scope on every post. Those are unreported, not zero, and are stored NULL and rendered
   "n/a" / "unreported".
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone

import httpx
from tenacity import Retrying, retry_if_exception_type, stop_after_delay, wait_exponential_jitter

log = logging.getLogger(__name__)

FB_FIELDS = ("id,message,created_time,permalink_url,likes.summary(true),"
             "comments.summary(true),shares")
IG_FIELDS = "id,caption,media_type,permalink,timestamp,like_count,comments_count"
PAGE_LIMIT = 100


class MetaError(Exception):
    pass


class _Retryable(Exception):
    def __init__(self, message: str, *, retry_after: float | None = None):
        super().__init__(message)
        self.retry_after = retry_after


@dataclass
class MetaPost:
    platform: str                  # 'facebook' | 'instagram'
    post_id: str
    created_at: datetime
    message: str | None
    permalink: str | None
    media_type: str | None         # IG only
    likes: int | None
    comments: int | None
    shares: int | None
    title: str | None = None

    @property
    def engagement(self) -> int:
        return (self.likes or 0) + (self.comments or 0) + (self.shares or 0)


@dataclass
class MetaPull:
    posts: list[MetaPost]
    pages: int
    payloads: list[tuple[str, dict]] = field(default_factory=list)
    notes: list[dict] = field(default_factory=list)


def unix_bounds(start: datetime, end: datetime) -> tuple[int, int]:
    """`since` inclusive, `until` exclusive — `end` is already the first instant after the
    window, so it converts straight across. A post in the window's final second has
    timestamp < until and is therefore included."""
    return int(start.timestamp()), int(end.timestamp())


def _parse_ts(s: str) -> datetime:
    # FB created_time: 2026-08-16T12:08:44+0000 ; IG timestamp: 2026-08-16T12:08:44+0000
    return datetime.strptime(s, "%Y-%m-%dT%H:%M:%S%z").astimezone(timezone.utc)


class MetaClient:
    def __init__(
        self,
        access_token: str,
        *,
        fb_page_id: str,
        ig_user_id: str,
        api_version: str = "v21.0",
        client: httpx.Client | None = None,
        retry_budget_s: float = 300.0,
        retry_max_wait_s: float = 30.0,
    ):
        self._token = access_token
        self.fb_page_id = fb_page_id
        self.ig_user_id = ig_user_id
        self.api_version = api_version
        self._http = client or httpx.Client(timeout=30.0)
        self._retry_budget_s = retry_budget_s
        self._retry_max_wait_s = retry_max_wait_s

    @property
    def base(self) -> str:
        return f"https://graph.facebook.com/{self.api_version}"

    # ---- transport ----

    def _wait(self, retry_state) -> float:
        after = getattr(retry_state.outcome.exception(), "retry_after", None)
        if after is not None:
            return min(float(after), self._retry_max_wait_s)
        return wait_exponential_jitter(initial=2, max=self._retry_max_wait_s, jitter=2)(retry_state)

    def _get(self, url: str, params: dict | None = None) -> dict:
        """`url` may be absolute (a paging.next cursor) or a path relative to the version.

        A cursor URL already carries every parameter it needs, the access token included.
        Passing a `params` dict alongside it would REPLACE its query string rather than
        merge into it, which drops the cursor and re-reads page one — an infinite loop that
        looks like a very slow week.
        """
        if url.startswith("http"):
            target = httpx.URL(url)
            if "access_token" not in target.params:
                target = target.copy_merge_params({"access_token": self._token})
        else:
            q = dict(params or {})
            q.setdefault("access_token", self._token)
            target = httpx.URL(f"{self.base}{url}").copy_merge_params(q)
        try:
            for attempt in Retrying(
                stop=stop_after_delay(self._retry_budget_s),
                wait=self._wait,
                retry=retry_if_exception_type(_Retryable),
                reraise=True,
            ):
                with attempt:
                    r = self._http.get(target)
                    if r.status_code == 429 or r.status_code >= 500:
                        raise _Retryable(f"HTTP {r.status_code}",
                                         retry_after=_retry_after(r.headers))
                    if r.status_code >= 400:
                        raise MetaError(f"Meta Graph {r.status_code}: {_scrub(r.text)}")
                    return r.json()
        except _Retryable as exc:
            raise MetaError(f"Meta Graph {exc}, retries exhausted") from exc
        raise MetaError("unreachable")  # pragma: no cover

    def _paginate(self, path: str, params: dict, source: str) -> tuple[list[dict], list[tuple[str, dict]]]:
        rows: list[dict] = []
        payloads: list[tuple[str, dict]] = []
        url: str | None = path
        page = 0
        seen: set[str] = set()
        while url:
            page += 1
            payload = self._get(url, params if page == 1 else None)
            payloads.append((f"{source}_p{page}", payload))
            for row in payload.get("data") or []:
                if row["id"] in seen:      # cursor overlap; de-duplicate rather than assume
                    continue
                seen.add(row["id"])
                rows.append(row)
            url = ((payload.get("paging") or {}).get("next")) or None
            params = {}
        return rows, payloads

    # ---- content edges ----

    def fetch_facebook(self, start: datetime, end: datetime) -> MetaPull:
        since, until = unix_bounds(start, end)
        rows, payloads = self._paginate(
            f"/{self.fb_page_id}/posts",
            {"fields": FB_FIELDS, "since": since, "until": until, "limit": PAGE_LIMIT},
            "fb_posts",
        )
        posts = [
            MetaPost(
                platform="facebook",
                post_id=r["id"],
                created_at=_parse_ts(r["created_time"]),
                message=r.get("message"),
                permalink=r.get("permalink_url"),
                media_type=None,
                likes=_summary_count(r.get("likes")),
                comments=_summary_count(r.get("comments")),
                shares=_shares_count(r.get("shares")),
            )
            for r in rows
        ]
        return MetaPull(posts=posts, pages=len(payloads), payloads=payloads,
                        notes=_null_unreported("facebook", posts))

    def fetch_instagram(self, start: datetime, end: datetime) -> MetaPull:
        since, until = unix_bounds(start, end)
        rows, payloads = self._paginate(
            f"/{self.ig_user_id}/media",
            {"fields": IG_FIELDS, "since": since, "until": until, "limit": PAGE_LIMIT},
            "ig_media",
        )
        posts = [
            MetaPost(
                platform="instagram",
                post_id=r["id"],
                created_at=_parse_ts(r["timestamp"]),
                message=r.get("caption"),
                permalink=r.get("permalink"),
                media_type=r.get("media_type"),
                likes=_int_or_none(r.get("like_count")),
                comments=_int_or_none(r.get("comments_count")),
                # The media edge has no shares field at all — unreported, not zero.
                shares=None,
            )
            for r in rows
        ]
        return MetaPull(posts=posts, pages=len(payloads), payloads=payloads,
                        notes=_null_unreported("instagram", posts))

    # ---- profile lookups ----

    def fetch_facebook_followers(self) -> int | None:
        data = self._get(f"/{self.fb_page_id}", {"fields": "followers_count"})
        return _int_or_none(data.get("followers_count"))

    def fetch_instagram_followers(self) -> tuple[int | None, int | None]:
        data = self._get(f"/{self.ig_user_id}", {"fields": "followers_count,media_count"})
        return _int_or_none(data.get("followers_count")), _int_or_none(data.get("media_count"))

    # ---- independent aggregate for the §9 reconciliation check ----

    def fetch_aggregate(self, platform: str, start: datetime, end: datetime) -> dict:
        """A second, independent pass over the same window, requesting only the counting
        fields. Summed here and compared against what was stored. Deliberately not
        derived from the first pull's payloads — a check that reuses the pull's own rows
        cannot catch the pull dropping rows, which is exactly the bug it exists for."""
        since, until = unix_bounds(start, end)
        if platform == "facebook":
            rows, _ = self._paginate(
                f"/{self.fb_page_id}/posts",
                {"fields": "id,likes.summary(true),comments.summary(true),shares",
                 "since": since, "until": until, "limit": PAGE_LIMIT},
                "fb_agg",
            )
            return {
                "posts": len(rows),
                "likes": sum(_summary_count(r.get("likes")) or 0 for r in rows),
                "comments": sum(_summary_count(r.get("comments")) or 0 for r in rows),
                "shares": sum(_shares_count(r.get("shares")) or 0 for r in rows),
            }
        if platform == "instagram":
            rows, _ = self._paginate(
                f"/{self.ig_user_id}/media",
                {"fields": "id,like_count,comments_count", "since": since, "until": until,
                 "limit": PAGE_LIMIT},
                "ig_agg",
            )
            return {
                "posts": len(rows),
                "likes": sum(_int_or_none(r.get("like_count")) or 0 for r in rows),
                "comments": sum(_int_or_none(r.get("comments_count")) or 0 for r in rows),
                "shares": 0,
            }
        raise MetaError(f"unknown platform {platform!r}")


# ---- field decoding: absent and unreported both become None, never 0 ----

def _int_or_none(v) -> int | None:
    if v is None or v == "":
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _summary_count(node) -> int | None:
    """likes.summary(true) -> {"data": [...], "summary": {"total_count": N}}"""
    if not isinstance(node, dict):
        return None
    return _int_or_none((node.get("summary") or {}).get("total_count"))


def _shares_count(node) -> int | None:
    """FB `shares` is {"count": N} and is absent entirely when nothing was shared. Absent
    is genuinely zero here (the edge reports the field whenever there is a count), so an
    absent node is 0 rather than None — unlike IG shares, which the edge never reports."""
    if node is None:
        return 0
    if isinstance(node, dict):
        return _int_or_none(node.get("count")) or 0
    return _int_or_none(node)


def _null_unreported(platform: str, posts: list[MetaPost]) -> list[dict]:
    """A field that came back 0 on *every* post in the window is unreported, not zero, and
    §4 requires it stored as NULL. Applied in place; returns the data notes.

    Two fields are known to behave this way — Instagram `shares` (no such field on the
    media edge) and Facebook `comments` under this token scope — but the rule is written
    against the data rather than hardcoded to those two, so a token scope that starts
    returning real numbers stops being mislabelled without a code change.
    """
    notes: list[dict] = []
    if not posts:
        return notes
    for fname in ("likes", "comments", "shares"):
        vals = [getattr(p, fname) for p in posts]
        # A field the edge does not report at all arrives as None; one the token scope
        # returns empty arrives as 0 on every post. Both are unreported.
        if all(v is None or v == 0 for v in vals):
            for p in posts:
                setattr(p, fname, None)
            notes.append({"note": "meta_field_unreported", "platform": platform,
                          "field": fname, "posts": len(posts)})
    return notes


def _retry_after(headers) -> float | None:
    after = headers.get("retry-after")
    if after:
        try:
            return max(1.0, float(after))
        except ValueError:
            return None
    return None


_TOKEN_IN_TEXT = re.compile(r"(access_token=)[^&\s\"']+", re.I)


def _scrub(text: str) -> str:
    """Graph errors sometimes echo the request URL, access_token included, and error text
    reaches both the logs and the run record."""
    return _TOKEN_IN_TEXT.sub(r"\1<redacted>", text[:400])
