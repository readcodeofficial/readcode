import secrets
from dataclasses import dataclass
from typing import Callable, Optional

SESSION_TTL = 3600


@dataclass
class Session:
    token: str
    email: str
    expires_at: float


class SessionStore:
    def __init__(self, clock: Callable[[], float]):
        self._clock = clock
        self._sessions: dict[str, Session] = {}

    def open(self, email: str) -> Session:
        session = Session(secrets.token_urlsafe(32), email, self._clock() + SESSION_TTL)
        self._sessions[session.token] = session
        return session

    def lookup(self, token: str) -> Optional[Session]:
        session = self._sessions.get(token)
        if session is None:
            return None
        if session.expires_at <= self._clock():
            del self._sessions[token]
            return None
        return session

    def close(self, token: str) -> None:
        self._sessions.pop(token, None)
