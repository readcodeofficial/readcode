from __future__ import annotations

import logging

from errors import LabelError, root_cause
from service import LabelService

log = logging.getLogger(__name__)


def process_batch(service: LabelService, shipments: list[dict]) -> dict[str, str]:
    labels: dict[str, str] = {}
    failures: dict[str, str] = {}

    for shipment in shipments:
        try:
            labels[shipment["id"]] = service.create_label(shipment)
        except LabelError as exc:
            cause = root_cause(exc)
            failures[shipment["id"]] = type(cause).__name__
            log.error(
                "label failed: %s",
                exc,
                extra={
                    "shipment_id": shipment["id"],
                    "root_cause": type(cause).__name__,
                },
                exc_info=exc,
            )

    if failures:
        log.warning("batch finished with %d failures", len(failures))
    return labels
