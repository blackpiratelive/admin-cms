import { migrate } from "drizzle-orm/libsql/migrator";
import { db } from "./index";

export async function runMigrations() {
  try {
    await migrate(db, { migrationsFolder: "./src/db/migrations" });
    console.log("Migrations applied successfully.");
  } catch (error) {
    console.error("Failed to run migrations:", error);
    throw error;
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
