from __future__ import annotations

import enum
from dataclasses import dataclass
from typing import Iterator, Protocol


class UserStatus(enum.Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    DEPROVISIONED = "deprovisioned"


@dataclass(frozen=True)
class DirectoryUser:
    external_id: str
    email: str
    display_name: str
    status: UserStatus
    groups: tuple[str, ...]


class DirectoryError(Exception):
    pass


class DirectoryUnavailable(DirectoryError):
    pass


class DirectoryProvider(Protocol):
    def iter_users(self) -> Iterator[DirectoryUser]: ...

    def get_user(self, external_id: str) -> DirectoryUser | None: ...
