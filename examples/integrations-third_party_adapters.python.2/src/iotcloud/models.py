from dataclasses import dataclass
from datetime import datetime, timezone

CELSIUS_CONVERTERS = {
    "C": lambda v: v,
    "F": lambda v: (v - 32.0) * 5.0 / 9.0,
    "K": lambda v: v - 273.15,
}


class UnsupportedUnit(ValueError):
    pass


@dataclass(frozen=True)
class Reading:
    device_id: str
    metric: str
    value: float
    recorded_at: datetime


def normalise_reading(device_id: str, raw: dict) -> Reading:
    metric = raw["metric"]
    value = float(raw["value"])
    if metric == "temperature":
        unit = raw.get("unit", "C")
        try:
            value = CELSIUS_CONVERTERS[unit](value)
        except KeyError:
            raise UnsupportedUnit(f"{device_id}: temperature unit {unit!r}") from None
    return Reading(
        device_id=device_id,
        metric=metric,
        value=value,
        recorded_at=datetime.fromtimestamp(raw["ts"] / 1000, tz=timezone.utc),
    )
