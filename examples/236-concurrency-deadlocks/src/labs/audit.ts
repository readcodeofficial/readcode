import type { Connection, ConnectionPool } from "./pool.ts";

export interface AuditEntry {
    actor: string;
    action: string;
    subject: string;
    at: Date;
}

// HIPAA access/change log for patient records.
export class AuditLog {
    private readonly pool: ConnectionPool;

    constructor(pool: ConnectionPool) {
        this.pool = pool;
    }

    // Writes on the caller's connection, so the entry commits or rolls back with the caller's transaction.
    async write(conn: Connection, entry: AuditEntry): Promise<void> {
        await conn.query("INSERT INTO audit_log", [entry.actor, entry.action, entry.subject, entry.at.toISOString()]);
    }

    // Standalone entry (e.g. a record was viewed): checks out its own connection.
    async record(entry: AuditEntry): Promise<void> {
        await this.pool.withConnection((conn) => this.write(conn, entry));
    }
}
