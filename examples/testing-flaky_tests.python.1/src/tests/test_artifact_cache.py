import threading
import time

import pytest

from ci.artifact_cache import ArtifactCache


def test_roundtrip(cache):
    cache.put("build-1", b"payload")
    assert cache.get("build-1") == b"payload"


def test_missing_key_returns_none(cache):
    assert cache.get("nope") is None


@pytest.mark.parametrize(
    "elapsed, expected",
    [(59.9, b"x"), (60, None), (3600, None)],
)
def test_ttl_boundaries(cache, clock, elapsed, expected):
    cache.put("k", b"x")
    clock.advance(elapsed)
    assert cache.get("k") == expected


def test_expired_entry_is_deleted_on_read(cache, clock):
    path = cache.put("k", b"x")
    clock.advance(61)
    cache.get("k")
    assert not path.exists()


def test_put_replaces_existing_entry_and_refreshes_ttl(cache, clock):
    cache.put("k", b"old")
    clock.advance(45)
    cache.put("k", b"new")
    clock.advance(45)
    assert cache.get("k") == b"new"


def test_prune_evicts_least_recently_written(tmp_path):
    cache = ArtifactCache(tmp_path, ttl_seconds=3600, max_bytes=25)
    for name in ("a", "b", "c"):
        cache.put(name, b"x" * 10)
        time.sleep(0.01)
    assert cache.get("a") is None
    assert cache.get("b") == b"x" * 10
    assert cache.get("c") == b"x" * 10


def test_prune_keeps_newest_even_if_oversized(cache, clock):
    cache.put("small", b"x" * 10)
    clock.advance(1)
    cache.put("huge", b"y" * 5_000)
    assert cache.get("small") is None
    assert cache.get("huge") == b"y" * 5_000


def test_concurrent_puts_leave_no_temp_files(cache):
    barrier = threading.Barrier(4)

    def worker(i):
        barrier.wait()
        cache.put(f"key-{i}", b"z" * 10)

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(4)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    leftovers = [p.name for p in cache.root.iterdir() if p.suffix == ".tmp"]
    assert leftovers == []
