from concurrent.futures import ThreadPoolExecutor, as_completed

from mailing.sender import Message, Outcome, TransportError


class BulkDispatcher:
    def __init__(self, transport, workers: int = 4):
        if workers < 1:
            raise ValueError("workers must be at least 1")
        self._transport = transport
        self._workers = workers

    def _deliver(self, message: Message) -> Outcome:
        try:
            self._transport.send(message)
        except TransportError as exc:
            return Outcome(message.to, False, str(exc))
        return Outcome(message.to, True)

    def send_all(self, messages: list[Message]) -> list[Outcome]:
        outcomes: list[Outcome] = []
        with ThreadPoolExecutor(max_workers=self._workers) as pool:
            futures = [pool.submit(self._deliver, message) for message in messages]
            for future in as_completed(futures):
                outcomes.append(future.result())
        return outcomes
