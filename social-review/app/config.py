"""Central settings. Every env var the service uses is declared here — see RAILWAY_BRIEF.md §4.

Required vars have no default; the app fails at boot if they are missing, and /readyz
asserts their presence (presence only — never call a vendor API from a health check).
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    env: str = "production"  # "dev" enables /docs and /openapi.json

    database_url: str

    # HTTP API (§2.1)
    api_token: str  # >= 32 random bytes; compared with secrets.compare_digest

    # Reporting week (§3) — a decision, not a default; kept in config so it is visible/testable
    week_tz: str = "Asia/Kolkata"

    # X API v2 (§4) — token MUST come from the developer app owned by @SwarajyaMag
    # itself, or Owned Reads pricing ($0.001/post) silently becomes $0.005/post (§10).
    x_bearer_token: str
    x_user_id: str = "2451476942"  # constant; never look it up per run
    x_max_posts_per_run: int = 1500
    x_balance_alert_usd: float = 20.0

    # Meta Graph API (§4)
    meta_access_token: str
    fb_page_id: str = "670321879700525"
    ig_user_id: str = "17841400214702908"
    meta_api_version: str = "v21.0"

    # Email (§4)
    resend_api_key: str
    mail_to: str = "amar@swarajyamag.com"
    mail_from: str


def get_settings() -> Settings:
    return Settings()
