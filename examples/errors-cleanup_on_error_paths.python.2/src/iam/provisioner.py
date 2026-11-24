from __future__ import annotations

import logging
import secrets
from dataclasses import dataclass
from typing import Protocol

from iam.undo import UndoStack

log = logging.getLogger("iam.provisioning")


class Directory(Protocol):
    def create_user(self, email: str) -> str: ...
    def delete_user(self, user_id: str) -> None: ...
    def add_to_group(self, user_id: str, group: str) -> None: ...
    def remove_from_group(self, user_id: str, group: str) -> None: ...


class CredentialVault(Protocol):
    def store_recovery_codes(self, user_id: str, codes: list[str]) -> None: ...
    def revoke_recovery_codes(self, user_id: str) -> None: ...


class Mailer(Protocol):
    def send_invite(self, email: str, user_id: str) -> None: ...


class AuditLog(Protocol):
    def record(self, event: str, user_id: str, detail: str) -> None: ...


@dataclass(frozen=True)
class ProvisionRequest:
    email: str
    groups: tuple[str, ...]
    requested_by: str


class ProvisioningError(Exception):
    pass


class Provisioner:
    def __init__(self, directory: Directory, vault: CredentialVault, mailer: Mailer, audit: AuditLog) -> None:
        self._directory = directory
        self._vault = vault
        self._mailer = mailer
        self._audit = audit

    def provision(self, req: ProvisionRequest) -> str:
        if not req.groups:
            raise ProvisioningError("at least one group is required")

        with UndoStack(f"provision {req.email}") as undo:
            user_id = self._directory.create_user(req.email)
            undo.push("delete user", lambda: self._directory.delete_user(user_id))

            for group in req.groups:
                self._directory.add_to_group(user_id, group)
                undo.push(f"leave {group}", lambda g=group: self._directory.remove_from_group(user_id, g))

            codes = [secrets.token_hex(5) for _ in range(8)]
            self._vault.store_recovery_codes(user_id, codes)
            undo.push("revoke recovery codes", lambda: self._vault.revoke_recovery_codes(user_id))

            self._mailer.send_invite(req.email, user_id)
            undo.commit()

        try:
            self._audit.record("user.provisioned", user_id, f"by {req.requested_by}")
        except Exception:
            log.exception("audit write failed for %s; user %s stays provisioned", req.email, user_id)
        return user_id
