import queue
from typing import Callable

from .jobqueue import JobQueue
from .models import RenderError, RenderJob, RenderResult


class Consumer:
    def __init__(
        self,
        jobs: JobQueue,
        render: Callable[[RenderJob], RenderResult],
        results: dict,
        dead_letters: list,
    ):
        self.jobs = jobs
        self.render = render
        self.results = results
        self.dead_letters = dead_letters

    def drain(self) -> int:
        """Process everything currently queued. Returns how many jobs rendered successfully."""
        handled = 0
        while True:
            try:
                job = self.jobs.take()
            except queue.Empty:
                break
            try:
                result = self.render(job)
                self.results[job.job_id] = result
                self.jobs.done()
                handled += 1
            except RenderError as exc:
                self.dead_letters.append((job, str(exc)))
        return handled
