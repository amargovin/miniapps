"""Structured JSON logs (brief §11) — one line per phase, with the resolved window, page
counts, reconciliation results and cost."""
from __future__ import annotations

import logging
import sys

import structlog

_configured = False


def configure(level: str = "INFO") -> None:
    global _configured
    if _configured:
        return
    logging.basicConfig(format="%(message)s", stream=sys.stdout,
                        level=getattr(logging, level.upper(), logging.INFO))
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, level.upper(), logging.INFO)),
        cache_logger_on_first_use=True,
    )
    _configured = True


def get_logger(name: str = "social_review"):
    configure()
    return structlog.get_logger(name)
