"""X (Twitter) API v2 client for @SwarajyaMag (brief §4, §10).

Read-only. Three endpoints and no others:

  GET /2/users/{id}/tweets                       the week's posts, $0.001/post (Owned Read)
  GET /2/users/{id}?user.fields=public_metrics   follower count, $0.010 for one user resource
  GET /2/usage/credits, GET /2/usage/tweets      consumption tracking

`GET /2/users/{id}/followers` is an Owned Read at $0.001 *per follower* — $342 a run on
342,772 followers, against $0.010 for the public_metrics lookup that answers the same
question. `_request` refuses to build that path at all so the mistake cannot be made by
editing a URL; tests/test_x_client.py asserts it.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Iterable

import httpx
from tenacity import Retrying, retry_if_exception_type, stop_after_delay, wait_exponential_jitter

log = logging.getLogger(__name__)

BASE = "https://api.x.com/2"
# Not in the X docs; matches the naming of the account's MCP connector. 404s under
# app-only auth — see fetch_credit_balance.
BALANCE_PATH = "/usage/credits"
POST_READ_USD = 0.001   # Owned Read rate; $0.005 if the app is not owned by the account
USER_READ_USD = 0.010
PAGE_SIZE = 100

# in_reply_to_user_id is not in the brief's field list but the thread rule in §4 is stated
# in terms of it, and fields do not affect cost — reads are billed per resource returned.
TWEET_FIELDS = "id,text,created_at,public_metrics,referenced_tweets,in_reply_to_user_id"

_METRIC_KEYS = {
    "likes": "like_count",
    "reposts": "retweet_count",
    "replies": "reply_count",
    "quotes": "quote_count",
    "bookmarks": "bookmark_count",
    "impressions": "impression_count",
}


class XError(Exception):
    """Non-retryable failure, or a retry budget exhausted."""


class XCreditsDepleted(XError):
    """HTTP 402. The run completes for Meta and marks X unavailable — never a zero,
    never last week's number carried forward (§4)."""


class XTooManyPosts(XError):
    """X_MAX_POSTS_PER_RUN tripped: abort rather than paginate indefinitely (§10)."""


class _Retryable(Exception):
    def __init__(self, message: str, *, status: int, retry_after: float | None = None):
        super().__init__(message)
        self.status = status
        self.retry_after = retry_after


@dataclass
class XPost:
    post_id: str
    created_at: datetime
    text: str
    likes: int
    reposts: int
    replies: int
    quotes: int
    bookmarks: int
    impressions: int
    is_head: bool
    thread_root: str | None = None
    replied_to: str | None = None       # parent id when this is a self-thread continuation
    title: str | None = None

    @property
    def engagement(self) -> int:
        return self.likes + self.reposts + self.replies + self.quotes + self.bookmarks


@dataclass
class XTimeline:
    posts: list[XPost]
    pages: int
    payloads: list[tuple[str, dict]] = field(default_factory=list)
    notes: list[dict] = field(default_factory=list)
    posts_returned: int = 0             # billed resources, before de-duplication


