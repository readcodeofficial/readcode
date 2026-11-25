import { paginate, parseLimit, type Page } from "../pagination.ts";

export interface Order {
    id: string;
    createdAt: string; // ISO timestamp
    totalCents: number;
}

// GET /orders?cursor=<n>&limit=<n>  — newest orders first
export function listOrders(orders: Order[], query: { cursor?: string; limit?: string }): Page<Order> {
    const newestFirst = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const cursor = Math.max(0, Number(query.cursor ?? 0) || 0);
    return paginate(newestFirst, cursor, parseLimit(query.limit));
}
