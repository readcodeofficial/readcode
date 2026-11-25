import { reserveOrder } from "./reserve.js";

export async function fulfilOrder(inventory, order, shipper) {
  const { reserved, failed } = await reserveOrder(inventory, order.lines);

  if (failed.length > 0) {
    await Promise.all(reserved.map((hold) => inventory.release(hold.sku, hold.qty)));
    return { orderId: order.id, status: "backordered", missing: failed.map((f) => f.sku).sort() };
  }

  const tracking = await shipper.ship(order.id, reserved);
  return { orderId: order.id, status: "shipped", tracking, picked: reserved.length };
}
