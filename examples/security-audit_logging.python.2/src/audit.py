from dataclasses import dataclass

from sqlalchemy.orm import Session

from models import AuditEntry


@dataclass(frozen=True)
class Principal:
    user_id: str
    role: str


class AuditLog:
    def __init__(self, request_id: str) -> None:
        self._request_id = request_id

    def record(
        self,
        session: Session,
        principal: Principal,
        action: str,
        target: str,
        detail: dict,
    ) -> None:
        session.add(
            AuditEntry(
                actor_id=principal.user_id,
                actor_role=principal.role,
                action=action,
                target=target,
                detail=detail,
                request_id=self._request_id,
            )
        )
