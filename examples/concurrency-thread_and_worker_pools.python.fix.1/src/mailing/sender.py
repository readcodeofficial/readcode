from dataclasses import dataclass


class TransportError(Exception):
    """Raised by a transport when a single message could not be delivered."""


@dataclass(frozen=True)
class Message:
    to: str
    subject: str
    body: str


@dataclass(frozen=True)
class Outcome:
    to: str
    ok: bool
    error: str | None = None
