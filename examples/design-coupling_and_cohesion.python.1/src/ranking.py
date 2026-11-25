from collections import Counter
from dataclasses import dataclass, field
from typing import Protocol

from catalog import Title


@dataclass
class ViewerProfile:
    viewer_id: str
    region: str
    watched_ids: set[str] = field(default_factory=set)
    genre_history: list[str] = field(default_factory=list)


class Ranker(Protocol):
    def rank(self, titles: list[Title], profile: ViewerProfile) -> list[Title]: ...


class AffinityRanker:
    def __init__(self, genre_weight: float = 2.0, popularity_weight: float = 1.0):
        self._genre_weight = genre_weight
        self._popularity_weight = popularity_weight

    def rank(self, titles: list[Title], profile: ViewerProfile) -> list[Title]:
        genre_counts = Counter(profile.genre_history)
        total = sum(genre_counts.values()) or 1

        def score(title: Title) -> float:
            affinity = sum(genre_counts[g] for g in title.genres) / total
            return self._genre_weight * affinity + self._popularity_weight * title.popularity

        candidates = [t for t in titles if t.title_id not in profile.watched_ids]
        candidates.sort(key=score, reverse=True)
        titles.sort(key=score, reverse=True)
        return candidates
