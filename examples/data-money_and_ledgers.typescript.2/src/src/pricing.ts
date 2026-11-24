import { allocate, assertCents, Cents } from "./money";

export interface CartLine {
  sku: string;
  quantity: number;
  unitPriceCents: Cents;
}

export interface PricedLine {
  sku: string;
  quantity: number;
  paidCents: Cents;
  refundedQuantity: number;
  refundedCents: Cents;
}

export interface PricedOrder {
  subtotalCents: Cents;
  discountCents: Cents;
  taxCents: Cents;
  totalCents: Cents;
  lines: PricedLine[];
}

export function priceOrder(cart: CartLine[], discountBps: number, taxBps: number): PricedOrder {
  const lineTotals = cart.map((line) => {
    assertCents(line.unitPriceCents, `price of ${line.sku}`);
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new RangeError(`invalid quantity for ${line.sku}`);
    }
    return line.unitPriceCents * line.quantity;
  });

  const subtotalCents = lineTotals.reduce((a, b) => a + b, 0);
  const discountCents = Math.round((subtotalCents * discountBps) / 10_000);
  const discountShares = allocate(discountCents, lineTotals);

  const netPerLine = lineTotals.map((total, i) => total - discountShares[i]);
  const taxCents = Math.round(((subtotalCents - discountCents) * taxBps) / 10_000);
  const taxShares = allocate(taxCents, netPerLine.map((n) => Math.max(n, 1)));

  return {
    subtotalCents,
    discountCents,
    taxCents,
    totalCents: subtotalCents - discountCents + taxCents,
    lines: cart.map((line, i) => ({
      sku: line.sku,
      quantity: line.quantity,
      paidCents: netPerLine[i] + taxShares[i],
      refundedQuantity: 0,
      refundedCents: 0,
    })),
  };
}
