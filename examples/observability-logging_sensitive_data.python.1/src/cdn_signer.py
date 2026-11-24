import hashlib
import hmac
import logging
import time

import httpx

log = logging.getLogger("streamhub.cdn")


class CdnSigningError(Exception):
    pass


class CdnSigner:
    def __init__(self, base_url: str, secret: bytes, client: httpx.AsyncClient):
        self._base_url = base_url
        self._secret = secret
        self._client = client

    def signed_manifest_url(self, title_id: str, ttl_seconds: int = 300) -> str:
        expires = int(time.time()) + ttl_seconds
        path = f"/titles/{title_id}/master.m3u8"
        digest = hmac.new(self._secret, f"{path}:{expires}".encode(), hashlib.sha256).hexdigest()
        return f"{self._base_url}{path}?expires={expires}&sig={digest}"

    async def issue_license(self, title_id: str, user_id: str, device_id: str) -> str:
        resp = await self._client.post(
            f"{self._base_url}/drm/licenses",
            json={"title": title_id, "user": user_id, "device": device_id},
            timeout=3.0,
        )
        if resp.status_code != 200:
            log.error(
                "license issue failed",
                extra={"title_id": title_id, "user_id": user_id, "status": resp.status_code},
            )
            raise CdnSigningError(f"license service returned {resp.status_code}")
        return resp.json()["license_token"]
