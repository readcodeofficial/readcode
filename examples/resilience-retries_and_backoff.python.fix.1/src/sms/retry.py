import random
import time

from sms.errors import GatewayError, RateLimited, TransientError


def backoff_ceiling(attempt: int, base_delay: float, max_delay: float) -> float:
    return min(max_delay, base_delay * (2 ** attempt))


def call_with_retry(
    fn,
    *,
    attempts: int = 4,
    base_delay: float = 0.5,
    max_delay: float = 8.0,
    sleep=time.sleep,
    rng: random.Random | None = None,
    retry_on=GatewayError,
):
    rng = rng or random.Random()
    for attempt in range(attempts):
        try:
            return fn()
        except retry_on as exc:
            if attempt == attempts - 1:
                raise
            delay = rng.uniform(0, backoff_ceiling(attempt, base_delay, max_delay))
            if isinstance(exc, RateLimited):
                delay = max(delay, exc.retry_after)
            sleep(delay)
