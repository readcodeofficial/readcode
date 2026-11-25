from typing import Callable

from .passwords import hash_password, verify_password
from .sessions import Session, SessionStore
from .store import Account, AccountStore

MAX_FAILURES = 3
LOCK_SECONDS = 300


class AuthError(Exception):
    pass


class AuthService:
    def __init__(self, store: AccountStore, clock: Callable[[], float]):
        self.store = store
        self.clock = clock
        self.sessions = SessionStore(clock)

    def register(self, email: str, password: str) -> None:
        if len(password) < 8:
            raise ValueError("password too short")
        self.store.add(Account(email, hash_password(password)))

    def login(self, email: str, password: str) -> Account:
        account = self.store.get(email)
        if account is None:
            raise AuthError("invalid credentials")
        now = self.clock()
        if account.locked_until > now:
            raise AuthError("account locked")
        if not verify_password(password, account.password_hash):
            account.failed_attempts += 1
            if account.failed_attempts >= MAX_FAILURES:
                account.locked_until = now + LOCK_SECONDS
                account.failed_attempts = 0
            raise AuthError("invalid credentials")
        account.failed_attempts = 0
        return account

    def login_session(self, email: str, password: str) -> Session:
        account = self.login(email, password)
        return self.sessions.open(account.email)
