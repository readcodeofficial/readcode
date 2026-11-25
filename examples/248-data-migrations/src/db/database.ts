export type Row = Record<string, unknown>;

interface Table {
    columns: string[];
    rows: Row[];
}

// Tiny in-memory relational store. Like Postgres, schema changes are transactional: if a
// transaction throws, neither its DDL nor its data changes are kept.
export class Database {
    private tables = new Map<string, Table>();

    hasTable(name: string): boolean {
        return this.tables.has(name);
    }

    columns(table: string): string[] {
        return [...this.table(table).columns];
    }

    createTable(name: string, columns: string[]): void {
        if (this.tables.has(name)) throw new Error(`relation "${name}" already exists`);
        this.tables.set(name, { columns: [...columns], rows: [] });
    }

    addColumn(table: string, column: string, defaultValue: unknown = null): void {
        const t = this.table(table);
        if (t.columns.includes(column)) throw new Error(`column "${column}" of relation "${table}" already exists`);
        t.columns.push(column);
        for (const row of t.rows) row[column] = defaultValue;
    }

    insert(table: string, row: Row): void {
        const t = this.table(table);
        const unknown = Object.keys(row).filter((c) => !t.columns.includes(c));
        if (unknown.length) throw new Error(`column "${unknown[0]}" of relation "${table}" does not exist`);
        t.rows.push(Object.fromEntries(t.columns.map((c) => [c, row[c] ?? null])));
    }

    select(table: string, where: (row: Row) => boolean = () => true): Row[] {
        return this.table(table).rows.filter(where).map((r) => ({ ...r }));
    }

    update(table: string, change: (row: Row) => Row): void {
        const t = this.table(table);
        t.rows = t.rows.map((r) => ({ ...r, ...change({ ...r }) }));
    }

    async transaction(fn: (tx: Database) => void | Promise<void>): Promise<void> {
        const tx = new Database();
        tx.tables = structuredClone(this.tables);
        await fn(tx);
        this.tables = tx.tables;
    }

    private table(name: string): Table {
        const t = this.tables.get(name);
        if (!t) throw new Error(`relation "${name}" does not exist`);
        return t;
    }
}
