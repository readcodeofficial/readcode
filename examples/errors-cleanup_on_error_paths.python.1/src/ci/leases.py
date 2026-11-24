import logging
import shutil
import subprocess
import tempfile
from contextlib import contextmanager
from pathlib import Path

log = logging.getLogger(__name__)


class RunnerLost(Exception):
    pass


@contextmanager
def leased_runner(pool, job_id):
    runner = pool.acquire(job_id)
    try:
        yield runner
    except RunnerLost:
        pool.discard(runner)
        raise
    pool.release(runner)


@contextmanager
def job_workspace(job_id):
    path = Path(tempfile.mkdtemp(prefix=f"job-{job_id}-"))
    try:
        yield path
    finally:
        shutil.rmtree(path, ignore_errors=True)


def _docker(*args):
    result = subprocess.run(["docker", *args], capture_output=True, text=True, timeout=60, check=True)
    return result.stdout.strip()


@contextmanager
def started_container(image, workspace):
    container_id = _docker("run", "-d", "--rm", "-v", f"{workspace}:/work", "-w", "/work", image, "sleep", "infinity")
    try:
        yield container_id
    finally:
        try:
            _docker("rm", "-f", container_id)
        except (subprocess.SubprocessError, OSError):
            log.exception("could not remove container %s", container_id)
