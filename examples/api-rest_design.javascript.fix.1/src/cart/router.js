import { cartHandlers } from "./handlers.js";

const LINE = /^\/carts\/([^/]+)\/lines\/([^/]+)$/;
const CART = /^\/carts\/([^/]+)$/;

function parseBody(raw) {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function makeRouter(store, catalog) {
  const h = cartHandlers(store, catalog);
  return function route({ method, path, rawBody }) {
    let m = LINE.exec(path);
    if (m) {
      const args = { cartId: m[1], sku: m[2], body: parseBody(rawBody) };
      if (method === "PUT") return h.putLine(args);
      if (method === "DELETE") return h.deleteLine(args);
      return { status: 405, headers: { Allow: "PUT, DELETE" }, body: { error: { code: "method_not_allowed" } } };
    }
    m = CART.exec(path);
    if (m) {
      if (method === "GET") return h.getCart({ cartId: m[1] });
      return { status: 405, headers: { Allow: "GET" }, body: { error: { code: "method_not_allowed" } } };
    }
    return { status: 404, body: { error: { code: "no_route" } } };
  };
}
