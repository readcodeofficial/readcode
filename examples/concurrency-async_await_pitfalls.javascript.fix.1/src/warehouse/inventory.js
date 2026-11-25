export class OutOfStock extends Error {
  constructor(sku, wanted, available) {
    super(`out of stock: ${sku} (wanted ${wanted}, have ${available})`);
    this.name = "OutOfStock";
    this.sku = sku;
  }
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

export function createInventory(initial) {
  const stock = new Map(Object.entries(initial));
  return {
    async reserve(sku, qty) {
      await tick();
      const have = stock.get(sku) ?? 0;
      if (have < qty) throw new OutOfStock(sku, qty, have);
      stock.set(sku, have - qty);
      return { sku, qty };
    },
    async release(sku, qty) {
      await tick();
      stock.set(sku, (stock.get(sku) ?? 0) + qty);
    },
    available(sku) {
      return stock.get(sku) ?? 0;
    },
  };
}
