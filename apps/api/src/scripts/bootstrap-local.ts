import { closePostgresPool, getPostgresPool } from "../db/postgres.js";
import { createPostgresPlatformRepository } from "../repositories/platform-repository.js";
import { moduleCatalog } from "../../../../packages/contracts/dist/index.js";

function parseModules(input: string | undefined) {
  if (!input) {
    return [
      "platform.companies",
      "platform.identity",
      "sales.crm",
      "projects.control",
      "projects.daily-log",
      "procurement.purchasing",
      "inventory.warehouse",
      "inventory.receiving",
      "inventory.movements",
      "inventory.equipment",
      "finance.accounting",
      "hr.workforce",
      "compliance.postsale",
      "integrations.field-data",
      ...moduleCatalog.filter((module) => module.scope === "operations" && module.enabledByDefault).map((module) => module.key)
    ];
  }

  return Array.from(
    new Set(
      input
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

async function main() {
  const pool = getPostgresPool();
  const repository = createPostgresPlatformRepository(pool);

  try {
    const companies = await repository.listCompanies();
    const taxId = process.env.ARCONT_BOOTSTRAP_TAX_ID ?? "XAXX010101000";
    const adminEmail = process.env.ARCONT_BOOTSTRAP_ADMIN_EMAIL ?? "admin@arcont.local";

    if (companies.some((company) => company.taxId === taxId)) {
      console.log(`Bootstrap skipped: company with tax ID ${taxId} already exists.`);
      return;
    }

    const result = await repository.saveProvisionedCompany({
      legalName: process.env.ARCONT_BOOTSTRAP_LEGAL_NAME ?? "ARCONT Demo Constructora, S.A. de C.V.",
      tradeName: process.env.ARCONT_BOOTSTRAP_TRADE_NAME ?? "ARCONT Demo",
      taxId,
      countryCode: process.env.ARCONT_BOOTSTRAP_COUNTRY_CODE ?? "MX",
      timezone: process.env.ARCONT_BOOTSTRAP_TIMEZONE ?? "America/Merida",
      locale: process.env.ARCONT_BOOTSTRAP_LOCALE ?? "es-MX",
      currency: process.env.ARCONT_BOOTSTRAP_CURRENCY ?? "MXN",
      fiscalCountry: process.env.ARCONT_BOOTSTRAP_FISCAL_COUNTRY ?? "MX",
      fiscalRegime: process.env.ARCONT_BOOTSTRAP_FISCAL_REGIME ?? "601",
      adminFullName: process.env.ARCONT_BOOTSTRAP_ADMIN_FULL_NAME ?? "Admin ARCONT",
      adminEmail,
      enabledModules: parseModules(process.env.ARCONT_BOOTSTRAP_MODULES)
    });

    console.log("Bootstrap completed.");
    console.log(`Company ID: ${result.company.id}`);
    console.log(`Admin email: ${result.adminUser.email}`);
    console.log(`Temporary password: ${result.temporaryPassword}`);
  } finally {
    await closePostgresPool();
  }
}

await main();
