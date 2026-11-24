import json
import logging
import threading
import time
from dataclasses import dataclass, field

import boto3

log = logging.getLogger("ledger.secrets")


@dataclass(frozen=True)
class DbCredentials:
    host: str
    port: int
    dbname: str
    username: str
    password: str


@dataclass(frozen=True)
class WebhookSecret:
    key_id: str
    value: bytes = field(repr=False)


class SecretsProvider:
    """Reads JSON secrets from AWS Secrets Manager with a short in-process cache."""

    def __init__(self, client=None, ttl_seconds: float = 300.0, clock=time.monotonic):
        self._client = client or boto3.client("secretsmanager")
        self._ttl = ttl_seconds
        self._clock = clock
        self._lock = threading.Lock()
        self._cache: dict[str, tuple[float, dict]] = {}

    def get_json(self, secret_id: str, *, force_refresh: bool = False) -> dict:
        with self._lock:
            hit = self._cache.get(secret_id)
            if hit and not force_refresh and self._clock() - hit[0] < self._ttl:
                return hit[1]
            response = self._client.get_secret_value(SecretId=secret_id)
            payload = json.loads(response["SecretString"])
            self._cache[secret_id] = (self._clock(), payload)
            return payload

    def db_credentials(self, secret_id: str, *, force_refresh: bool = False) -> DbCredentials:
        raw = self.get_json(secret_id, force_refresh=force_refresh)
        creds = DbCredentials(
            host=raw["host"],
            port=int(raw["port"]),
            dbname=raw["dbname"],
            username=raw["username"],
            password=raw["password"],
        )
        if force_refresh:
            log.info("refreshed ledger db credentials %s", creds)
        return creds

    def webhook_secret(self, secret_id: str) -> WebhookSecret:
        raw = self.get_json(secret_id)
        return WebhookSecret(key_id=raw["key_id"], value=raw["value"].encode("utf-8"))