def rfc3339(ts: datetime) -> str:
    """X wants UTC instants; the window is kept in aware local time internally."""
    return ts.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _parse_ts(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


class XClient:
    def __init__(
        self,
        bearer_token: str,
        user_id: str,
        *,
        max_posts_per_run: int = 1500,
        client: httpx.Client | None = None,
        retry_budget_s: float = 1800.0,   # §4: back off and retry for up to 30 minutes
        retry_max_wait_s: float = 60.0,
    ):
        self._token = bearer_token
        self.user_id = user_id
        self.max_posts_per_run = max_posts_per_run
        self._http = client or httpx.Client(timeout=30.0)
        self._retry_budget_s = retry_budget_s
        self._retry_max_wait_s = retry_max_wait_s
        self.user_reads = 0
        self.posts_returned = 0
        self._balance_unavailable = False

    # ---- transport ----

    def _wait(self, retry_state) -> float:
        exc = retry_state.outcome.exception()
        after = getattr(exc, "retry_after", None)
        if after is not None:
            return min(float(after), self._retry_max_wait_s)
        return wait_exponential_jitter(initial=2, max=self._retry_max_wait_s, jitter=2)(retry_state)

    def _request(self, path: str, params: dict | None = None) -> dict:
        if "/followers" in path:
            # $0.001 per follower — see the module docstring. Not a lint rule: a hard stop.
            raise XError(
                "refusing to call a /followers endpoint: it is an Owned Read billed per "
                "follower. Use GET /2/users/{id}?user.fields=public_metrics instead."
            )
        url = f"{BASE}{path}"
        headers = {"Authorization": f"Bearer {self._token}"}

        try:
            for attempt in Retrying(
                stop=stop_after_delay(self._retry_budget_s),
                wait=self._wait,
                retry=retry_if_exception_type(_Retryable),
                reraise=True,
            ):
                with attempt:
                    r = self._http.get(url, params=params, headers=headers)
                    if r.status_code == 402:
                        raise _Retryable("credits depleted", status=402)
                    if r.status_code == 429 or r.status_code >= 500:
                        raise _Retryable(
                            f"HTTP {r.status_code}", status=r.status_code,
                            retry_after=_rate_limit_wait(r.headers),
                        )
                    if r.status_code >= 400:
                        raise XError(f"X API {r.status_code} on {path}: {r.text[:400]}")
                    return r.json()
        except _Retryable as exc:
            # The retry budget is spent. A depleted balance is its own failure mode: the
            # run continues for Meta and marks X unavailable (§4).
            if exc.status == 402:
                raise XCreditsDepleted(
                    f"X credits depleted and still depleted after "
                    f"{self._retry_budget_s:.0f}s of retries"
                ) from exc
            raise XError(f"X API {exc} on {path}, retries exhausted") from exc
        raise XError("unreachable")  # pragma: no cover

    # ---- endpoints ----

    def fetch_followers(self) -> int:
        payload = self._request(f"/users/{self.user_id}", {"user.fields": "public_metrics"})
        self.user_reads += 1
        return int(payload["data"]["public_metrics"]["followers_count"])

    def fetch_credit_balance(self) -> float | None:
        """data.total_balance in USD, or None when it cannot be read.

        Measured 2026-08-28 against production: this path returns **404 with an app-only
        bearer token**. The same figure is readable through the account's user-authenticated
        MCP connector, which is consistent with the endpoint requiring OAuth 2.0 user
        context rather than app-only auth — X answers 404, not 403, for the wrong auth
        context. No documented REST path for it exists in the X docs.

        So this stays best-effort and a failure is never fatal: the balance-delta signal in
        §10 (the earliest warning that Owned Read pricing has stopped applying) has to come
        from the Developer Console or the MCP connector until a working path is found. The
        first 404 is remembered so a run makes one futile request rather than two.
        """
        if self._balance_unavailable:
            return None
        try:
            payload = self._request(BALANCE_PATH)
        except XCreditsDepleted:
            raise
        except XError as exc:
            log.warning("credit balance unavailable, not retrying this run: %s", exc)
            self._balance_unavailable = True
            return None
        data = payload.get("data") or {}
        bal = data.get("total_balance")
        return float(bal) if bal is not None else None

    def fetch_usage(self) -> dict:
        """GET /2/usage/tweets — daily post-consumption counts against the plan cap."""
        try:
            return self._request("/usage/tweets", {"days": "7"}).get("data") or {}
        except XCreditsDepleted:
            raise
        except XError as exc:
            log.warning("usage unavailable: %s", exc)
            return {}

    def fetch_timeline(self, start: datetime, end: datetime) -> XTimeline:
        """Every post in [start, end) — retweets and replies-to-others excluded by the API,
        self-thread continuations are not (they arrive as ordinary posts) and are marked
        is_head=false here."""
        params = {
            "exclude": "retweets,replies",
            "max_results": str(PAGE_SIZE),
            "start_time": rfc3339(start),
            "end_time": rfc3339(end),
            "tweet.fields": TWEET_FIELDS,
            "expansions": "referenced_tweets.id",
        }
        raw: dict[str, dict] = {}
        payloads: list[tuple[str, dict]] = []
        notes: list[dict] = []
        page = 0
        returned = 0
        prev_oldest: str | None = None
        token: str | None = None

        while True:
            page += 1
            q = dict(params)
            if token:
                q["pagination_token"] = token
            payload = self._request(f"/users/{self.user_id}/tweets", q)
            payloads.append((f"x_timeline_p{page}", payload))

            data = payload.get("data") or []
            meta = payload.get("meta") or {}

            # §9 check 1 — abort the run on a mismatch, do not repair it silently.
            declared = meta.get("result_count")
            if declared is not None and len(data) != declared:
                raise XError(
                    f"X pagination: page {page} returned {len(data)} rows against "
                    f"meta.result_count={declared}"
                )
            returned += len(data)

            # Pages are normally adjacent; verify rather than assume, and de-duplicate
            # by post id either way.
            if prev_oldest and meta.get("newest_id") and \
                    _idcmp(meta["newest_id"], prev_oldest) >= 0:
                notes.append({
                    "note": "x_page_overlap",
                    "page": page,
                    "newest_id": meta["newest_id"],
                    "prev_oldest_id": prev_oldest,
                })
            prev_oldest = meta.get("oldest_id") or prev_oldest

            for row in data:
                raw[row["id"]] = row

            if len(raw) > self.max_posts_per_run:
                raise XTooManyPosts(
                    f"{len(raw)} posts exceeds X_MAX_POSTS_PER_RUN="
                    f"{self.max_posts_per_run}; aborting rather than crawling on"
                )

            token = meta.get("next_token")
            if not token:
                break

        self.posts_returned += returned
        posts = self._build_posts(raw, notes)
        return XTimeline(posts=posts, pages=page, payloads=payloads, notes=notes,
                         posts_returned=returned)

    # ---- thread reconstruction (§4) ----

    def _build_posts(self, raw: dict[str, dict], notes: list[dict]) -> list[XPost]:
        parent: dict[str, str] = {}
        for pid, row in raw.items():
            if str(row.get("in_reply_to_user_id") or "") != str(self.user_id):
                continue
            for ref in row.get("referenced_tweets") or []:
                if ref.get("type") == "replied_to":
                    parent[pid] = ref["id"]
                    break

        posts: list[XPost] = []
        for pid, row in raw.items():
            m = row.get("public_metrics") or {}
            posts.append(XPost(
                post_id=pid,
                created_at=_parse_ts(row["created_at"]),
                text=row.get("text") or "",
                is_head=pid not in parent,
                replied_to=parent.get(pid),
                thread_root=_root(pid, parent),
                **{k: int(m.get(src) or 0) for k, src in _METRIC_KEYS.items()},
            ))

        # A thread head can be deleted while its continuations survive: their engagement
        # belongs in the totals but they can never be ranked. A data note, not a failure.
        orphans = sorted({p.thread_root for p in posts
                          if not p.is_head and p.thread_root and p.thread_root not in raw})
        for root in orphans:
            n = sum(1 for p in posts if p.thread_root == root)
            notes.append({"note": "x_thread_head_missing", "thread_root": root,
                          "continuations": n})

        posts.sort(key=lambda p: p.created_at)
        return posts

    # ---- cost (§10) ----

    def estimated_cost_usd(self) -> float:
        return round(self.posts_returned * POST_READ_USD + self.user_reads * USER_READ_USD, 4)

    @staticmethod
    def project_cost_usd(posts: int, user_reads: int = 1) -> float:
        return round(posts * POST_READ_USD + user_reads * USER_READ_USD, 4)


def _root(pid: str, parent: dict[str, str]) -> str:
    """Walk replied_to links back to the outermost ancestor. Returns the head's id, which
    may be a post outside the window or one that has since been deleted."""
    seen = {pid}
    cur = pid
    while cur in parent:
        nxt = parent[cur]
        if nxt in seen:          # cycles cannot happen on X, but do not hang if they do
            break
        seen.add(nxt)
        cur = nxt
    return cur


def _idcmp(a: str, b: str) -> int:
    """Snowflake ids are decimal strings, so compare by length then lexically — bigger id
    means newer post."""
    if len(a) != len(b):
        return 1 if len(a) > len(b) else -1
    return (a > b) - (a < b)


def _rate_limit_wait(headers) -> float | None:
    """Honour x-rate-limit-reset (epoch seconds) or Retry-After (seconds) when present."""
    reset = headers.get("x-rate-limit-reset")
    if reset:
        try:
            return max(1.0, float(reset) - datetime.now(timezone.utc).timestamp())
        except ValueError:
            pass
    after = headers.get("retry-after")
    if after:
        try:
            return max(1.0, float(after))
        except ValueError:
            pass
    return None


def heads_with_continuations(posts: Iterable[XPost]) -> set[str]:
    """Head ids that have at least one continuation in the window — drives the
    ' (thread)' title suffix (§7)."""
    return {p.thread_root for p in posts if not p.is_head and p.thread_root}


def as_dicts(posts: Iterable[XPost]) -> list[dict[str, Any]]:
    return [dict(p.__dict__) for p in posts]
