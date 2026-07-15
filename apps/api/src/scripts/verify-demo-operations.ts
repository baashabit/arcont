import { closePostgresPool, getPostgresPool } from "../db/postgres.js";

type CountRow = {
  total: string;
};

const tables = [
  "project_portfolio",
  "project_schedule_activities",
  "field_material_requests",
  "procurement_requisitions",
  "procurement_purchase_orders",
  "supplier_master_profiles",
  "accounts_payable_invoices",
  "treasury_payment_runs",
  "document_control_items",
  "quality_inspections",
  "machine_items",
  "inventory_receipts",
  "inventory_movements"
] as const;

async function main() {
  const pool = getPostgresPool();

  try {
    const companyResult = await pool.query<{ id: string; trade_name: string }>(
      "select id, trade_name from platform_companies order by created_at asc limit 1"
    );
    const company = companyResult.rows[0];

    if (!company) {
      throw new Error("No company found. Run db:bootstrap-local first.");
    }

    console.log(`ARCONT demo verification for ${company.trade_name} (${company.id})`);

    for (const table of tables) {
      const result = await pool.query<CountRow>(`select count(*)::text as total from ${table} where company_id = $1`, [
        company.id
      ]);
      console.log(`${table}: ${Number(result.rows[0]?.total ?? 0)}`);
    }
  } finally {
    await closePostgresPool();
  }
}

await main();
