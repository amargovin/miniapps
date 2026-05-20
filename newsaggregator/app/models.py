"""Pydantic models for type clarity at boundaries."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class StoryWeights(BaseModel):
    beat_fit_weight: float
    source_tier_weight: float
    recency_decay_weight: float
    cluster_size_weight: float
    novelty_weight: float
    gap_bonus_weight: float
    recency_half_life_hours: float
    cluster_size_cap: int


class StoryView(BaseModel):
    """Story shape rendered to the dashboard or returned via JSON API."""
    id: int
    canonical_title: str
    brief: str | None
    angle: str | None
    key_facts: list[str]
    beat: str | None
    score: float
    score_breakdown: dict[str, float]
    member_count: int
    sources_covered: list[str]
    first_seen_at: datetime
    last_updated_at: datetime
    status: str
