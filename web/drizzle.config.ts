// drizzle-kit config. `npm run db:generate` writes migrations to drizzle/ from lib/db/schema.ts;
// `npm run db:migrate` applies them: to Neon when DATABASE_URL is set (in .env.local or the
// environment), otherwise to the local PGlite database the dev server uses.
import { mkdirSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

try {
    process.loadEnvFile(".env.local");
} catch {
    // no .env.local: use the environment as is
}

const url = process.env.DATABASE_URL;
if (!url) mkdirSync(".data", { recursive: true }); // PGlite doesn't create parent folders

export default defineConfig({
    schema: "./lib/db/schema.ts",
    out: "./drizzle",
    dialect: "postgresql",
    ...(url ? { dbCredentials: { url } } : { driver: "pglite", dbCredentials: { url: ".data/pglite" } }),
});
