export type Row = Record<string, string | number | null>;

export interface Query {
    where: Row; // column = value, all must match
    orderBy?: { column: string; direction: "asc" | "desc" };
    limit?: number;
}

// Thin wrapper over the SQL client: select builds SELECT ... WHERE ... ORDER BY ... LIMIT.
export interface Db {
    insert(table: string, row: Row): Promise<void>;
    select(table: string, query: Query): Promise<Row[]>;
}
