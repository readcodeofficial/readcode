from datetime import datetime
from decimal import Decimal

from sqlalchemy import ForeignKey, Index, Numeric, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Warehouse(Base):
    __tablename__ = "warehouses"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))


class Product(Base):
    __tablename__ = "products"

    sku: Mapped[str] = mapped_column(String(32), primary_key=True)
    title: Mapped[str] = mapped_column(String(200))


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (Index("ix_orders_customer_placed", "customer_id", "placed_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int]
    status: Mapped[str] = mapped_column(String(20))
    placed_at: Mapped[datetime]
    warehouse_id: Mapped[int] = mapped_column(ForeignKey("warehouses.id"))

    warehouse: Mapped[Warehouse] = relationship(lazy="raise")
    lines: Mapped[list["OrderLine"]] = relationship(
        lazy="raise", order_by="OrderLine.id"
    )


class OrderLine(Base):
    __tablename__ = "order_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    sku: Mapped[str] = mapped_column(ForeignKey("products.sku"))
    quantity: Mapped[int]
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    product: Mapped[Product] = relationship(lazy="raise")


class StockItem(Base):
    __tablename__ = "stock_items"

    warehouse_id: Mapped[int] = mapped_column(
        ForeignKey("warehouses.id"), primary_key=True
    )
    sku: Mapped[str] = mapped_column(ForeignKey("products.sku"), primary_key=True)
    on_hand: Mapped[int]
    reserved: Mapped[int]
