from app.fetchers.base import canonicalize_url, content_hash


def test_strips_utm_params():
    out = canonicalize_url("https://Example.com/path?utm_source=x&id=42#anchor")
    assert out == "https://example.com/path?id=42"


def test_strips_fbclid_gclid():
    out = canonicalize_url("https://example.com/?fbclid=abc&gclid=def&q=ok")
    assert out == "https://example.com/?q=ok"


def test_lowercases_host_only():
    out = canonicalize_url("HTTPS://EXAMPLE.com/Mixed/Path?Q=A")
    assert out == "https://example.com/Mixed/Path?Q=A"


def test_preserves_port():
    out = canonicalize_url("http://example.com:8080/path?utm_source=x")
    assert out == "http://example.com:8080/path"


def test_drops_fragment():
    out = canonicalize_url("https://example.com/a#section")
    assert out == "https://example.com/a"


def test_handles_empty():
    assert canonicalize_url("") == ""


def test_content_hash_normalizes_whitespace():
    a = content_hash("Hello   World", "Body  text")
    b = content_hash("hello world", "body text")
    assert a == b


def test_content_hash_changes_with_body():
    a = content_hash("Title", "Body A")
    b = content_hash("Title", "Body B")
    assert a != b


def test_content_hash_handles_none_body():
    a = content_hash("Title", None)
    b = content_hash("Title", "")
    assert a == b
