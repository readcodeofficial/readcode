import type { Migration } from "../db/migrator.ts";
import { Migrator, migrationId } from "../db/migrator.ts";
import type { Database } from "../db/database.ts";

// Schema history for the course platform. New migrations take the next free version number
// when their PR is opened, so they can merge to main in a different order.
export const MIGRATIONS: Migration[] = [
    { version: 1, name: "create_courses", up: (db) => db.createTable("courses", ["id", "title", "published"]) },
    { version: 2, name: "create_enrollments", up: (db) => db.createTable("enrollments", ["course_id", "learner_id", "enrolled_at"]) },
    { version: 3, name: "add_course_language", up: (db) => db.addColumn("courses", "language", "en") },
    { version: 4, name: "add_enrollment_progress", up: (db) => db.addColumn("enrollments", "progress_pct", 0) },
    { version: 5, name: "create_certificates", up: (db) => db.createTable("certificates", ["course_id", "learner_id", "issued_at"]) },
    {
        version: 6,
        name: "add_course_slug",
        up(db) {
            db.addColumn("courses", "slug");
            db.update("courses", (c) => ({ slug: String(c.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") }));
        },
    },
];

// Called on boot. Production runs migrations as a separate deploy step and only checks here.
export async function prepareDatabase(db: Database, opts: { autoMigrate: boolean; now: () => Date; migrations?: Migration[] }) {
    const migrator = new Migrator(db, opts.migrations ?? MIGRATIONS, opts.now);
    if (opts.autoMigrate) return migrator.migrate();
    const pending = migrator.pending();
    if (pending.length > 0) throw new Error(`database schema is behind; pending: ${pending.map(migrationId).join(", ")}`);
    return [];
}
