"""Brief §7 — display titles, and the reason for the 58-character cap."""
import pytest
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth

from app.titles import CAP, THREAD_SUFFIX, display_title


def test_urls_are_stripped():
    assert display_title("Court strikes down the amendment https://t.co/abc123") == \
        "Court strikes down the amendment"


def test_leading_emoji_and_bullets_are_dropped_but_interior_punctuation_is_kept():
    assert display_title("🚨 BREAKING: the court has ruled") == "BREAKING: the court has ruled"
    assert display_title("• Why India needs a policy") == "Why India needs a policy"


def test_first_sentence_wins_when_shorter_than_eleven_words():
    assert display_title("Short verdict. And then a much longer second sentence follows.") \
        == "Short verdict."


def test_eleven_word_cap_applies_when_there_is_no_sentence_break():
    out = display_title("one two three four five six seven eight nine ten eleven twelve")
    assert out == "one two three four five six seven eight nine ten eleven"


def test_cap_trims_on_a_word_boundary_and_appends_an_ellipsis():
    long = ("Parliamentary committee recommends sweeping changes to the procurement "
            "framework")
    out = display_title(long)
    assert len(out) <= CAP
    assert out.endswith("…")
    assert not out.endswith(" …")
    assert out.split("…")[0] in long


def test_thread_suffix_is_appended_for_heads_with_continuations():
    assert display_title("A thread on capital formation", is_thread=True) == \
        "A thread on capital formation" + THREAD_SUFFIX


def test_empty_or_url_only_text_still_yields_a_label():
    assert display_title("https://swarajyamag.com/a") == "(no text)"
    assert display_title("") == "(no text)"


def test_generation_is_deterministic():
    text = "🧵 The case for a new industrial policy, in five charts https://t.co/x"
    assert display_title(text) == display_title(text)


@pytest.mark.parametrize("text", [
    "M" * 80,                                                     # all-caps, widest glyphs
    "WHY THE SUPREME COURT VERDICT ON PROCUREMENT CHANGES EVERYTHING FOR STATES",
    "Parliamentary committee recommends sweeping changes to the procurement framework",
    "Supercalifragilisticexpialidociousandthensomemorewithoutanyspacesatallhere",
    "a " * 60,
])
@pytest.mark.parametrize("is_thread", [False, True])
def test_no_title_can_wrap_the_appendix_column(text, is_thread):
    """The cap exists so a title cannot wrap: a wrapped title creates a second link
    annotation and fails §9 check 5. The X appendix's Post column is the narrower of the
    two, at 104mm with 4.5pt of cell padding either side, set in Helvetica 7.4 — so the
    guarantee has to hold in rendered width, not just character count."""
    out = display_title(text, is_thread=is_thread)
    assert stringWidth(out, "Helvetica", 7.4) <= 104 * mm - 9.0
    if is_thread:
        assert out.endswith(THREAD_SUFFIX)


def test_the_character_cap_is_still_applied():
    out = display_title("Parliamentary committee recommends sweeping changes to the "
                        "procurement framework")
    assert len(out) <= CAP
