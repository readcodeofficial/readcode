from dataclasses import dataclass, field


@dataclass
class Account:
    email: str
    password_hash: str
    failed_attempts: int = 0
    locked_until: float = 0.0


class AccountStore:
    def __init__(self):
        self._accounts: dict[str, Account] = {}

    def add(self, account: Account) -> None:
        key = account.email.lower()
        if key in self._accounts:
            raise ValueError("email already registered")
        self._accounts[key] = account

    def get(self, email: str):
        return self._accounts.get(email.lower())
