import hashlib
import hmac
import json
import logging

from ledger.secrets import SecretsProvider

log = logging.getLogger("ledger.webhook")


class SettlementWebhook:
    def __init__(self, secrets: SecretsProvider, secret_id: str, apply_settlement):
        self._secrets = secrets
        self._secret_id = secret_id
        self._apply = apply_settlement

    def handle(self, body: bytes, signature_hex: str) -> int:
        secret = self._secrets.webhook_secret(self._secret_id)
        expected = hmac.new(secret.value, body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature_hex):
            log.warning("settlement webhook rejected: bad signature (key %s)", secret.key_id)
            return 401

        event = json.loads(body)
        self._apply(event["settlement_id"], event["amount_minor"], event["currency"])
        return 204
