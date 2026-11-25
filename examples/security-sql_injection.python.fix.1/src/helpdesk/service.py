from .repo import TicketRepo

MAX_QUERY = 80
STATUSES = {"open", "pending", "closed"}


class HelpDesk:
    def __init__(self, repo: TicketRepo):
        self.repo = repo

    def open_ticket(self, subject: str, requester: str) -> int:
        subject = subject.strip()
        if not subject:
            raise ValueError("subject is required")
        return self.repo.add(subject, requester)

    def search(self, query: str, status: str = "", sort: str = "created") -> list:
        query = query.strip()[:MAX_QUERY]
        if status and status not in STATUSES:
            raise ValueError(f"unknown status {status!r}")
        rows = self.repo.search(query, status or None, sort)
        return [{"id": r[0], "subject": r[1], "requester": r[2], "status": r[3]} for r in rows]

    def history(self, requester: str) -> list:
        return [r[0] for r in self.repo.by_requester(requester)]
