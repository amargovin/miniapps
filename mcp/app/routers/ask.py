"""REST adapter — the Swarajya website's surface.

Unlike the MCP tools, this path synthesizes server-side (the website has no
model of its own) and returns a finished, cited answer.
"""

from __future__ import annotations

import httpx
from fastapi import APIRouter, HTTPException

from app.context import record_usage
from app.runtime import get_orchestrator
from app.schemas import AskRequest, AskResponse

router = APIRouter()


@router.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@router.post("/api/v1/ask", response_model=AskResponse)
async def ask(req: AskRequest) -> AskResponse:
    orch = get_orchestrator()
    if not orch.llm_enabled:
        raise HTTPException(
            status_code=503,
            detail="Synthesis unavailable: ANTHROPIC_API_KEY not configured.",
        )
    try:
        sources = await orch.retrieve(req.query, limit=req.limit)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Quintype error: {exc}") from exc
    synthesis, usage = await orch.synthesize(req.query, sources)
    record_usage(
        endpoint="/api/v1/ask",
        sources=len(sources),
        input_tokens=(usage or {}).get("input_tokens"),
        output_tokens=(usage or {}).get("output_tokens"),
    )
    return AskResponse(synthesis=synthesis, sources=sources)
