class SuppressionList:
    """Addresses that unsubscribed or hard-bounced; they must never be mailed."""

    def __init__(self, addresses=()):
        self._blocked = {self._normalise(a) for a in addresses}

    @staticmethod
    def _normalise(address: str) -> str:
        return address.strip().lower()

    def add(self, address: str) -> None:
        self._blocked.add(self._normalise(address))

    def __contains__(self, address: str) -> bool:
        return self._normalise(address) in self._blocked

    def filter(self, recipients: list[dict]) -> list[dict]:
        return [r for r in recipients if r["email"] not in self]

    def __len__(self) -> int:
        return len(self._blocked)
