from dataclasses import dataclass
from typing import Protocol

from catalog import Title, TitleCatalog
from ranking import Ranker, ViewerProfile


@dataclass(frozen=True)
class FeedRow:
    key: str
    heading: str
    title_ids: list[str]


class ProgressStore(Protocol):
    def in_progress(self, viewer_id: str, limit: int) -> list[str]: ...


class ContinueWatchingRow:
    def __init__(self, progress: ProgressStore):
        self._progress = progress

    def build(self, profile: ViewerProfile, catalog: TitleCatalog, ranker: Ranker) -> FeedRow:
        return FeedRow("continue", "Continue watching", self._progress.in_progress(profile.viewer_id, 10))


class RecommendedRow:
    def build(self, profile: ViewerProfile, catalog: TitleCatalog, ranker: Ranker) -> FeedRow:
        ranked = ranker.rank(catalog.titles_for_region(profile.region), profile)
        return FeedRow("recommended", "Picked for you", [t.title_id for t in ranked[:20]])


class NewReleasesRow:
    def build(self, profile: ViewerProfile, catalog: TitleCatalog, ranker: Ranker) -> FeedRow:
        newest = catalog.titles_for_region(profile.region)[:10]
        return FeedRow("new", "New this week", [t.title_id for t in newest])


class HomeFeedService:
    def __init__(self, catalog: TitleCatalog, ranker: Ranker, rows: list):
        self._catalog = catalog
        self._ranker = ranker
        self._rows = rows

    def build(self, profile: ViewerProfile) -> list[FeedRow]:
        feed = []
        for row in self._rows:
            built = row.build(profile, self._catalog, self._ranker)
            if built.title_ids:
                feed.append(built)
        return feed


def default_service(catalog: TitleCatalog, ranker: Ranker, progress: ProgressStore) -> HomeFeedService:
    return HomeFeedService(
        catalog, ranker,
        [ContinueWatchingRow(progress), RecommendedRow(), NewReleasesRow()],
    )
