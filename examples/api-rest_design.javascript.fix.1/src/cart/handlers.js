import { cartView } from "./pricing.js";

const MAX_QTY = 99;

function problem(status, code, message) {
  return { status, body: { error: { code, message } } };
}

export function cartHandlers(store, catalog) {
  return {
    getCart({ cartId }) {
      const cart = store.get(cartId);
      if (!cart) return problem(404, "cart_not_found", `no cart ${cartId}`);
      return { status: 200, body: cartView(cart, catalog) };
    },

    putLine({ cartId, sku, body }) {
      if (!catalog.has(sku)) return problem(404, "unknown_sku", `no product ${sku}`);
      const qty = body?.qty;
      if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
        return problem(422, "invalid_qty", `qty must be an integer between 1 and ${MAX_QTY}`);
      }

      const cart = store.getOrCreate(cartId);
      const existing = cart.lines.get(sku);
      cart.lines.set(sku, { sku, qty: existing ? existing.qty + qty : qty });

      if (existing) return { status: 200, body: cartView(cart, catalog) };
      return {
        status: 201,
        headers: { Location: `/carts/${cartId}/lines/${sku}` },
        body: cartView(cart, catalog),
      };
    },

    deleteLine({ cartId, sku }) {
      const cart = store.get(cartId);
      if (!cart) return problem(404, "cart_not_found", `no cart ${cartId}`);
      cart.lines.delete(sku);
      return { status: 204 };
    },
  };
}
