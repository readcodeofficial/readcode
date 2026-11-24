from __future__ import annotations

from datetime import datetime
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from billing.models import Invoice, InvoiceStatus


class PaymentRejected(Exception):
    pass


def list_open_invoices(session: Session, customer_id: int) -> list[dict]:
    stmt = (
        select(Invoice)
        .where(Invoice.customer_id == customer_id, Invoice.status != InvoiceStatus.PAID)
        .options(selectinload(Invoice.line_items))
        .order_by(Invoice.due_at)
    )
    invoices = session.scalars(stmt).all()
    return [
        {
            "id": inv.id,
            "balance_cents": inv.balance_cents,
            "lines": [li.description for li in inv.line_items],
        }
        for inv in invoices
    ]


def record_payment(session: Session, invoice_id: int, amount_cents: int, payment_id: str) -> Invoice:
    if amount_cents <= 0:
        raise PaymentRejected("amount must be positive")

    invoice = session.scalars(
        select(Invoice).where(Invoice.id == invoice_id).with_for_update()
    ).one()

    if payment_id in invoice.meta.get("payment_ids", []):
        return invoice
    if amount_cents > invoice.balance_cents:
        raise PaymentRejected("payment exceeds balance")

    invoice.paid_cents += amount_cents
    invoice.meta = {
        **invoice.meta,
        "payment_ids": [*invoice.meta.get("payment_ids", []), payment_id],
    }
    if invoice.balance_cents == 0:
        invoice.status = InvoiceStatus.PAID
    session.commit()
    return invoice


def mark_overdue(session: Session, now: datetime) -> int:
    overdue_ids = session.scalars(
        select(Invoice.id).where(
            Invoice.status == InvoiceStatus.OPEN, Invoice.due_at < now
        )
    ).all()
    for invoice in session.scalars(select(Invoice).where(Invoice.id.in_(overdue_ids))):
        invoice.status = InvoiceStatus.OVERDUE
    session.commit()
    return len(overdue_ids)


def escalate_dunning(session: Session, invoice_ids: Iterable[int]) -> None:
    invoices = session.scalars(
        select(Invoice).where(
            Invoice.id.in_(list(invoice_ids)), Invoice.status == InvoiceStatus.OVERDUE
        )
    ).all()
    for invoice in invoices:
        level = invoice.meta.get("dunning_level", 0)
        invoice.meta["dunning_level"] = level + 1
    session.commit()
