import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from sanitize import clean_text

_CUISINE = re.compile(r"[a-z]{2,20}")


class NoteBody(BaseModel):
    note: str

    @field_validator("note")
    @classmethod
    def clean_note(cls, value: str) -> str:
        cleaned = clean_text(value, max_len=280, allow_newlines=True)
        if not cleaned:
            raise ValueError("note must not be empty")
        return cleaned


class RestaurantQuery(BaseModel):
    q: str = ""
    cuisine: str | None = None
    sort: Literal["rating", "eta", "name"] = "rating"
    limit: int = Field(default=20, ge=1, le=50)

    @field_validator("q")
    @classmethod
    def clean_q(cls, value: str) -> str:
        return clean_text(value, max_len=60)

    @field_validator("cuisine")
    @classmethod
    def check_cuisine(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip().lower()
        if not _CUISINE.fullmatch(value):
            raise ValueError("invalid cuisine")
        return value
