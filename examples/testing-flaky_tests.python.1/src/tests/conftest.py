import pytest

from ci.artifact_cache import ArtifactCache


class FakeClock:
    def __init__(self, start: float = 1_700_000_000.0):
        self.now = start

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


@pytest.fixture
def clock():
    return FakeClock()


@pytest.fixture
def cache(tmp_path, clock):
    return ArtifactCache(tmp_path / "cache", ttl_seconds=60, max_bytes=1_000, clock=clock)
