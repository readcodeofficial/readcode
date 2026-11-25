from sqlalchemy import CheckConstraint, ForeignKey, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class StockBin(Base):
    __tablename__ = "stock_bins"
    __table_args__ = (
        CheckConstraint("reserved >= 0 AND reserved <= on_hand", name="ck_bin_reserved_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    warehouse: Mapped[str] = mapped_column(String(16))
    sku: Mapped[str] = mapped_column(String(32), index=True)
    on_hand: Mapped[int]
    reserved: Mapped[int] = mapped_column(default=0)

    @property
    def available(self) -> int:
        return self.on_hand - self.reserved


class AllocationRequest(Base):
    __tablename__ = "allocation_requests"

    shipment_id: Mapped[str] = mapped_column(String(40), primary_key=True)
    sku: Mapped[str] = mapped_column(String(32))
    quantity: Mapped[int]


class Allocation(Base):
    __tablename__ = "allocations"

    id: Mapped[int] = mapped_column(primary_key=True)
    shipment_id: Mapped[str] = mapped_column(
        ForeignKey("allocation_requests.shipment_id"), index=True
    )
    bin_id: Mapped[int] = mapped_column(ForeignKey("stock_bins.id"))
    quantity: Mapped[int]
