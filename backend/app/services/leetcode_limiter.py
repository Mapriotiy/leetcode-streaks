import asyncio
import time
from collections.abc import Awaitable, Callable
from typing import TypeVar

from fastapi import HTTPException

T = TypeVar("T")

LEETCODE_CONCURRENCY = 16
LEETCODE_RPS = 8
LEETCODE_BACKOFF_SECONDS = 180

_semaphore = asyncio.Semaphore(LEETCODE_CONCURRENCY)
_rate_lock = asyncio.Lock()
_last_request_at = 0.0
_backoff_until = 0.0


class LeetCodeRateLimited(Exception):
    def __init__(self, retry_after_seconds: int):
        super().__init__("LeetCode sync is temporarily rate limited")
        self.retry_after_seconds = retry_after_seconds


def _retry_after_seconds() -> int:
    remaining = _backoff_until - time.monotonic()
    return max(1, int(remaining))


def _raise_if_backing_off() -> None:
    if time.monotonic() < _backoff_until:
        raise LeetCodeRateLimited(_retry_after_seconds())


def _activate_backoff(seconds: int = LEETCODE_BACKOFF_SECONDS) -> None:
    global _backoff_until
    _backoff_until = max(_backoff_until, time.monotonic() + seconds)


async def _wait_for_rate_slot() -> None:
    global _last_request_at
    min_interval = 1 / LEETCODE_RPS

    async with _rate_lock:
        elapsed = time.monotonic() - _last_request_at
        if elapsed < min_interval:
            await asyncio.sleep(min_interval - elapsed)
        _last_request_at = time.monotonic()


async def run_limited(call: Callable[[], Awaitable[T]]) -> T:
    _raise_if_backing_off()

    async with _semaphore:
        _raise_if_backing_off()
        await _wait_for_rate_slot()

        try:
            return await call()
        except HTTPException as exc:
            if exc.status_code in {403, 429}:
                _activate_backoff()
                raise LeetCodeRateLimited(LEETCODE_BACKOFF_SECONDS) from exc
            raise
