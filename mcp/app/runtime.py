"""Process-wide singletons, shared by both transport adapters.

The MCP tools (stateless HTTP) and the REST router both resolve the same
orchestrator from here, so there is one Quintype client / connection pool.
"""

from __future__ import annotations

from functools import lru_cache

from app.clients.indiabuild import IndiaBuildClient
from app.clients.llm import LLMClient
from app.clients.quintype import QuintypeClient
from app.config import Settings
from app.services.orchestrator import Orchestrator


@lru_cache
def get_settings() -> Settings:
    return Settings()


@lru_cache
def get_indiabuild() -> IndiaBuildClient:
    return IndiaBuildClient(get_settings())


@lru_cache
def get_orchestrator() -> Orchestrator:
    settings = get_settings()
    return Orchestrator(QuintypeClient(settings), LLMClient(settings), settings)
