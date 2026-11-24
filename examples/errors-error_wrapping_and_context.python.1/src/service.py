from __future__ import annotations

import logging

from tenacity import (
    retry,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential_jitter,
)

from carrier import CarrierClient
from errors import CarrierRejected, CarrierUnavailable, LabelError, is_transient

log = logging.getLogger(__name__)


class LabelService:
    def __init__(self, carrier: CarrierClient):
        self._carrier = carrier

    @retry(
        retry=retry_if_exception(is_transient),
        stop=stop_after_attempt(4),
        wait=wait_exponential_jitter(initial=0.5, max=8),
        reraise=True,
    )
    def _request_label(self, shipment_id: str, payload: dict) -> dict:
        try:
            return self._carrier.create_label(payload)
        except CarrierRejected as exc:
            raise LabelError(shipment_id, f"carrier rejected the label request ({exc})") from exc
        except CarrierUnavailable as exc:
            raise LabelError(shipment_id, f"carrier unavailable ({exc})")

    def create_label(self, shipment: dict) -> str:
        payload = {
            "reference": shipment["id"],
            "service": shipment["service_level"],
            "weight_g": shipment["weight_g"],
            "to": shipment["destination"],
        }
        body = self._request_label(shipment["id"], payload)
        log.info("label created", extra={"shipment_id": shipment["id"]})
        return body["label_url"]
