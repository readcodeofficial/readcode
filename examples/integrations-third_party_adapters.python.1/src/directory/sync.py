from __future__ import annotations

import logging
from typing import Protocol

from .ports import DirectoryProvider, DirectoryUser, UserStatus

log = logging.getLogger(__name__)


class AccountStore(Protocol):
    def known_external_ids(self) -> set[str]: ...
    def upsert(self, user: DirectoryUser) -> None: ...
    def revoke_sessions(self, external_id: str) -> None: ...
    def disable(self, external_id: str) -> None: ...


def sync_directory(directory: DirectoryProvider, store: AccountStore) -> dict[str, int]:
    counts = {"upserted": 0, "disabled": 0, "missing": 0}
    seen: set[str] = set()

    for user in directory.iter_users():
        seen.add(user.external_id)
        if user.status is UserStatus.ACTIVE:
            store.upsert(user)
            counts["upserted"] += 1
        else:
            store.revoke_sessions(user.external_id)
            store.disable(user.external_id)
            counts["disabled"] += 1

    for external_id in store.known_external_ids() - seen:
        user = directory.get_user(external_id)
        if user is None:
            log.warning("account %s no longer exists upstream", external_id)
            store.revoke_sessions(external_id)
            store.disable(external_id)
            counts["missing"] += 1
    return counts
