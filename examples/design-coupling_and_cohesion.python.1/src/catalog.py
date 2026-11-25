import time
from dataclasses import dataclass
from datetime import datetime
from typing import Callable, Protocol


@dataclass(frozen=True)
class Title:
    title_id: str
    name: str
    genres: tuple[str, ...]
    released_at: datetime
    regions: frozenset[str]
    popularity: float


class TitleSource(Protocol):
    def fetch_region(self, region: str) -> list[Title]: ...


class TitleCatalog:
    """Regional catalog, kept newest-first, cached per region."""

    def __init__(self, source: TitleSource, ttl_seconds: float = 300.0,
                 clock: Callable[[], float] = time.monotonic):
        self._source = source
        self._ttl = ttl_seconds
        self._clock = clock
        self._cache: dict[str, tuple[float, list[Title]]] = {}

    def titles_for_region(self, region: str) -> list[Title]:
        entry = self._cache.get(region)
        now = self._clock()
        if entry is not None and now - entry[0] < self._ttl:
            return entry[1]
        titles = sorted(self._source.fetch_region(region), key=lambda t: t.released_at, reverse=True)
        self._cache[region] = (now, titles)
        return titles

    def invalidate(self, region: str | None = None) -> None:
        if region is None:
            self._cache.clear()
        else:
            self._cache.pop(region, None)
