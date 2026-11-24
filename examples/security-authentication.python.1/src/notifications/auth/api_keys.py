from __future__ import annotations

import hashlib
import hmac
import time
from dataclasses import dataclass

from .tokens import AuthError


@dataclass(frozen=True)
class ApiKeyRecord:
    key_id: str
    secret_sha256: str
    tenant_id: str
    revoked: bool
    expires_at: float | None


_DUMMY_DIGEST = hashlib.sha256(b"no-such-key").hexdigest()


class ApiKeyAuthenticator:
    """Keys look like pk_<key_id>_<secret>; only the SHA-256 of the secret is stored."""

    def __init__(self, records: dict[str, ApiKeyRecord]) -> None:
        self._records = records

    def authenticate(self, presented: str, now: float | None = None) -> ApiKeyRecord:
        now = time.time() if now is None else now
        parts = presented.split("_", 2)
        if len(parts) != 3 or parts[0] != "pk":
            raise AuthError("malformed api key")
        _, key_id, secret = parts

        record = self._records.get(key_id)
        expected = record.secret_sha256 if record else _DUMMY_DIGEST
        actual = hashlib.sha256(secret.encode("utf-8")).hexdigest()
        digest_matches = hmac.compare_digest(actual, expected)

        if record is None or not digest_matches:
            raise AuthError("api key rejected")
        if record.revoked:
            raise AuthError("api key revoked")
        if record.expires_at is not None and record.expires_at <= now:
            raise AuthError("api key expired")
        return record


def verify_callback_signature(secret: bytes, body: bytes, header: str, now: float,
                              tolerance_seconds: int = 300) -> bool:
    """Checks a delivery-receipt callback signed as 't=<unix>,v1=<hex hmac of "t.body">'."""
    try:
        fields = dict(item.split("=", 1) for item in header.split(","))
        timestamp = int(fields["t"])
        provided = fields["v1"]
    except (KeyError, ValueError):
        return False

    if abs(now - timestamp) > tolerance_seconds:
        return False

    signed = f"{timestamp}.".encode("utf-8") + body
    expected = hmac.new(secret, signed, hashlib.sha256).hexdigest()
    return hmac.compare_digest(provided.encode("utf-8"), expected.encode("utf-8"))
