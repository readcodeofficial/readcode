import type { Database } from "./database.ts";

export interface Migration {
    version: number;
    name: string;
    up(db: Database): void | Promise<void>;
}

export interface MigrationStatus {
    id: string;
    state: "applied" | "pending";
}

const LEDGER = "schema_migrations";

export const migrationId = (m: Pick<Migration, "version" | "name">) => `${String(m.version).padStart(4, "0")}_${m.name}`;

// Applies schema migrations in version order. Each migration runs in its own transaction
// together with its row in schema_migrations, so it is recorded only if it fully succeeded.
export class Migrator {
    private readonly db: Database;
    private readonly migrations: Migration[];
    private readonly now: () => Date;

    constructor(db: Database, migrations: Migration[], now: () => Date) {
        const seen = new Set<number>();
        for (const m of migrations) {
            if (seen.has(m.version)) throw new Error(`duplicate migration version ${m.version}`);
            seen.add(m.version);
        }
        this.db = db;
        this.migrations = [...migrations].sort((a, b) => a.version - b.version);
        this.now = now;
    }

    appliedVersions(): number[] {
        if (!this.db.hasTable(LEDGER)) return [];
        return this.db.select(LEDGER).map((r) => r.version as number);
    }

    pending(): Migration[] {
        const applied = this.appliedVersions();
        const latest = applied.length > 0 ? Math.max(...applied) : 0;
        return this.migrations.filter((m) => m.version > latest);
    }

    // Returns the ids of the migrations it applied, in order. Stops at the first failure.
    async migrate(): Promise<string[]> {
        if (!this.db.hasTable(LEDGER)) this.db.createTable(LEDGER, ["version", "name", "applied_at"]);
        const done: string[] = [];
        for (const m of this.pending()) {
            try {
                await this.db.transaction(async (tx) => {
                    await m.up(tx);
                    tx.insert(LEDGER, { version: m.version, name: m.name, applied_at: this.now().toISOString() });
                });
            } catch (err) {
                throw new Error(`migration ${migrationId(m)} failed: ${(err as Error).message}`);
            }
            done.push(migrationId(m));
        }
        return done;
    }

    status(): MigrationStatus[] {
        const pending = new Set(this.pending().map((m) => m.version));
        return this.migrations.map((m) => ({ id: migrationId(m), state: pending.has(m.version) ? "pending" : "applied" }));
    }
}
