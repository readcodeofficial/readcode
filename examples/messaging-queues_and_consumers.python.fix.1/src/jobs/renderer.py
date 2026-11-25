from typing import Mapping

from .models import RenderError, RenderJob, RenderResult

PAGE_BYTES = 48_000


class InvoiceRenderer:
    def __init__(self, invoices: Mapping[str, list], templates: set):
        self._invoices = invoices
        self._templates = templates

    def __call__(self, job: RenderJob) -> RenderResult:
        if job.template not in self._templates:
            raise RenderError(f"unknown template {job.template!r}")
        lines = self._invoices.get(job.invoice_id)
        if lines is None:
            raise RenderError(f"invoice {job.invoice_id} not found")
        pages = max(1, -(-len(lines) // 30))
        return RenderResult(job.job_id, job.invoice_id, pages, pages * PAGE_BYTES)
