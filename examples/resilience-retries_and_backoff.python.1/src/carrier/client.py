import uuid
from dataclasses import dataclass
from typing import Any

import requests

from .retry import RetryPolicy, retry_call


@dataclass
class LabelResult:
    tracking_number: str
    label_url: str


class CarrierClient:
    def __init__(self, base_url: str, api_key: str, policy: RetryPolicy | None = None):
        self._base = base_url.rstrip("/")
        self._policy = policy or RetryPolicy()
        self._session = requests.Session()
        self._session.headers["Authorization"] = f"Bearer {api_key}"

    def get_rates(self, shipment_id: str) -> list[dict[str, Any]]:
        def attempt() -> list[dict[str, Any]]:
            resp = self._session.get(
                f"{self._base}/shipments/{shipment_id}/rates", timeout=(2, 5)
            )
            resp.raise_for_status()
            return resp.json()["rates"]

        return retry_call(attempt, self._policy)

    def create_label(self, shipment_id: str, service: str) -> LabelResult:
        payload = {"shipment_id": shipment_id, "service": service}

        def attempt() -> LabelResult:
            resp = self._session.post(
                f"{self._base}/labels",
                json=payload,
                headers={"Idempotency-Key": str(uuid.uuid4())},
                timeout=(2, 10),
            )
            resp.raise_for_status()
            body = resp.json()
            return LabelResult(body["tracking_number"], body["label_url"])

        return retry_call(attempt, self._policy)
