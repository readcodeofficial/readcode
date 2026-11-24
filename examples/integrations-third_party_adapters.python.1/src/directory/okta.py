from __future__ import annotations

import logging
import time
from typing import Any, Iterator

import requests

from .ports import (
    DirectoryProvider,
    DirectoryUnavailable,
    DirectoryUser,
    UserStatus,
)

log = logging.getLogger(__name__)

_STATUS_MAP = {
    "ACTIVE": UserStatus.ACTIVE,
    "PROVISIONED": UserStatus.ACTIVE,
    "SUSPENDED": UserStatus.SUSPENDED,
    "DEPROVISIONED": UserStatus.DEPROVISIONED,
}


class OktaDirectory(DirectoryProvider):
    def __init__(self, base_url: str, client_id: str, client_secret: str,
                 session: requests.Session | None = None, page_size: int = 200):
        self._base = base_url.rstrip("/")
        self._client_id = client_id
        self._client_secret = client_secret
        self._session = session or requests.Session()
        self._page_size = page_size
        self._token: str | None = None
        self._token_expires_at = 0.0

    def iter_users(self) -> Iterator[DirectoryUser]:
        url: str | None = f"{self._base}/api/v1/users"
        params: dict[str, Any] | None = {"limit": self._page_size}
        while url:
            resp = self._request("GET", url, params=params)
            for raw in resp.json():
                yield self._to_domain(raw)
            url = resp.links.get("next", {}).get("url")
            params = None

    def get_user(self, external_id: str) -> DirectoryUser | None:
        resp = self._request("GET", f"{self._base}/api/v1/users/{external_id}", allow_404=True)
        if resp.status_code == 404:
            return None
        return self._to_domain(resp.json())

    def _to_domain(self, raw: dict[str, Any]) -> DirectoryUser:
        profile = raw["profile"]
        return DirectoryUser(
            external_id=raw["id"],
            email=profile["email"].lower(),
            display_name=f"{profile.get('firstName', '')} {profile.get('lastName', '')}".strip(),
            status=_STATUS_MAP.get(raw.get("status", ""), UserStatus.ACTIVE),
            groups=tuple(sorted(raw.get("_embedded", {}).get("groups", []))),
        )

    def _request(self, method: str, url: str, *, params=None, allow_404: bool = False,
                 attempts: int = 3) -> requests.Response:
        for attempt in range(1, attempts + 1):
            try:
                resp = self._session.request(
                    method, url, params=params, timeout=(3.05, 10),
                    headers={"Authorization": f"Bearer {self._access_token()}"},
                )
            except requests.RequestException as exc:
                if attempt == attempts:
                    raise DirectoryUnavailable(f"directory unreachable: {exc}") from exc
                time.sleep(0.5 * attempt)
                continue

            if resp.status_code == 401 and attempt < attempts:
                self._token = None
                continue
            if resp.status_code == 429 and attempt < attempts:
                time.sleep(float(resp.headers.get("Retry-After", "1")))
                continue
            if resp.status_code == 404 and allow_404:
                return resp
            if resp.status_code >= 500:
                if attempt == attempts:
                    raise DirectoryUnavailable(f"directory returned {resp.status_code}")
                time.sleep(0.5 * attempt)
                continue
            resp.raise_for_status()
            return resp
        raise DirectoryUnavailable("retries exhausted")

    def _access_token(self) -> str:
        if self._token and time.monotonic() < self._token_expires_at - 30:
            return self._token
        resp = self._session.post(
            f"{self._base}/oauth2/v1/token",
            data={"grant_type": "client_credentials", "scope": "okta.users.read"},
            auth=(self._client_id, self._client_secret),
            timeout=(3.05, 10),
        )
        resp.raise_for_status()
        body = resp.json()
        self._token = body["access_token"]
        self._token_expires_at = time.monotonic() + int(body.get("expires_in", 300))
        return self._token
