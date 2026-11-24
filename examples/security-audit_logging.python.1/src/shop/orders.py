from sqlalchemy import select

from shop.audit import record_event
from shop.models import InventoryItem, Order


class PermissionDenied(Exception):
    pass


class OrderStateError(Exception):
    pass


def snapshot(order: Order) -> dict:
    return {
        "status": order.status,
        "total_cents": order.total_cents,
        "cancel_reason": order.cancel_reason,
        "payment_token": order.payment_token,
        "shipping": {"city": order.ship_city, "phone": order.ship_phone},
    }


class OrderService:
    def __init__(self, session):
        self._session = session

    def cancel_order(self, principal, order_id: int, reason: str) -> Order:
        with self._session.begin():
            order = self._locked_order(order_id)
            if order.customer_id != principal.user_id and "orders:cancel_any" not in principal.scopes:
                raise PermissionDenied("cannot cancel another customer's order")
            if order.status not in ("pending", "paid"):
                raise OrderStateError(f"order is {order.status}")

            order.status = "cancelled"
            order.cancel_reason = reason
            before = snapshot(order)

            for line in order.lines:
                item = self._session.get(InventoryItem, line.sku, with_for_update=True)
                item.on_hand += line.quantity

            record_event(
                self._session,
                actor_id=principal.user_id,
                action="order.cancel",
                target_type="order",
                target_id=order.id,
                before=before,
                after=snapshot(order),
            )
        return order

    def refund_order(self, principal, order_id: int, amount_cents: int) -> Order:
        with self._session.begin():
            order = self._locked_order(order_id)
            if "orders:refund" not in principal.scopes:
                raise PermissionDenied("refund scope required")
            if order.status != "paid" or amount_cents > order.total_cents:
                raise OrderStateError("order cannot be refunded for that amount")

            before = snapshot(order)
            order.status = "refunded"
            order.total_cents -= amount_cents

            record_event(
                self._session,
                actor_id=principal.user_id,
                action="order.refund",
                target_type="order",
                target_id=order.id,
                before=before,
                after=snapshot(order),
            )
        return order

    def _locked_order(self, order_id: int) -> Order:
        return self._session.execute(
            select(Order).where(Order.id == order_id).with_for_update()
        ).scalar_one()
