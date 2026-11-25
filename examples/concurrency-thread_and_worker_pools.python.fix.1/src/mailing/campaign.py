from dataclasses import dataclass, field

from mailing.suppression import SuppressionList
from mailing.templates import render


@dataclass
class CampaignReport:
    sent: int = 0
    failed: int = 0
    skipped: int = 0
    retry: list[str] = field(default_factory=list)


def run_campaign(
    dispatcher,
    recipients: list[dict],
    subject_tpl: str,
    body_tpl: str,
    suppressed: SuppressionList | None = None,
) -> CampaignReport:
    report = CampaignReport()
    if suppressed is not None:
        allowed = suppressed.filter(recipients)
        report.skipped = len(recipients) - len(allowed)
        recipients = allowed

    messages = [render(subject_tpl, body_tpl, r) for r in recipients]
    outcomes = dispatcher.send_all(messages)

    for recipient, outcome in zip(recipients, outcomes):
        if outcome.ok:
            report.sent += 1
        else:
            report.failed += 1
            report.retry.append(recipient["email"])
    return report
