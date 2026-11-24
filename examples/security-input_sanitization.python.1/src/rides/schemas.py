import re
from uuid import UUID

import bleach
from pydantic import BaseModel, Field, field_validator

PROMO_RE = re.compile(r"^[A-Z0-9]{4,12}$")
SORT_COLUMNS = {
    "requested": "requested_at",
    "fare": "fare_cents",
    "distance": "distance_m",
}


class Coordinates(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)


class RideRequest(BaseModel):
    rider_id: UUID
    pickup: Coordinates
    dropoff: Coordinates
    pickup_note: str = Field(default="", max_length=280)
    promo_code: str | None = None

    @field_validator("pickup_note")
    @classmethod
    def clean_note(cls, value: str) -> str:
        return bleach.clean(value, tags=[], attributes={}, strip=True).strip()

    @field_validator("promo_code")
    @classmethod
    def check_promo(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.upper()
        if not PROMO_RE.match(value):
            raise ValueError("promo code must be 4-12 letters or digits")
        return value
