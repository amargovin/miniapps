"""Environment-driven configuration. All knobs come from env / .env (spec §7)."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    quintype_base_url: str = "https://swarajyamag.com"

    anthropic_api_key: str = ""
    llm_model: str = "claude-opus-4-8"

    max_context_stories: int = 8
    request_timeout: float = 45.0
    log_level: str = "INFO"

    # --- auth / clients (spec §8) ---
    # SQLAlchemy URL. Default: local SQLite. Point at Postgres for production:
    #   postgresql+asyncpg://user:pass@host/db   (also `pip install asyncpg`)
    database_url: str = "sqlite+aiosqlite:///./swarajya_mcp.db"
    # Admin API key gating /admin (client + token management). Unset => admin off.
    admin_api_key: str = ""
    # Bearer token gating the machine-to-machine provisioning webhook
    # (POST /provision/groups -> mints a group + access URL). Sent as
    # `Authorization: Bearer <key>`. Unset => the webhook is disabled (503).
    provision_api_key: str = ""
    # Skip client-bearer auth on /api and /mcp (local dev only).
    disable_auth: bool = False
    # Defaults applied to any grant that has no explicit override. The
    # per-minute limit is burst/abuse protection (agentic turns fire several
    # tool calls, so keep it generous); the monthly quota is the real budget
    # cap. A grant can override either; null monthly default = unlimited.
    rate_limit_per_minute_default: int = 20
    monthly_request_quota_default: int | None = 250

    # Public origin used to build per-subscriber URLs in the admin console,
    # e.g. https://mcp.swarajyamag.com  ->  <origin>/s/<token>/mcp
    public_base_url: str = "http://localhost:8000"

    # MCP transport DNS-rebinding protection validates the Host header. That
    # guards localhost dev servers from browser attacks; it does not fit a
    # public, token-authenticated server behind a proxy (it rejects the proxy's
    # Host with 421). Set a comma-separated allowlist to enable host-locking;
    # leave empty to disable the check (default for hosted deployments).
    mcp_allowed_hosts: str = ""
