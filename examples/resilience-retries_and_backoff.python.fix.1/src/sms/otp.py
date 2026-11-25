import random
import time
from dataclasses import dataclass

from sms.errors import GatewayError, InvalidNumber
from sms.gateway import SmsGateway
from sms.retry import call_with_retry


@dataclass(frozen=True)
class OtpResult:
    delivered: bool
    attempts: int
    reason: str | None = None


def send_otp(
    gateway: SmsGateway,
    phone: str,
    code: str,
    *,
    sleep=time.sleep,
    rng: random.Random | None = None,
) -> OtpResult:
    attempts = 0

    def submit():
        nonlocal attempts
        attempts += 1
        return gateway.send(phone, f"Your verification code is {code}")

    try:
        call_with_retry(submit, sleep=sleep, rng=rng)
    except InvalidNumber:
        return OtpResult(False, attempts, "invalid_number")
    except GatewayError:
        return OtpResult(False, attempts, "unavailable")
    return OtpResult(True, attempts)
