import re

MAX_SEGMENT = 160


def normalise_number(raw: str) -> str:
    return re.sub(r"[\s().-]", "", raw)


class SmsGateway:
    """Thin adapter over the provider client: cleans input, then submits one message."""

    def __init__(self, provider):
        self._provider = provider

    def send(self, to: str, text: str) -> str:
        number = normalise_number(to)
        body = text if len(text) <= MAX_SEGMENT else text[: MAX_SEGMENT - 1] + "…"
        return self._provider.submit(number, body)
