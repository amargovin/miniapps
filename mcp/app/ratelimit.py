"""Per-client fixed-window rate limiter (requests per minute).

In-process and single-instance. For a horizontally-scaled deployment, back this
with Redis (shared counter) — the interface stays the same.
"""

from __future__ import annotations

import time


class RateLimiter:
    def __init__(self) -> None:
        # client_id -> [window_minute, count]
        self._windows: dict[str, list[int]] = {}

    def allow(self, key: str, limit: int) -> bool:
        minute = int(time.time() // 60)
        window = self._windows.get(key)
        if window is None or window[0] != minute:
            self._windows[key] = [minute, 1]
            return True
        if window[1] >= limit:
            return False
        window[1] += 1
        return True
