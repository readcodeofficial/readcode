import sqlite3
from typing import Optional

SORT_COLUMNS = {"created": "created", "status": "status", "requester": "requester"}


class TicketRepo:
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn
        self._clock = 0

    def add(self, subject: str, requester: str, status: str = "open") -> int:
        self._clock += 1
        cur = self.conn.execute(
            "INSERT INTO tickets (subject, requester, status, created) VALUES (?, ?, ?, ?)",
            (subject, requester, status, self._clock),
        )
        return cur.lastrowid

    def get(self, ticket_id: int) -> Optional[tuple]:
        return self.conn.execute(
            "SELECT id, subject, requester, status FROM tickets WHERE id = ?", (ticket_id,)
        ).fetchone()

    def by_requester(self, requester: str) -> list:
        return self.conn.execute(
            "SELECT id, subject, requester, status FROM tickets WHERE requester = ? ORDER BY created",
            (requester,),
        ).fetchall()

    def search(self, text: str, status: Optional[str] = None, order_by: str = "created") -> list:
        column = SORT_COLUMNS.get(order_by, "created")
        sql = f"SELECT id, subject, requester, status FROM tickets WHERE subject LIKE '%{text}%'"
        params: list = []
        if status:
            sql += " AND status = ?"
            params.append(status)
        sql += f" ORDER BY {column}, id"
        return self.conn.execute(sql, params).fetchall()
