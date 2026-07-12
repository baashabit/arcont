import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPostgresPool, closePostgresPool } from "../db/postgres.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../../db/migrations");

async function main() {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query(`
      create table if not exists schema_migrations (
        id text primary key,
        executed_at timestamptz not null default now()
      )
    `);

    const files = (await readdir(migrationsDir))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const alreadyRan = await client.query(
        "select 1 from schema_migrations where id = $1 limit 1",
        [file]
      );

      if (alreadyRan.rowCount) {
        continue;
      }

      const sql = await readFile(path.join(migrationsDir, file), "utf8");

      await client.query("begin");
      await client.query(sql);
      await client.query("insert into schema_migrations (id) values ($1)", [file]);
      await client.query("commit");
    }
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await closePostgresPool();
  }
}

await main();
