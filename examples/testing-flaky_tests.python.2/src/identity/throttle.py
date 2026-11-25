import threading
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Callable

Clock = Callable[[], datetime]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class LoginThrottle:
    def __init__(
        self,
        max_failures: int = 5,
        window: timedelta = timedelta(minutes=15),
        lockout: timedelta = timedelta(minutes=30),
        clock: Clock = utc_now,
    ) -> None:
        self._max_failures = max_failures
        self._window = window
        self._lockout = lockout
        self._clock = clock
        self._failures: dict[str, list[datetime]] = defaultdict(list)
        self._locked_until: dict[str, datetime] = {}
        self._lock = threading.Lock()

    def is_locked(self, username: str) -> bool:
        with self._lock:
            until = self._locked_until.get(username)
            if until is None:
                return False
            if self._clock() >= until:
                del self._locked_until[username]
                self._failures.pop(username, None)
                return False
            return True

    def record_failure(self, username: str) -> None:
        now = self._clock()
        with self._lock:
            recent = [t for t in self._failures[username] if now - t < self._window]
            recent.append(now)
            self._failures[username] = recent
            if len(recent) >= self._max_failures:
                self._locked_until[username] = now + self._lockout

    def record_success(self, username: str) -> None:
        with self._lock:
            self._failures.pop(username, None)
