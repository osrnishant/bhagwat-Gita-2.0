from __future__ import annotations

import threading
import time

_lock = threading.Lock()

_stats: dict = {
    "requests_total": 0,
    "cache_hits": 0,
    "errors_total": 0,
    "latency_sum_ms": 0.0,
    "latency_count": 0,
    "started_at": time.time(),
}


def record_request(latency_ms: float, *, error: bool = False) -> None:
    """Called by the HTTP middleware for every /ask or /ask/stream request."""
    with _lock:
        _stats["requests_total"] += 1
        _stats["latency_sum_ms"] += latency_ms
        _stats["latency_count"] += 1
        if error:
            _stats["errors_total"] += 1


def record_cache_hit() -> None:
    """Called by the pipeline when a cached response is returned."""
    with _lock:
        _stats["cache_hits"] += 1


def snapshot() -> dict:
    with _lock:
        total = max(_stats["requests_total"], 1)
        count = max(_stats["latency_count"], 1)
        return {
            "requests_total": _stats["requests_total"],
            "cache_hits": _stats["cache_hits"],
            "cache_hit_rate": round(_stats["cache_hits"] / total, 3),
            "errors_total": _stats["errors_total"],
            "avg_latency_ms": round(_stats["latency_sum_ms"] / count, 1),
            "uptime_seconds": round(time.time() - _stats["started_at"]),
        }
