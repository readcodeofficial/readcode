import logging
import uuid
from typing import Iterator

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential_jitter

from iotcloud.models import Reading, normalise_reading

log = logging.getLogger(__name__)


class ProviderError(Exception):
    def __init__(self, status: int, detail: str):
        super().__init__(f"device cloud returned {status}: {detail}")
        self.status = status


class TransientProviderError(ProviderError):
    pass


class DeviceNotFound(ProviderError):
    pass


_RETRY_POLICY = retry(
    retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError, TransientProviderError)),
    stop=stop_after_attempt(4),
    wait=wait_exponential_jitter(initial=0.5, max=8),
    reraise=True,
)


def _raise_for_status(response: httpx.Response) -> None:
    status = response.status_code
    if status < 400:
        return
    detail = response.text[:200]
    if status == 404:
        raise DeviceNotFound(status, detail)
    if status in (429, 502, 503, 504):
        raise TransientProviderError(status, detail)
    raise ProviderError(status, detail)


class DeviceCloudClient:
    def __init__(self, base_url: str, api_key: str, page_size: int = 500):
        self._page_size = page_size
        self._http = httpx.Client(
            base_url=base_url,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=httpx.Timeout(10.0, connect=3.0),
        )

    def close(self) -> None:
        self._http.close()

    def readings(self, device_id: str, since_ms: int) -> Iterator[Reading]:
        cursor = None
        while True:
            page = self._get_page(device_id, since_ms, cursor)
            for raw in page["items"]:
                yield normalise_reading(device_id, raw)
            cursor = page.get("next_cursor")
            if cursor is None:
                return

    @_RETRY_POLICY
    def _get_page(self, device_id: str, since_ms: int, cursor: str | None) -> dict:
        params = {"since": since_ms, "limit": self._page_size}
        if cursor:
            params["cursor"] = cursor
        response = self._http.get(
            f"/v2/devices/{device_id}/telemetry",
            params=params,
            headers={"X-Request-Id": str(uuid.uuid4())},
        )
        _raise_for_status(response)
        return response.json()

    @_RETRY_POLICY
    def send_command(self, device_id: str, command: str, arguments: dict | None = None) -> str:
        response = self._http.post(
            f"/v2/devices/{device_id}/commands",
            json={"command": command, "arguments": arguments or {}},
            headers={"X-Request-Id": str(uuid.uuid4())},
        )
        _raise_for_status(response)
        command_id = response.json()["command_id"]
        log.info("queued %s on %s as %s", command, device_id, command_id)
        return command_id
