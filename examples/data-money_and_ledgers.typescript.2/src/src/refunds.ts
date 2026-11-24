import { Cents } from "./money";
import { PricedLine } from "./pricing";

export interface Order {
  id: string;
  chargeId: string;
  capturedCents: Cents;
  refundedCents: Cents;
  refundCount: number;
  lines: PricedLine[];
}

export interface RefundItem {
  sku: string;
  quantity: number;
}

export interface RefundPlan {
  amountCents: Cents;
  items: { sku: string; quantity: number; amountCents: Cents }[];
}

export interface PaymentGateway {
  refund(chargeId: string, amountCents: Cents, idempotencyKey: string): Promise<{ refundId: string }>;
}

export interface OrderStore {
  recordRefund(orderId: string, plan: RefundPlan, refundId: string): Promise<void>;
  restock(items: { sku: string; quantity: number }[]): Promise<void>;
}

export function planRefund(order: Order, requested: RefundItem[]): RefundPlan {
  const items: RefundPlan["items"] = [];
  const seen = new Set<string>();

  for (const { sku, quantity } of requested) {
    if (seen.has(sku)) throw new Error(`SKU ${sku} listed twice in one refund`);
    seen.add(sku);
    const line = order.lines.find((l) => l.sku === sku);
    if (!line) throw new Error(`SKU ${sku} is not part of order ${order.id}`);
    if (!Number.isInteger(quantity) || quantity <= 0) throw new RangeError("quantity must be positive");
    if (quantity > line.quantity - line.refundedQuantity) {
      throw new RangeError(`cannot refund ${quantity} of ${sku}: not enough unreturned units`);
    }

    const amount = Math.round((line.paidCents * quantity) / line.quantity);
    items.push({ sku, quantity, amountCents: amount });
  }

  const amountCents = items.reduce((sum, item) => sum + item.amountCents, 0);
  if (order.refundedCents + amountCents > order.capturedCents) {
    throw new RangeError("refund exceeds the captured amount");
  }
  return { amountCents, items };
}

export async function refundOrder(
  order: Order,
  requested: RefundItem[],
  gateway: PaymentGateway,
  store: OrderStore,
): Promise<RefundPlan> {
  const plan = planRefund(order, requested);
  const key = `${order.id}:refund:${order.refundCount + 1}`;

  const { refundId } = await gateway.refund(order.chargeId, plan.amountCents, key);
  await store.recordRefund(order.id, plan, refundId);
  await store.restock(plan.items.map(({ sku, quantity }) => ({ sku, quantity })));
  return plan;
}
