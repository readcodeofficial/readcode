import contextvars
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Integer, String, event
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

request_id_var = contextvars.ContextVar("request_id", default="-")

REDACTED_KEYS = {"payment_token", "card_last4", "phone", "email"}


class Base(DeclarativeBase):
    pass


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    actor_id: Mapped[str] = mapped_column(String(64), index=True)
    action: Mapped[str] = mapped_column(String(64), index=True)
    target_type: Mapped[str] = mapped_column(String(32))
    target_id: Mapped[str] = mapped_column(String(64))
    request_id: Mapped[str] = mapped_column(String(64))
    before: Mapped[dict | None] = mapped_column(JSON)
    after: Mapped[dict | None] = mapped_column(JSON)


@event.listens_for(AuditEvent, "before_update")
@event.listens_for(AuditEvent, "before_delete")
def _forbid_changes(mapper, connection, target):
    raise RuntimeError("audit events are append-only")


def _redact(value):
    if isinstance(value, dict):
        return {k: "[REDACTED]" if k in REDACTED_KEYS else _redact(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_redact(v) for v in value]
    return value


def record_event(session, *, actor_id, action, target_type, target_id, before=None, after=None):
    session.add(
        AuditEvent(
            occurred_at=datetime.now(timezone.utc),
            actor_id=actor_id,
            action=action,
            target_type=target_type,
            target_id=str(target_id),
            request_id=request_id_var.get(),
            before=_redact(before),
            after=_redact(after),
        )
    )
