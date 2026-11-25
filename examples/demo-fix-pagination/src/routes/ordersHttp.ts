import { listOrders, type Order } from "./listOrders.ts";

export interface HttpResponse {
    status: number;
    headers: Record<string, string>;
    body: unknown;
}

// GET /orders as served over HTTP: strict cursor validation, plus a Link header
// pointing at the next page so clients don't build cursors themselves.
export function handleListOrders(orders: Order[], query: Record<string, string | undefined>): HttpResponse {
    if (query.cursor !== undefined && !/^\d+$/.test(query.cursor)) {
        return { status: 400, headers: {}, body: { error: "cursor must be a non-negative integer" } };
    }
    const page = listOrders(orders, { cursor: query.cursor, limit: query.limit });

    const headers: Record<string, string> = { "X-Total-Count": String(orders.length) };
    if (page.nextCursor !== null) {
        const next = new URLSearchParams({ cursor: String(page.nextCursor), ...(query.limit ? { limit: query.limit } : {}) });
        headers.Link = `</orders?${next}>; rel="next"`;
    }
    return { status: 200, headers, body: { items: page.items, nextCursor: page.nextCursor } };
}
