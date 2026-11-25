class GatewayError(Exception):
    """Anything the SMS provider can answer with besides success."""


class TransientError(GatewayError):
    """The request may succeed if it is sent again later."""


class GatewayTimeout(TransientError):
    pass


class RateLimited(TransientError):
    def __init__(self, retry_after: float):
        super().__init__(f"rate limited, retry after {retry_after}s")
        self.retry_after = retry_after


class InvalidNumber(GatewayError):
    """The destination can never receive the message."""

    def __init__(self, number: str):
        super().__init__(f"invalid number {number}")
        self.number = number
