from __future__ import annotations

import requests

from errors import CarrierRejected, CarrierUnavailable


class CarrierClient:
    name = "parcelhub"

    def __init__(self, base_url: str, api_key: str, session: requests.Session | None = None):
        self._base_url = base_url.rstrip("/")
        self._session = session or requests.Session()
        self._session.headers["Authorization"] = f"Bearer {api_key}"

    def create_label(self, payload: dict) -> dict:
        try:
            resp = self._session.post(
                f"{self._base_url}/v2/labels", json=payload, timeout=(3.05, 10)
            )
            resp.raise_for_status()
        except (requests.Timeout, requests.ConnectionError) as exc:
            raise CarrierUnavailable(self.name, "no response from carrier") from exc
        except requests.HTTPError as exc:
            status = exc.response.status_code
            if status == 429 or status >= 500:
                raise CarrierUnavailable(self.name, f"HTTP {status}", status) from exc
            raise CarrierRejected(self.name, f"HTTP {status}", status) from exc

        try:
            return resp.json()
        except ValueError as exc:
            raise CarrierRejected(self.name, "malformed response body") from exc
