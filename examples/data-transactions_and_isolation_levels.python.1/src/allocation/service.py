import random
import time
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.engine import Engine
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from allocation.models import Allocation, AllocationRequest, StockBin

RETRYABLE_SQLSTATES = {"40001", "40P01"}


class InsufficientStock(Exception):
    def __init__(self, sku: str, wanted: int, found: int):
        super().__init__(f"{sku}: wanted {wanted}, only {found} available")
        self.sku = sku


@dataclass(frozen=True)
class Pick:
    bin_id: int
    quantity: int


def run_in_transaction(engine: Engine, work, attempts: int = 4):
    for attempt in range(1, attempts + 1):
        try:
            with Session(engine) as session, session.begin():
                return work(session)
        except OperationalError as exc:
            sqlstate = getattr(exc.orig, "pgcode", None)
            if sqlstate not in RETRYABLE_SQLSTATES or attempt == attempts:
                raise
            time.sleep(random.uniform(0, 0.05 * 2**attempt))


def allocate_shipment(engine: Engine, shipment_id: str, warehouse: str, sku: str, quantity: int):
    def work(session: Session) -> list[Pick]:
        claimed = session.execute(
            pg_insert(AllocationRequest)
            .values(shipment_id=shipment_id, sku=sku, quantity=quantity)
            .on_conflict_do_nothing(index_elements=["shipment_id"])
            .returning(AllocationRequest.shipment_id)
        ).scalar_one_or_none()
        if claimed is None:
            return _existing_picks(session, shipment_id)

        bins = session.scalars(
            select(StockBin)
            .where(
                StockBin.warehouse == warehouse,
                StockBin.sku == sku,
                StockBin.on_hand > StockBin.reserved,
            )
            .order_by(StockBin.id)
            .with_for_update()
        ).all()

        remaining = quantity
        picks: list[Pick] = []
        for stock_bin in bins:
            take = min(stock_bin.available, remaining)
            if take == 0:
                continue
            stock_bin.reserved += take
            session.add(Allocation(shipment_id=shipment_id, bin_id=stock_bin.id, quantity=take))
            picks.append(Pick(stock_bin.id, take))
            remaining -= take
            if remaining == 0:
                break

        if remaining > 0:
            raise InsufficientStock(sku, quantity, quantity - remaining)
        return picks

    return run_in_transaction(engine, work)


def move_between_bins(engine: Engine, from_bin: int, to_bin: int, quantity: int) -> None:
    def work(session: Session) -> None:
        locked = {
            b.id: b
            for b in session.scalars(
                select(StockBin)
                .where(StockBin.id.in_(sorted({from_bin, to_bin})))
                .order_by(StockBin.id)
                .with_for_update()
            )
        }
        source, target = locked[from_bin], locked[to_bin]
        if source.available < quantity:
            raise InsufficientStock(source.sku, quantity, source.available)
        source.on_hand -= quantity
        target.on_hand += quantity

    run_in_transaction(engine, work)


def warehouse_snapshot(engine: Engine, warehouse: str) -> dict:
    with Session(engine) as session:
        session.connection(
            execution_options={"isolation_level": "REPEATABLE READ", "postgresql_readonly": True}
        )
        bins = session.scalars(select(StockBin).where(StockBin.warehouse == warehouse)).all()
        request_count = session.scalar(select(func.count()).select_from(AllocationRequest))
        allocated = session.scalar(select(func.coalesce(func.sum(Allocation.quantity), 0)))
    return {
        "on_hand": sum(b.on_hand for b in bins),
        "reserved": sum(b.reserved for b in bins),
        "requests": request_count,
        "allocated_all_warehouses": allocated,
    }


def _existing_picks(session: Session, shipment_id: str) -> list[Pick]:
    rows = session.scalars(
        select(Allocation).where(Allocation.shipment_id == shipment_id).order_by(Allocation.bin_id)
    )
    return [Pick(row.bin_id, row.quantity) for row in rows]
