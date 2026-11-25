from datetime import datetime, timedelta, timezone

import pytest

from identity.auth import (
    AccountLocked,
    Authenticator,
    InvalidCredentials,
    UserRecord,
    hash_password,
)
from identity.throttle import LoginThrottle

PASSWORD = "correct horse"


class FakeClock:
    def __init__(self) -> None:
        self.now = datetime(2025, 3, 1, 9, 0, tzinfo=timezone.utc)

    def __call__(self) -> datetime:
        return self.now

    def advance(self, **kwargs) -> None:
        self.now += timedelta(**kwargs)


@pytest.fixture(scope="module")
def auth_env():
    clock = FakeClock()
    salt = b"0123456789abcdef"
    users = {"alice": UserRecord("alice", salt, hash_password(PASSWORD, salt))}
    return Authenticator(users, LoginThrottle(clock=clock)), clock


@pytest.fixture
def wrong_password():
    return "not the password"


def test_valid_credentials_return_the_user(auth_env):
    auth, _ = auth_env
    assert auth.login("alice", PASSWORD).username == "alice"


def test_unknown_user_is_rejected_like_a_wrong_password(auth_env, wrong_password):
    auth, _ = auth_env
    with pytest.raises(InvalidCredentials):
        auth.login("mallory", wrong_password)


def test_success_resets_the_failure_count(auth_env, wrong_password):
    auth, _ = auth_env
    for _ in range(4):
        with pytest.raises(InvalidCredentials):
            auth.login("alice", wrong_password)
    assert auth.login("alice", PASSWORD).username == "alice"
    for _ in range(4):
        with pytest.raises(InvalidCredentials):
            auth.login("alice", wrong_password)
    assert auth.login("alice", PASSWORD).username == "alice"


def test_old_failures_age_out_of_the_window(auth_env, wrong_password):
    auth, clock = auth_env
    for _ in range(4):
        with pytest.raises(InvalidCredentials):
            auth.login("alice", wrong_password)
    clock.advance(minutes=16)
    with pytest.raises(InvalidCredentials):
        auth.login("alice", wrong_password)
    assert auth.login("alice", PASSWORD).username == "alice"


def test_account_locks_after_five_failures(auth_env, wrong_password):
    auth, _ = auth_env
    for _ in range(5):
        with pytest.raises(InvalidCredentials):
            auth.login("alice", wrong_password)
    with pytest.raises(AccountLocked):
        auth.login("alice", PASSWORD)
