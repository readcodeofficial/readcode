from __future__ import annotations

import logging
from dataclasses import dataclass, field
from types import TracebackType
from typing import Callable

log = logging.getLogger("iam.provisioning")


@dataclass
class UndoStack:
    label: str
    _steps: list[tuple[str, Callable[[], None]]] = field(default_factory=list)
    _committed: bool = False

    def push(self, name: str, undo: Callable[[], None]) -> None:
        self._steps.append((name, undo))

    def commit(self) -> None:
        self._committed = True
        self._steps.clear()

    def __enter__(self) -> UndoStack:
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> bool:
        if exc is None or self._committed:
            return False

        failed: list[str] = []
        while self._steps:
            name, undo = self._steps.pop()
            try:
                undo()
            except Exception:
                log.exception("%s: rollback step %r failed", self.label, name)
                failed.append(name)

        if failed:
            exc.add_note(f"{self.label}: rollback incomplete, manual cleanup needed for {', '.join(failed)}")
        return False
