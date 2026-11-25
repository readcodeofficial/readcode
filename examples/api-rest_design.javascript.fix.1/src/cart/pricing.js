export function cartView(cart, catalog) {
  const lines = [...cart.lines.values()]
    .sort((a, b) => a.sku.localeCompare(b.sku))
    .map((line) => {
      const unitCents = catalog.get(line.sku).priceCents;
      return { sku: line.sku, qty: line.qty, unitCents, lineCents: unitCents * line.qty };
    });
  const subtotalCents = lines.reduce((sum, l) => sum + l.lineCents, 0);
  const deliveryCents = lines.length === 0 || subtotalCents >= 5000 ? 0 : 399;
  return { id: cart.id, lines, subtotalCents, deliveryCents, totalCents: subtotalCents + deliveryCents };
}
