import logging
from contextlib import contextmanager

import psycopg
from psycopg import errors as pg_errors

from ledger.secrets import SecretsProvider

log = logging.getLogger("ledger.db")


class LedgerDatabase:
    def __init__(self, secrets: SecretsProvider, secret_id: str, connect_timeout: int = 5):
        self._secrets = secrets
        self._secret_id = secret_id
        self._connect_timeout = connect_timeout

    def _connect(self, *, force_refresh: bool) -> psycopg.Connection:
        creds = self._secrets.db_credentials(self._secret_id, force_refresh=force_refresh)
        return psycopg.connect(
            host=creds.host,
            port=creds.port,
            dbname=creds.dbname,
            user=creds.username,
            password=creds.password,
            sslmode="verify-full",
            connect_timeout=self._connect_timeout,
        )

    @contextmanager
    def connection(self):
        try:
            conn = self._connect(force_refresh=False)
        except pg_errors.InvalidPassword:
            # The password was probably rotated after we cached it: fetch once more, then give up.
            log.warning("ledger db rejected cached credentials; refetching secret")
            conn = self._connect(force_refresh=True)
        try:
            with conn:
                yield conn
        finally:
            conn.close()
