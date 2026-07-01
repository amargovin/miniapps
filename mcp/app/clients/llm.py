"""LLM client — Anthropic Claude. Used ONLY by the REST synthesis path.

MCP tools that return raw sources never reach this module.
See the `claude-api` skill before changing model IDs or request shape.
"""

from __future__ import annotations

from pathlib import Path

from anthropic import AsyncAnthropic

from app.config import Settings

_PROMPT_PATH = Path(__file__).resolve().parents[2] / "prompts" / "synthesis_system.txt"


class LLMUnavailable(RuntimeError):
    """Raised when synthesis is requested but no API key is configured."""


class LLMClient:
    def __init__(self, settings: Settings):
        self._model = settings.llm_model
        self._system = _PROMPT_PATH.read_text(encoding="utf-8")
        self._client = (
            AsyncAnthropic(api_key=settings.anthropic_api_key)
            if settings.anthropic_api_key
            else None
        )

    @property
    def enabled(self) -> bool:
        return self._client is not None

    async def synthesize(self, query: str, context: str) -> tuple[str, dict | None]:
        """Return (answer, usage) where usage = {input_tokens, output_tokens}."""
        if self._client is None:
            raise LLMUnavailable("ANTHROPIC_API_KEY is not configured")
        # Opus 4.8: no `thinking`/sampling params (they 400). Plain synthesis.
        msg = await self._client.messages.create(
            model=self._model,
            max_tokens=2000,
            system=self._system,
            messages=[
                {
                    "role": "user",
                    "content": f"Question: {query}\n\nSOURCES:\n{context}",
                }
            ],
        )
        text = "".join(b.text for b in msg.content if b.type == "text").strip()
        usage = {
            "input_tokens": msg.usage.input_tokens,
            "output_tokens": msg.usage.output_tokens,
        }
        return text, usage
