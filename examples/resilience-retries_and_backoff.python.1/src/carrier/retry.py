import logging
import random
import time
from dataclasses import dataclass
from typing import Callable, Optional, TypeVar

import requests

log = logging.getLogger(__name__)

T = TypeVar("T")

RETRYABLE_STATUS = frozenset({429, 502, 503, 504})


class RetryExhausted(Exception):
    def __init__(self, attempts: int, last: Exception):
        super().__init__(f"gave up after {attempts} attempts: {last}")
        self.attempts = attempts
        self.last = last


@dataclass(frozen=True)
class RetryPolicy:
    max_attempts: int = 5
    base_delay: float = 0.5
    max_delay: float = 8.0
    total_budget: float = 20.0


def _retry_after(resp: Optional[requests.Response]) -> Optional[float]:
    if resp is None:
        return None
    value = resp.headers.get("Retry-After")
    if value is None:
        return None
    try:
        return max(0.0, float(value))
    except ValueError:
        return None


def retry_call(fn: Callable[[], T], policy: RetryPolicy) -> T:
    deadline = time.monotonic() + policy.total_budget
    attempt = 0
    while True:
        attempt += 1
        try:
            return fn()
        except requests.HTTPError as exc:
            resp = exc.response
            if resp is None or resp.status_code not in RETRYABLE_STATUS:
                raise
            hint = _retry_after(resp)
            err: Exception = exc
        except (requests.ConnectionError, requests.Timeout) as exc:
            hint = None
            err = exc

        if attempt >= policy.max_attempts:
            raise RetryExhausted(attempt, err)

        ceiling = min(policy.max_delay, policy.base_delay * (2 ** (attempt - 1)))
        delay = random.uniform(0, ceiling)
        if hint is not None:
            delay = max(delay, min(hint, policy.max_delay))

        if time.monotonic() + delay > deadline:
            raise RetryExhausted(attempt, err)

        log.warning("attempt %d failed (%s); retrying in %.2fs", attempt, err, delay)
        time.sleep(delay)
