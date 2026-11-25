from dataclasses import dataclass


@dataclass(frozen=True)
class AuditRecord:
    actor: str
    action: str
    target: str
    allowed: bool


class AuditLog:
    def __init__(self):
        self.records: list[AuditRecord] = []

    def record(self, actor: str, action: str, target: str, allowed: bool) -> None:
        self.records.append(AuditRecord(actor, action, target, allowed))

    def denials(self) -> list:
        return [r for r in self.records if not r.allowed]
