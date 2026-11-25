import type { Database, Row } from "./db.ts";

interface Tracked {
    table: string;
    entity: Row;
    snapshot: Row | null; // null until the row exists in the database
}

// Unit of work. Entities loaded or added through a session are tracked, and flush() writes
// back only the columns that changed since the entity was loaded (or last flushed).
export class Session {
    private readonly db: Database;
    private readonly identityMap = new Map<string, Tracked>();

    constructor(db: Database) {
        this.db = db;
    }

    // One object per row per session: asking again returns the same instance without a query.
    get<T extends Row>(table: string, id: string): T | null {
        const key = `${table}:${id}`;
        const tracked = this.identityMap.get(key);
        if (tracked) return tracked.entity as T;
        const row = this.db.select(table, id);
        if (!row) return null;
        this.identityMap.set(key, { table, entity: row, snapshot: this.snapshotOf(row) });
        return row as T;
    }

    add(table: string, entity: Row): void {
        const key = `${table}:${entity.id}`;
        if (this.identityMap.has(key)) throw new Error(`${key} is already in this session`);
        this.identityMap.set(key, { table, entity, snapshot: null });
    }

    private snapshotOf(entity: Row): Row {
        return { ...entity };
    }

    private changedColumns(entity: Row, snapshot: Row): Record<string, unknown> {
        const changes: Record<string, unknown> = {};
        for (const column of Object.keys(entity)) {
            if (entity[column] !== snapshot[column]) changes[column] = entity[column];
        }
        return changes;
    }

    // Returns how many statements were sent.
    flush(): number {
        let statements = 0;
        for (const tracked of this.identityMap.values()) {
            if (tracked.snapshot === null) {
                this.db.insert(tracked.table, tracked.entity);
            } else {
                const changes = this.changedColumns(tracked.entity, tracked.snapshot);
                if (Object.keys(changes).length === 0) continue;
                this.db.update(tracked.table, tracked.entity.id, changes);
            }
            tracked.snapshot = this.snapshotOf(tracked.entity);
            statements++;
        }
        return statements;
    }
}
