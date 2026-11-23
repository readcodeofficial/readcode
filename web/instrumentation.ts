// Runs once when the Next.js server starts, before it handles requests.
export async function register() {
    // Local development without DATABASE_URL uses PGlite (lib/db): make sure its tables exist.
    if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.DATABASE_URL || process.env.NODE_ENV === "production") return;
    const { migrateLocalDb } = await import("./lib/db");
    await migrateLocalDb();
}
