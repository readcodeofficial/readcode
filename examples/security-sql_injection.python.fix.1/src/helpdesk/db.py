import sqlite3

SCHEMA = """
CREATE TABLE tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject TEXT NOT NULL,
    requester TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created INTEGER NOT NULL
);
CREATE TABLE api_keys (
    id INTEGER PRIMARY KEY,
    owner TEXT NOT NULL,
    secret TEXT NOT NULL
);
"""


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.executescript(SCHEMA)
    return conn
