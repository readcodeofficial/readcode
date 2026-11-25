import hashlib
import hmac
import os

ITERATIONS = 20_000


def _derive(password: str, salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, ITERATIONS)


def hash_password(password: str, salt: bytes = os.urandom(16)) -> str:
    """Return "<salt hex>$<digest hex>" suitable for storing."""
    return salt.hex() + "$" + _derive(password, salt).hex()


def verify_password(password: str, stored: str) -> bool:
    salt_hex, digest_hex = stored.split("$", 1)
    candidate = _derive(password, bytes.fromhex(salt_hex)).hex()
    return hmac.compare_digest(candidate, digest_hex)
