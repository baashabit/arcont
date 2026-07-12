import { Pool } from "pg";
import { env } from "../config/env.js";

let pool: Pool | undefined;

export function getPostgresPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: env.ARCONT_DATABASE_URL
    });
  }

  return pool;
}

export async function closePostgresPool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
