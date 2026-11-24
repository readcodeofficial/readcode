from dataclasses import dataclass
from decimal import Decimal
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from .models import Order, StockItem

SKU_CHUNK_SIZE = 500
DEFAULT_LIMIT = 50
MAX_LIMIT = 200


@dataclass(frozen=True)
class LineView:
    sku: str
    quantity: int
    unit_price: Decimal
    in_stock: bool


@dataclass(frozen=True)
class OrderView:
    order_id: int
    status: str
    warehouse_name: str
    total: Decimal
    lines: list[LineView]


def load_recent_orders(session: Session, customer_id: int, limit: int) -> list[Order]:
    stmt = (
        select(Order)
        .where(Order.customer_id == customer_id)
        .options(joinedload(Order.warehouse), selectinload(Order.lines))
        .order_by(Order.placed_at.desc(), Order.id.desc())
        .limit(limit)
    )
    return list(session.scalars(stmt).all())


def load_available(
    session: Session, warehouse_ids: list[int], skus: Iterable[str]
) -> dict[tuple[int, str], int]:
    available: dict[tuple[int, str], int] = {}
    sku_list = sorted(set(skus))
    for start in range(0, len(sku_list), SKU_CHUNK_SIZE):
        chunk = sku_list[start : start + SKU_CHUNK_SIZE]
        rows = session.execute(
            select(
                StockItem.warehouse_id,
                StockItem.sku,
                StockItem.on_hand - StockItem.reserved,
            ).where(
                StockItem.warehouse_id.in_(warehouse_ids),
                StockItem.sku.in_(chunk),
            )
        )
        for warehouse_id, sku, free in rows:
            available[(warehouse_id, sku)] = max(free, 0)
    return available


def recent_order_views(
    session: Session, customer_id: int, limit: int = DEFAULT_LIMIT
) -> list[OrderView]:
    limit = max(1, min(limit, MAX_LIMIT))
    orders = load_recent_orders(session, customer_id, limit)

    warehouse_ids = sorted({order.warehouse_id for order in orders})
    skus = [line.sku for order in orders for line in order.lines]
    available = load_available(session, warehouse_ids, skus)

    views: list[OrderView] = []
    for order in orders:
        lines = [
            LineView(
                sku=line.sku,
                quantity=line.quantity,
                unit_price=line.unit_price,
                in_stock=available.get((order.warehouse_id, line.sku), 0)
                >= line.quantity,
            )
            for line in order.lines
        ]
        total = sum((l.quantity * l.unit_price for l in lines), Decimal("0"))
        views.append(
            OrderView(
                order_id=order.id,
                status=order.status,
                warehouse_name=order.warehouse.name,
                total=total,
                lines=lines,
            )
        )
    return views
