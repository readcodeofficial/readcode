import logging
import time
import uuid
from dataclasses import dataclass, field

from ledger_client import DeadlineExceeded, LedgerClient, LedgerUnavailable

log = logging.getLogger("settlement")


@dataclass
class PendingTransfer:
    source: str
    destination: str
    amount_minor: int
    currency: str
    transfer_id: str = field(default_factory=lambda: str(uuid.uuid4()))


@dataclass
class SettlementReport:
    posted: list[str] = field(default_factory=list)
    insufficient: list[str] = field(default_factory=list)
    deferred: list[str] = field(default_factory=list)


class SettlementRun:
    def __init__(self, ledger: LedgerClient, budget_seconds: float = 20.0):
        self._ledger = ledger
        self._budget_seconds = budget_seconds

    def run(self, batch: list[PendingTransfer]) -> SettlementReport:
        report = SettlementReport()
        deadline = time.monotonic() + self._budget_seconds
        for position, transfer in enumerate(batch):
            try:
                balance = self._ledger.get_balance(transfer.source, deadline)
                if balance["available_minor"] < transfer.amount_minor:
                    report.insufficient.append(transfer.transfer_id)
                    continue
                self._ledger.post_transfer(
                    transfer.transfer_id,
                    transfer.source,
                    transfer.destination,
                    transfer.amount_minor,
                    transfer.currency,
                    deadline,
                )
                report.posted.append(transfer.transfer_id)
            except DeadlineExceeded:
                report.deferred.extend(t.transfer_id for t in batch[position:])
                log.error("settlement budget exhausted, %d transfers deferred", len(report.deferred))
                break
            except LedgerUnavailable:
                report.deferred.append(transfer.transfer_id)
        return report
