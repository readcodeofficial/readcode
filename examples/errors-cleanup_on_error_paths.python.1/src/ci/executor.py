import logging
import subprocess
from contextlib import ExitStack
from dataclasses import dataclass, field

from ci.leases import job_workspace, leased_runner, started_container

log = logging.getLogger(__name__)


class StepFailed(Exception):
    def __init__(self, step, returncode, output):
        super().__init__(f"step {step!r} exited with {returncode}")
        self.step = step
        self.returncode = returncode
        self.output = output


@dataclass
class Job:
    id: str
    image: str
    steps: list
    artifact_globs: list = field(default_factory=list)
    step_timeout: int = 900


def run_job(job, pool, artifacts):
    with ExitStack() as stack:
        runner = stack.enter_context(leased_runner(pool, job.id))
        workspace = stack.enter_context(job_workspace(job.id))
        container = stack.enter_context(started_container(job.image, workspace))
        log.info("job %s running on %s in %s", job.id, runner.name, container)

        for step in job.steps:
            _run_step(container, step, job.step_timeout)

        for path in sorted(p for g in job.artifact_globs for p in workspace.glob(g)):
            artifacts.upload(job.id, path)
    return "passed"


def _run_step(container, step, timeout):
    proc = subprocess.run(
        ["docker", "exec", container, "sh", "-c", step],
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    if proc.returncode != 0:
        raise StepFailed(step, proc.returncode, proc.stdout + proc.stderr)
