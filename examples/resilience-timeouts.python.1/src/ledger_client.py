import logging
import time
from dataclasses import dataclass

import httpx

log = logging.getLogger("ledger.client")


class LedgerUnavailable(Exception):
    pass


class DeadlineExceeded(LedgerUnavailable):
    pass


@dataclass(frozen=True)
class LedgerSettings:
    base_url: str
    connect_timeout: float = 1.0
    read_timeout: float = 4.0
    write_timeout: float = 4.0
    pool_timeout: float = 0.5
    max_attempts: int = 3
    backoff_seconds: float = 0.25


class LedgerClient:
    def __init__(self, settings: LedgerSettings, transport: httpx.BaseTransport | None = None):
        self._settings = settings
        self._client = httpx.Client(
            base_url=settings.base_url,
            timeout=httpx.Timeout(
                connect=settings.connect_timeout,
                read=settings.read_timeout,
                write=settings.write_timeout,
                pool=settings.pool_timeout,
            ),
            limits=httpx.Limits(max_connections=40, max_keepalive_connections=10),
            transport=transport,
        )

    def close(self) -> None:
        self._client.close()

    def get_balance(self, account_id: str, deadline: float) -> dict:
        return self._request("GET", f"/v2/accounts/{account_id}/balance", deadline)

    def post_transfer(self, transfer_id: str, source: str, destination: str,
                      amount_minor: int, currency: str, deadline: float) -> dict:
        body = {
            "source": source,
            "destination": destination,
            "amount_minor": amount_minor,
            "currency": currency,
        }
        return self._request(
            "POST", "/v2/transfers", deadline,
            json=body, headers={"Idempotency-Key": transfer_id},
        )

    def _request(self, method: str, path: str, deadline: float, **kwargs) -> dict:
        s = self._settings
        remaining = deadline - time.monotonic()
        last_error: Exception | None = None
        for attempt in range(1, s.max_attempts + 1):
            if remaining <= 0:
                raise DeadlineExceeded(f"{method} {path}: budget spent before attempt {attempt}")
            attempt_timeout = min(s.read_timeout, remaining)
            try:
                resp = self._client.request(method, path, timeout=attempt_timeout, **kwargs)
                if resp.status_code >= 500:
                    raise httpx.HTTPStatusError(
                        "server error", request=resp.request, response=resp
                    )
                resp.raise_for_status()
                return resp.json()
            except (httpx.TransportError, httpx.HTTPStatusError) as exc:
                if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code < 500:
                    raise
                last_error = exc
                log.warning("ledger %s %s attempt %d failed: %r", method, path, attempt, exc)
                if attempt < s.max_attempts:
                    time.sleep(s.backoff_seconds * attempt)
        raise LedgerUnavailable(f"{method} {path} failed after {s.max_attempts} attempts") from last_error
