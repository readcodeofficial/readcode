import { fulfilOrder } from "./fulfil.js";

export async function fulfilAll(inventory, orders, shipper) {
  const summary = { shipped: 0, backordered: 0, results: [] };
  for (const order of orders) {
    const result = await fulfilOrder(inventory, order, shipper);
    summary.results.push(result);
    if (result.status === "shipped") summary.shipped += 1;
    else summary.backordered += 1;
  }
  return summary;
}

export function describe(summary) {
  const parts = summary.results.map((r) =>
    r.status === "shipped"
      ? `${r.orderId}: shipped (${r.picked} lines)`
      : `${r.orderId}: backordered [${r.missing.join(", ")}]`,
  );
  return parts.join("\n");
}
