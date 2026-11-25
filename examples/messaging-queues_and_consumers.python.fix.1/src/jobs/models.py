from dataclasses import dataclass


@dataclass(frozen=True)
class RenderJob:
    job_id: str
    invoice_id: str
    template: str = "standard"


@dataclass(frozen=True)
class RenderResult:
    job_id: str
    invoice_id: str
    pages: int
    size_bytes: int


class RenderError(Exception):
    """A job that cannot be rendered, for a reason retrying will not fix."""
