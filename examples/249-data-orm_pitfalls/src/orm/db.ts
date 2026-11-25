// In-memory table store standing in for the database. Rows are copied in and out, like a
// real driver, so nothing outside the store shares objects with it.
export type Row = { id: string } & Record<string, unknown>;

export interface Statement {
    kind: "select" | "insert" | "update";
    table: string;
    id: string;
    columns?: string[];
}

export class Database {
    private readonly tables = new Map<string, Map<string, Row>>();
    readonly log: Statement[] = [];

    private table(name: string): Map<string, Row> {
        let t = this.tables.get(name);
        if (!t) {
            t = new Map();
            this.tables.set(name, t);
        }
        return t;
    }

    select(table: string, id: string): Row | null {
        this.log.push({ kind: "select", table, id });
        const row = this.table(table).get(id);
        return row ? structuredClone(row) : null;
    }

    insert(table: string, row: Row): void {
        if (this.table(table).has(row.id)) throw new Error(`duplicate key ${table}/${row.id}`);
        this.log.push({ kind: "insert", table, id: row.id });
        this.table(table).set(row.id, structuredClone(row));
    }

    // UPDATE <table> SET <changed columns> WHERE id = ?
    update(table: string, id: string, changes: Record<string, unknown>): void {
        const current = this.table(table).get(id);
        if (!current) throw new Error(`no row ${table}/${id}`);
        this.log.push({ kind: "update", table, id, columns: Object.keys(changes) });
        this.table(table).set(id, { ...current, ...structuredClone(changes) });
    }
}
