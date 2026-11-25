import { listOrders, type Order } from "./routes/listOrders.ts";

const MAX_PAGES = 10_000; // guard against a cursor that never ends

const dollars = (cents: number) => `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;

// Nightly finance export: every order exactly once, newest first, as CSV.
// Uses the same pagination as the public API, page by page.
export function exportOrdersCsv(orders: Order[], pageSize = 100): string {
    const rows = ["id,created_at,total"];
    let cursor: number | null = 0;
    let pages = 0;
    while (cursor !== null) {
        if (++pages > MAX_PAGES) throw new Error("export did not finish: pagination never ended");
        const page = listOrders(orders, { cursor: String(cursor), limit: String(pageSize) });
        for (const o of page.items) rows.push(`${o.id},${o.createdAt},${dollars(o.totalCents)}`);
        cursor = page.nextCursor;
    }
    return rows.join("\n") + "\n";
}
