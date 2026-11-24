import os
import time
from pathlib import Path
from typing import Callable


class ArtifactCache:
    def __init__(self, root: Path, *, ttl_seconds: float, max_bytes: int, clock: Callable[[], float] = time.time):
        self.root = Path(root)
        self.ttl_seconds = ttl_seconds
        self.max_bytes = max_bytes
        self._clock = clock
        self.root.mkdir(parents=True, exist_ok=True)

    def put(self, key: str, data: bytes) -> Path:
        path = self.root / key
        tmp = path.with_suffix(".tmp")
        tmp.write_bytes(data)
        os.replace(tmp, path)
        now = self._clock()
        os.utime(path, (now, now))
        self._prune()
        return path

    def get(self, key: str) -> bytes | None:
        path = self.root / key
        try:
            age = self._clock() - path.stat().st_mtime
        except FileNotFoundError:
            return None
        if age >= self.ttl_seconds:
            path.unlink(missing_ok=True)
            return None
        return path.read_bytes()

    def _entries(self):
        return sorted(
            (p for p in self.root.iterdir() if p.suffix != ".tmp"),
            key=lambda p: (p.stat().st_mtime, p.name),
        )

    def _prune(self) -> None:
        entries = self._entries()
        total = sum(p.stat().st_size for p in entries)
        while total > self.max_bytes and len(entries) > 1:
            oldest = entries.pop(0)
            total -= oldest.stat().st_size
            oldest.unlink()
