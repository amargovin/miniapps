"""Environment-driven configuration. Read once at startup."""
from __future__ import annotations

import os
from pathlib import Path


def _required(key: str) -> str:
    val = os.environ.get(key)
    if not val:
        raise RuntimeError(f"Missing required env var: {key}")
    return val


def _float(key: str, default: float) -> float:
    raw = os.environ.get(key)
    return float(raw) if raw else default


def _int(key: str, default: int) -> int:
    raw = os.environ.get(key)
    return int(raw) if raw else default


REPO_ROOT = Path(__file__).resolve().parent.parent

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
DASHBOARD_PASSWORD = os.environ.get("DASHBOARD_PASSWORD", "")
SESSION_SECRET = os.environ.get("SESSION_SECRET", "")

CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", "claude-haiku-4-5-20251001")
DATABASE_PATH = os.environ.get("DATABASE_PATH", str(REPO_ROOT / "data" / "app.db"))
EMBEDDING_MODEL = os.environ.get(
    "EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
)
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()

FETCH_TIMEOUT_SECONDS = _int("FETCH_TIMEOUT_SECONDS", 20)
ENRICH_LOOKBACK_HOURS = _int("ENRICH_LOOKBACK_HOURS", 72)
DEDUP_SIMILARITY_THRESHOLD = _float("DEDUP_SIMILARITY_THRESHOLD", 0.95)
CLUSTER_SIMILARITY_THRESHOLD = _float("CLUSTER_SIMILARITY_THRESHOLD", 0.80)
TOP_N_FOR_BRIEFS = _int("TOP_N_FOR_BRIEFS", 100)

USER_AGENT_CONTACT = os.environ.get("USER_AGENT_CONTACT", "amar@swarajyamag.com")
USER_AGENT = f"news-suggestor/0.1 (contact: {USER_AGENT_CONTACT})"

# GrokNews CMS integration. Both must be set on the runtime env (Railway)
# for the To CMS / Publish buttons to work.
GROKNEWS_API_BASE = os.environ.get("GROKNEWS_API_BASE", "")
ARTICLE_API_KEY = os.environ.get("ARTICLE_API_KEY", "")

SOURCES_YAML = REPO_ROOT / "app" / "sources.yaml"
SCHEMA_SQL = REPO_ROOT / "schema.sql"


def assert_runtime_ready() -> None:
    """Validate env vars that are mandatory at runtime (not import-time).

    ANTHROPIC_API_KEY is intentionally not required here — it's only needed
    once brief generation (step 7) is wired in. The app boots and serves
    raw-titled cards without it.
    """
    for key in ("DASHBOARD_PASSWORD", "SESSION_SECRET"):
        if not os.environ.get(key):
            raise RuntimeError(f"Missing required env var: {key}")
