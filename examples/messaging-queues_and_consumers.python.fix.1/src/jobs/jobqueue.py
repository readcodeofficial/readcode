import queue

from .models import RenderJob


class JobQueue:
    """Thin wrapper around queue.Queue so the rest of the code does not depend on it directly."""

    def __init__(self, maxsize: int = 0):
        self._q: "queue.Queue[RenderJob]" = queue.Queue(maxsize=maxsize)

    def publish(self, job: RenderJob) -> None:
        self._q.put(job)

    def take(self) -> RenderJob:
        """Return the next job, or raise queue.Empty if there is none right now."""
        return self._q.get_nowait()

    def done(self) -> None:
        self._q.task_done()

    def pending(self) -> int:
        return self._q.qsize()

    def unfinished(self) -> int:
        return self._q.unfinished_tasks

    def join(self) -> None:
        """Block until every published job has been marked done."""
        self._q.join()
