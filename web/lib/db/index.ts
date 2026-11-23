// Database connection. With DATABASE_URL set (Neon, in production) it uses Neon's HTTP driver.
// Without it, in development only, it uses PGlite: Postgres running in this process, stored in
// web/.data/pglite, so the app works locally with no database to set up.
// Either way, create the tables first with `npm run db:migrate`.
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type DB = ReturnType<typeof drizzleNeon<typeof schema>>;

export const LOCAL_DB_DIR = ".data/pglite"; // relative to web/; drizzle.config.ts uses the same path

// One connection per server process (dev reloads re-run this module, so keep it on globalThis:
// two PGlite instances on the same directory would corrupt it).
const g = globalThis as unknown as { readcodeDb?: DB };

function createDb(): DB {
    const url = process.env.DATABASE_URL;
    if (url) return drizzleNeon(neon(url), { schema });
    if (process.env.NODE_ENV === "production") {
        throw new Error("DATABASE_URL is not set. Add the Neon connection string to the environment.");
    }
    // required lazily (and synchronously, so `db` can stay a plain object) so production never loads PGlite
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { PGlite } = require("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
    const { drizzle } = require("drizzle-orm/pglite") as typeof import("drizzle-orm/pglite");
    const { mkdirSync } = require("node:fs") as typeof import("node:fs");
    /* eslint-enable @typescript-eslint/no-require-imports */
    mkdirSync(LOCAL_DB_DIR, { recursive: true });
    // Same query API as the Neon driver; only the driver type differs.
    return drizzle(new PGlite(LOCAL_DB_DIR), { schema }) as unknown as DB;
}

// Create or update the local PGlite database's tables from drizzle/. Called at dev-server start
// (instrumentation.ts), so a deleted or reset local database gets its tables back. Neon is
// migrated with `npm run db:migrate` instead.
export async function migrateLocalDb(): Promise<void> {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db as unknown as Parameters<typeof migrate>[0], { migrationsFolder: "drizzle" });
}

// Connects on first use, so importing this module (e.g. while Next.js builds) needs no database.
export const db: DB = new Proxy({} as DB, {
    get(_, prop) {
        g.readcodeDb ??= createDb();
        return Reflect.get(g.readcodeDb, prop, g.readcodeDb);
    },
});
