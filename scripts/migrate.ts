import * as dotenv from "dotenv";
import { Pool } from "pg";
import { promises as fs } from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// Load environment variables
dotenv.config({ path: ".env" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

interface Migration {
  id: number;
  name: string;
  executed_at: Date;
}

async function createMigrationsTable() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Migrations table ready");
  } finally {
    client.release();
  }
}

async function getExecutedMigrations(): Promise<string[]> {
  const result = await pool.query<Migration>("SELECT name FROM migrations ORDER BY id");
  return result.rows.map((row) => row.name);
}

async function recordMigration(name: string) {
  await pool.query("INSERT INTO migrations (name) VALUES ($1)", [name]);
}

async function removeMigration(name: string) {
  await pool.query("DELETE FROM migrations WHERE name = $1", [name]);
}

async function getMigrationFiles(): Promise<string[]> {
  const migrationsDir = path.join(__dirname, "migrations");
  try {
    const files = await fs.readdir(migrationsDir);
    return files.filter((f) => f.endsWith(".ts") || f.endsWith(".js")).sort();
  } catch (error) {
    console.error("❌ Migrations directory not found");
    return [];
  }
}

async function migrateUp() {
  console.log("🚀 Running migrations UP...\n");

  await createMigrationsTable();

  const executedMigrations = await getExecutedMigrations();
  const migrationFiles = await getMigrationFiles();

  const pendingMigrations = migrationFiles.filter((file) => !executedMigrations.includes(file));

  if (pendingMigrations.length === 0) {
    console.log("✅ No pending migrations");
    return;
  }

  for (const file of pendingMigrations) {
    console.log(`⏳ Executing: ${file}`);

    const migrationPath = path.join(__dirname, "migrations", file);
    const migration = await import(migrationPath);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await migration.up(client);
      await recordMigration(file);
      await client.query("COMMIT");
      console.log(`✅ Completed: ${file}\n`);
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`❌ Failed: ${file}`);
      console.error(error);
      throw error;
    } finally {
      client.release();
    }
  }

  console.log("✅ All migrations completed successfully!");
}

async function migrateDown() {
  console.log("🔄 Rolling back last migration...\n");

  await createMigrationsTable();

  const executedMigrations = await getExecutedMigrations();

  if (executedMigrations.length === 0) {
    console.log("✅ No migrations to roll back");
    return;
  }

  const lastMigration = executedMigrations[executedMigrations.length - 1];
  console.log(`⏳ Rolling back: ${lastMigration}`);

  const migrationPath = path.join(__dirname, "migrations", lastMigration);
  const migration = await import(migrationPath);

  if (!migration.down) {
    console.error("❌ Migration does not have a down() function");
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await migration.down(client);
    await removeMigration(lastMigration);
    await client.query("COMMIT");
    console.log(`✅ Rolled back: ${lastMigration}\n`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(`❌ Failed to roll back: ${lastMigration}`);
    console.error(error);
    throw error;
  } finally {
    client.release();
  }

  console.log("✅ Rollback completed successfully!");
}

const command = process.argv[2];

async function main() {
  try {
    if (command === "up") {
      await migrateUp();
    } else if (command === "down") {
      await migrateDown();
    } else {
      console.log("Usage: tsx scripts/migrate.ts [up|down]");
      process.exit(1);
    }
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
