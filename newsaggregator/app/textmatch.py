"""Shared text-similarity primitives used by clustering and Swarajya matching.

MiniLM cosine alone is too noisy at the headline level for same-event
detection (real cross-source variants land 0.45-0.55). We combine it with
content-token overlap (Jaccard on 4+ char words, stopwords removed). High
cosine auto-matches; mid cosine requires token overlap.
"""
from __future__ import annotations

import re

# Function words, temporal/connective noise, and reporting verbs that
# don't carry news content. Used to compute *content* overlap.
STOPWORDS = {
    "this", "that", "with", "from", "their", "them", "they", "have", "has", "had",
    "been", "were", "will", "would", "could", "should", "more", "most", "than",
    "such", "into", "over", "after", "before", "between", "during", "many",
    "some", "what", "when", "where", "which", "while", "about", "above", "below",
    "amid", "across", "against", "among", "around", "behind", "beside", "beyond",
    "down", "near", "past", "round", "since", "through", "under",
    "until", "upon", "within", "without", "first", "second", "third", "today",
    "yesterday", "tomorrow", "year", "years", "month", "months", "week", "weeks",
    "days", "hour", "hours",
    "says", "said", "asks", "asked", "tells", "told", "calls", "called", "urges",
    "urged", "warns", "warned", "plans", "planned", "moves", "moved",
    "ahead", "live", "watch", "explainer", "updates",
    "list", "full", "check", "know", "things", "back", "again", "still",
    "must",
}


_WORD_RE = re.compile(r"[A-Za-z]{4,}")


def content_tokens(text: str | None) -> set[str]:
    if not text:
        return set()
    return {w.lower() for w in _WORD_RE.findall(text)} - STOPWORDS


def token_overlap(a: str | None, b: str | None) -> float:
    at = content_tokens(a)
    bt = content_tokens(b)
    if not at or not bt:
        return 0.0
    return len(at & bt) / len(at | bt)


def is_same_event(
    cosine: float,
    title_a: str | None,
    title_b: str | None,
    *,
    cosine_auto: float = 0.60,
    cosine_floor: float = 0.40,
    token_floor: float = 0.20,
) -> bool:
    """Hybrid: high cosine auto-matches; mid cosine needs token overlap."""
    if cosine >= cosine_auto:
        return True
    if cosine >= cosine_floor:
        return token_overlap(title_a, title_b) >= token_floor
    return False
