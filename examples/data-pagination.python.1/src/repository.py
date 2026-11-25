import base64
import json
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from models import Notification


class InvalidCursor(ValueError):
    pass


@dataclass(frozen=True)
class Cursor:
    created_at: datetime
    id: int


@dataclass(frozen=True)
class Page:
    items: list[Notification]
    next_cursor: str | None


def encode_cursor(cursor: Cursor) -> str:
    raw = json.dumps({"t": cursor.created_at.isoformat(), "i": cursor.id})
    return base64.urlsafe_b64encode(raw.encode()).decode()


def decode_cursor(token: str) -> Cursor:
    try:
        payload = json.loads(base64.urlsafe_b64decode(token.encode()))
        return Cursor(datetime.fromisoformat(payload["t"]), int(payload["i"]))
    except (ValueError, KeyError, TypeError) as exc:
        raise InvalidCursor("malformed cursor") from exc


class NotificationRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def page_for_user(
        self,
        user_id: int,
        limit: int,
        after: Cursor | None = None,
        unread_only: bool = False,
    ) -> Page:
        stmt = select(Notification).where(Notification.user_id == user_id)
        if unread_only:
            stmt = stmt.where(Notification.read_at.is_(None))
        if after is not None:
            stmt = stmt.where(
                or_(
                    Notification.created_at < after.created_at,
                    and_(
                        Notification.created_at == after.created_at,
                        Notification.id > after.id,
                    ),
                )
            )
        stmt = stmt.order_by(
            Notification.created_at.desc(), Notification.id.desc()
        ).limit(limit + 1)

        rows = list(self._session.scalars(stmt))
        items = rows[:limit]
        next_cursor = None
        if len(rows) > limit:
            last = items[-1]
            next_cursor = encode_cursor(Cursor(last.created_at, last.id))
        return Page(items=items, next_cursor=next_cursor)
