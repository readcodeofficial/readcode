import os

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from repository import InvalidCursor, NotificationRepository, decode_cursor

DEFAULT_PAGE_SIZE = 25
MAX_PAGE_SIZE = 100

SessionLocal = sessionmaker(create_engine(os.environ["DATABASE_URL"]))
router = APIRouter()


def get_session():
    with SessionLocal() as session:
        yield session


def get_current_user_id(x_authenticated_user: int = Header(...)) -> int:
    return x_authenticated_user


@router.get("/users/{user_id}/notifications")
def list_notifications(
    user_id: int,
    limit: int = Query(DEFAULT_PAGE_SIZE, ge=1),
    cursor: str | None = None,
    unread_only: bool = False,
    session: Session = Depends(get_session),
    current_user_id: int = Depends(get_current_user_id),
):
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="forbidden")

    limit = min(limit, MAX_PAGE_SIZE)
    try:
        after = decode_cursor(cursor) if cursor else None
    except InvalidCursor:
        raise HTTPException(status_code=400, detail="invalid cursor")

    page = NotificationRepository(session).page_for_user(
        user_id, limit, after=after, unread_only=unread_only
    )
    return {
        "items": [
            {
                "id": n.id,
                "channel": n.channel,
                "title": n.title,
                "created_at": n.created_at.isoformat(),
                "read": n.read_at is not None,
            }
            for n in page.items
        ],
        "next_cursor": page.next_cursor,
    }
