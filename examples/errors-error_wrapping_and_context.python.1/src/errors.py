from __future__ import annotations


class LogisticsError(Exception):
    """Base class for errors raised by the label pipeline."""


class CarrierError(LogisticsError):
    def __init__(self, carrier: str, message: str, status: int | None = None):
        super().__init__(f"{carrier}: {message}")
        self.carrier = carrier
        self.status = status


class CarrierUnavailable(CarrierError):
    """Timeouts, connection failures, 429 and 5xx responses."""


class CarrierRejected(CarrierError):
    """The carrier understood the request and refused it."""


class LabelError(LogisticsError):
    def __init__(self, shipment_id: str, message: str):
        super().__init__(f"shipment {shipment_id}: {message}")
        self.shipment_id = shipment_id


def causes(exc: BaseException | None, limit: int = 8):
    while exc is not None and limit > 0:
        yield exc
        exc = exc.__cause__
        limit -= 1


def is_transient(exc: BaseException) -> bool:
    return any(isinstance(e, CarrierUnavailable) for e in causes(exc))


def root_cause(exc: BaseException) -> BaseException:
    last = exc
    for last in causes(exc):
        pass
    return last
