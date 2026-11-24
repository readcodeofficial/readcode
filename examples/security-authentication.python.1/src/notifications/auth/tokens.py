from __future__ import annotations

from dataclasses import dataclass

import jwt

ISSUER = "https://id.pingwire.example"
AUDIENCE = "notifications-api"
ALLOWED_ALGORITHMS = ["RS256"]
CLOCK_LEEWAY_SECONDS = 10


class AuthError(Exception):
    """Raised for any credential problem. The message is for logs, never for clients."""


@dataclass(frozen=True)
class Principal:
    subject: str
    tenant_id: str
    scopes: frozenset[str]


class TokenVerifier:
    def __init__(self, public_keys: dict[str, str]) -> None:
        # key id -> PEM public key, loaded from our own configuration
        self._public_keys = dict(public_keys)

    def verify(self, token: str) -> Principal:
        try:
            header = jwt.get_unverified_header(token)
        except jwt.InvalidTokenError as exc:
            raise AuthError("malformed token header") from exc

        key = self._public_keys.get(header.get("kid", ""))
        if key is None:
            raise AuthError("unknown signing key id")

        try:
            claims = jwt.decode(
                token,
                key,
                algorithms=ALLOWED_ALGORITHMS,
                audience=AUDIENCE,
                issuer=ISSUER,
                leeway=CLOCK_LEEWAY_SECONDS,
                options={"require": ["exp", "iat", "sub", "iss", "aud"]},
            )
        except jwt.ExpiredSignatureError as exc:
            raise AuthError("token expired") from exc
        except jwt.InvalidTokenError as exc:
            raise AuthError(f"token rejected: {type(exc).__name__}") from exc

        if claims.get("token_use") != "access":
            raise AuthError("not an access token")

        tenant_id = claims.get("tenant")
        if not isinstance(tenant_id, str) or not tenant_id:
            raise AuthError("missing tenant claim")

        scopes = frozenset(str(claims.get("scope", "")).split())
        return Principal(subject=claims["sub"], tenant_id=tenant_id, scopes=scopes)
