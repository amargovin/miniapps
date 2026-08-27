"""Display titles (brief §7).

The appendix needs a scannable 6-10 word label per post, not the post text. Generated
deterministically so the same post always produces the same title, and stored on the row.

The 58-character cap is not cosmetic: in the PDF a title that wraps to a second line
creates a second link annotation, which breaks the link-count check in §9.

A character count alone cannot deliver that guarantee, though — Helvetica is proportional,
and 58 capital letters are half again as wide as 58 lowercase ones, enough to wrap the
narrower appendix column on its own. So the cap is applied as specified and then the
rendered width is checked too, against the X appendix's Post column, which is the narrower
of the two layouts. tests/test_titles.py asserts both.
"""
from __future__ import annotations

import re
import unicodedata

from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth

CAP = 58
MAX_WORDS = 11
THREAD_SUFFIX = " (thread)"

# app/render.py sets the X appendix's Post column to 104mm with 4.5pt of padding either
# side, in Helvetica 7.4. Two points of slack absorbs any rounding in the table layout.
COLUMN_FONT = "Helvetica"
COLUMN_SIZE = 7.4
COLUMN_WIDTH_PT = 104 * mm - 9.0 - 2.0

_URL = re.compile(r"(?:https?://|www\.)\S+", re.I)
_SENTENCE_END = re.compile(r"(?<=[.!?])(?:\s|$)")
_BULLETS = "•·▪▶►–—-*>»→⇒|:"


def _strip_leading_glyphs(s: str) -> str:
    """Drop leading emoji, symbols and bullet glyphs — not interior ones, which are
    often meaningful punctuation inside a headline."""
    i = 0
    while i < len(s):
        ch = s[i]
        if ch.isspace() or ch in _BULLETS:
            i += 1
            continue
        # So = other symbol (most emoji), Sk = modifier symbol, Cf = format (ZWJ, VS16)
        if unicodedata.category(ch) in ("So", "Sk", "Cf"):
            i += 1
            continue
        break
    return s[i:]


def display_title(text: str, *, is_thread: bool = False) -> str:
    """`is_thread`: the post is a head with at least one continuation."""
    s = _URL.sub(" ", text or "")
    s = _strip_leading_glyphs(s)
    s = " ".join(s.split())
    if not s:
        return "(no text)" + (THREAD_SUFFIX if is_thread else "")

    first_sentence = _SENTENCE_END.split(s, maxsplit=1)[0].strip()
    first_words = " ".join(s.split()[:MAX_WORDS])
    s = first_sentence if len(first_sentence) <= len(first_words) else first_words

    if len(s) > CAP:
        s = _trim(s, CAP)

    suffix = THREAD_SUFFIX if is_thread else ""
    return _fit(s, suffix) + suffix


def _trim(s: str, cap: int) -> str:
    cut = s[: cap - 1]
    if " " in cut:
        cut = cut[: cut.rindex(" ")]
    return cut.rstrip(" ,;:-") + "…"


def _width(s: str) -> float:
    return stringWidth(s, COLUMN_FONT, COLUMN_SIZE)


def _fit(s: str, suffix: str) -> str:
    """Drop trailing words until the title plus its suffix renders inside one line of the
    appendix column."""
    budget = COLUMN_WIDTH_PT - _width(suffix)
    if _width(s) <= budget:
        return s
    words = s.rstrip("…").split()
    while len(words) > 1:
        words.pop()
        candidate = " ".join(words).rstrip(" ,;:-") + "…"
        if _width(candidate) <= budget:
            return candidate
    # A single word wider than the column: cut it mid-word rather than let it wrap.
    only = words[0] if words else s
    while len(only) > 1 and _width(only + "…") > budget:
        only = only[:-1]
    return only + "…"
