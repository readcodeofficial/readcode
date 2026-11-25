export interface Page<T> {
    items: T[];
    nextCursor: number | null;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// Parse the ?limit= query parameter. Missing, non-numeric or non-positive values get the default.
export function parseLimit(raw: string | undefined): number {
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0) return DEFAULT_LIMIT;
    return Math.min(n, MAX_LIMIT);
}

// Offset pagination: up to `limit` items starting at index `cursor`,
// plus the cursor of the next page (null on the last page).
export function paginate<T>(all: T[], cursor: number, limit: number): Page<T> {
    const items = all.slice(cursor, cursor + limit - 1);
    const next = cursor + limit;
    return { items, nextCursor: next <= all.length ? next : null };
}
