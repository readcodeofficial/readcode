import hashlib
import hmac
from dataclasses import dataclass

from identity.throttle import LoginThrottle

DUMMY_SALT = b"\x00" * 16


class InvalidCredentials(Exception):
    pass


class AccountLocked(Exception):
    pass


@dataclass(frozen=True)
class UserRecord:
    username: str
    salt: bytes
    password_hash: bytes


def hash_password(password: str, salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 120_000)


default_throttle = LoginThrottle()


class Authenticator:
    def __init__(self, users: dict[str, UserRecord], throttle: LoginThrottle | None = None) -> None:
        self._users = users
        self._throttle = throttle or default_throttle

    def login(self, username: str, password: str) -> UserRecord:
        if self._throttle.is_locked(username):
            raise AccountLocked(username)

        user = self._users.get(username)
        candidate = hash_password(password, user.salt if user else DUMMY_SALT)
        if user is None or not hmac.compare_digest(candidate, user.password_hash):
            self._throttle.record_failure(username)
            raise InvalidCredentials()

        self._throttle.record_success(username)
        return user
