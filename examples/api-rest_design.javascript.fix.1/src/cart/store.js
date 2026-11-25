export function createCartStore() {
  const carts = new Map();
  return {
    get(id) {
      return carts.get(id) ?? null;
    },
    getOrCreate(id) {
      let cart = carts.get(id);
      if (!cart) {
        cart = { id, lines: new Map() };
        carts.set(id, cart);
      }
      return cart;
    },
  };
}

export function createCatalog(products) {
  return new Map(Object.entries(products).map(([sku, priceCents]) => [sku, { sku, priceCents }]));
}
