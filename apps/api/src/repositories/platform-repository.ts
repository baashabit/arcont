import type { Pool, PoolClient } from "pg";
import {
  defaultRoles,
  moduleCatalog
} from "../../../../packages/contracts/dist/index.js";
import type {
  AuditEventInput,
  CompanyRecord,
  ProvisionCompanyInput,
  RefreshTokenRecord,
  SettingsRecord,
  UserRecord
} from "../domain/platform/entities.js";
import { createPrefixedId } from "../lib/ids.js";
import { generateTemporaryPassword, hashPassword } from "../lib/passwords.js";

export type PlatformRepository = {
  listCompanies(): Promise<CompanyRecord[]>;
  listModules(): Promise<typeof moduleCatalog>;
  listRoles(): Promise<typeof defaultRoles>;
  listUsers(companyId?: string): Promise<UserRecord[]>;
  getCompanyById(companyId: string): Promise<CompanyRecord | undefined>;
  getUserByEmail(email: string): Promise<UserRecord | undefined>;
  getSettings(companyId: string): Promise<SettingsRecord | undefined>;
  saveProvisionedCompany(input: ProvisionCompanyInput): Promise<{
    company: CompanyRecord;
    adminUser: UserRecord;
    settings: SettingsRecord;
    temporaryPassword: string;
  }>;
  saveRefreshToken(input: Omit<RefreshTokenRecord, "id" | "createdAt">): Promise<RefreshTokenRecord>;
  addAuditEvent(event: AuditEventInput): Promise<void>;
};

function createSeedState() {
  const companies: CompanyRecord[] = [
    {
      id: "cmp_arcont_demo",
      legalName: "ARCONT Demo Constructora, S.A. de C.V.",
      tradeName: "ARCONT Demo",
      countryCode: "MX",
      taxId: "ADC240101AAA",
      status: "active",
      enabledModules: [
        "platform.companies",
        "platform.identity",
        "sales.crm",
        "projects.control",
        "procurement.purchasing",
        "inventory.warehouse",
        "finance.accounting"
      ]
    },
    {
      id: "cmp_bienestar_gov",
      legalName: "Infraestructura Bienestar del Sureste, S.A.P.I. de C.V.",
      tradeName: "Bienestar Sureste",
      countryCode: "MX",
      taxId: "IBS240101BBB",
      status: "active",
      enabledModules: [
        "platform.companies",
        "platform.identity",
        "projects.control",
        "procurement.purchasing",
        "inventory.warehouse",
        "hr.workforce",
        "integrations.field-data"
      ]
    }
  ];

  const users: UserRecord[] = [
    {
      id: "usr_platform_owner",
      companyId: "cmp_arcont_demo",
      fullName: "Angel Platform Owner",
      email: "admin@arcont.local",
      roleKey: "platform-owner",
      status: "active",
      passwordHash: hashPassword("password123")
    },
    {
      id: "usr_ops_manager",
      companyId: "cmp_bienestar_gov",
      fullName: "Daniel Obra",
      email: "obra@arcont.local",
      roleKey: "operations-manager",
      status: "active",
      passwordHash: hashPassword("password123")
    }
  ];

  const settings: SettingsRecord[] = [
    {
      companyId: "cmp_arcont_demo",
      timezone: "America/Merida",
      locale: "es-MX",
      currency: "MXN",
      fiscalCountry: "MX",
      satEnabled: true,
      fiscalRegime: "601"
    },
    {
      companyId: "cmp_bienestar_gov",
      timezone: "America/Mexico_City",
      locale: "es-MX",
      currency: "MXN",
      fiscalCountry: "MX",
      satEnabled: true,
      fiscalRegime: "603"
    }
  ];

  const refreshTokens: RefreshTokenRecord[] = [];
  const auditEvents: Array<AuditEventInput & { id: string }> = [];

  return {
    companies,
    users,
    settings,
    refreshTokens,
    auditEvents
  };
}

export function createInMemoryPlatformRepository(): PlatformRepository {
  const state = createSeedState();

  return {
    async listCompanies() {
      return state.companies;
    },
    async listModules() {
      return moduleCatalog;
    },
    async listRoles() {
      return defaultRoles;
    },
    async listUsers(companyId?: string) {
      if (!companyId) {
        return state.users;
      }

      return state.users.filter((user) => user.companyId === companyId);
    },
    async getCompanyById(companyId: string) {
      return state.companies.find((company) => company.id === companyId);
    },
    async getUserByEmail(email: string) {
      return state.users.find((user) => user.email === email);
    },
    async getSettings(companyId: string) {
      return state.settings.find((item) => item.companyId === companyId);
    },
    async saveProvisionedCompany(input: ProvisionCompanyInput) {
      const company: CompanyRecord = {
        id: createPrefixedId("cmp"),
        legalName: input.legalName,
        tradeName: input.tradeName,
        countryCode: input.countryCode,
        taxId: input.taxId,
        status: "active",
        enabledModules: Array.from(new Set(input.enabledModules))
      };

      const temporaryPassword = generateTemporaryPassword();
      const adminUser: UserRecord = {
        id: createPrefixedId("usr"),
        companyId: company.id,
        fullName: input.adminFullName,
        email: input.adminEmail,
        roleKey: "company-admin",
        status: "active",
        passwordHash: hashPassword(temporaryPassword)
      };

      const settings: SettingsRecord = {
        companyId: company.id,
        timezone: input.timezone,
        locale: input.locale,
        currency: input.currency,
        fiscalCountry: input.fiscalCountry,
        satEnabled: input.fiscalCountry === "MX",
        fiscalRegime: input.fiscalRegime
      };

      state.companies.push(company);
      state.users.push(adminUser);
      state.settings.push(settings);

      await this.addAuditEvent({
        companyId: company.id,
        actorUserId: adminUser.id,
        aggregateType: "company",
        aggregateId: company.id,
        action: "platform.company.provisioned",
        metadata: {
          enabledModules: company.enabledModules
        }
      });

      return {
        company,
        adminUser,
        settings,
        temporaryPassword
      };
    },
    async saveRefreshToken(input) {
      const record: RefreshTokenRecord = {
        id: createPrefixedId("rtk"),
        createdAt: new Date().toISOString(),
        ...input
      };

      state.refreshTokens.push(record);
      return record;
    },
    async addAuditEvent(event) {
      state.auditEvents.push({
        id: createPrefixedId("aud"),
        ...event
      });
    }
  };
}

function mapCompanyRow(row: Record<string, string | string[]>) {
  return {
    id: String(row.id),
    legalName: String(row.legal_name),
    tradeName: String(row.trade_name),
    countryCode: String(row.country_code),
    taxId: String(row.tax_id),
    status: row.status as CompanyRecord["status"],
    enabledModules: (row.enabled_modules as string[]) ?? []
  };
}

function mapUserRow(row: Record<string, string>) {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    fullName: String(row.full_name),
    email: String(row.email),
    roleKey: String(row.role_key),
    status: row.status as UserRecord["status"],
    passwordHash: String(row.password_hash)
  };
}

function mapSettingsRow(row: Record<string, string | boolean>) {
  return {
    companyId: String(row.company_id),
    timezone: String(row.timezone),
    locale: String(row.locale),
    currency: String(row.currency),
    fiscalCountry: String(row.fiscal_country),
    satEnabled: Boolean(row.sat_enabled),
    fiscalRegime: String(row.fiscal_regime)
  };
}

async function seedCatalogs(client: PoolClient) {
  for (const module of moduleCatalog) {
    await client.query(
      `
        insert into platform_modules (module_key, name, area, scope, description, enabled_by_default)
        values ($1, $2, $3, $4, $5, $6)
        on conflict (module_key) do update
          set name = excluded.name,
              area = excluded.area,
              scope = excluded.scope,
              description = excluded.description,
              enabled_by_default = excluded.enabled_by_default
      `,
      [module.key, module.name, module.area, module.scope, module.description, module.enabledByDefault]
    );
  }

  for (const role of defaultRoles) {
    await client.query(
      `
        insert into platform_roles (role_key, name, scope)
        values ($1, $2, $3)
        on conflict (role_key) do update
          set name = excluded.name,
              scope = excluded.scope
      `,
      [role.key, role.name, role.scope]
    );

    await client.query("delete from platform_role_permissions where role_key = $1", [role.key]);

    for (const permission of role.permissions) {
      await client.query(
        `
          insert into platform_role_permissions (role_key, permission_key)
          values ($1, $2)
          on conflict do nothing
        `,
        [role.key, permission]
      );
    }
  }
}

export function createPostgresPlatformRepository(pool: Pool): PlatformRepository {
  return {
    async listCompanies() {
      const result = await pool.query(
        `
          select
            c.id,
            c.legal_name,
            c.trade_name,
            c.country_code,
            c.tax_id,
            c.status,
            coalesce(array_agg(cm.module_key order by cm.module_key) filter (where cm.enabled), '{}') as enabled_modules
          from platform_companies c
          left join platform_company_modules cm on cm.company_id = c.id
          where c.deleted_at is null
          group by c.id, c.legal_name, c.trade_name, c.country_code, c.tax_id, c.status
          order by c.trade_name
        `
      );

      return result.rows.map(mapCompanyRow);
    },
    async listModules() {
      return moduleCatalog;
    },
    async listRoles() {
      return defaultRoles;
    },
    async listUsers(companyId?: string) {
      const result = companyId
        ? await pool.query(
            `
              select id, company_id, full_name, email, role_key, status, password_hash
              from platform_users
              where deleted_at is null and company_id = $1
              order by full_name
            `,
            [companyId]
          )
        : await pool.query(
            `
              select id, company_id, full_name, email, role_key, status, password_hash
              from platform_users
              where deleted_at is null
              order by full_name
            `
          );

      return result.rows.map(mapUserRow);
    },
    async getCompanyById(companyId: string) {
      const result = await pool.query(
        `
          select
            c.id,
            c.legal_name,
            c.trade_name,
            c.country_code,
            c.tax_id,
            c.status,
            coalesce(array_agg(cm.module_key order by cm.module_key) filter (where cm.enabled), '{}') as enabled_modules
          from platform_companies c
          left join platform_company_modules cm on cm.company_id = c.id
          where c.id = $1 and c.deleted_at is null
          group by c.id, c.legal_name, c.trade_name, c.country_code, c.tax_id, c.status
        `,
        [companyId]
      );

      return result.rows[0] ? mapCompanyRow(result.rows[0]) : undefined;
    },
    async getUserByEmail(email: string) {
      const result = await pool.query(
        `
          select id, company_id, full_name, email, role_key, status, password_hash
          from platform_users
          where email = $1 and deleted_at is null
          limit 1
        `,
        [email]
      );

      return result.rows[0] ? mapUserRow(result.rows[0]) : undefined;
    },
    async getSettings(companyId: string) {
      const result = await pool.query(
        `
          select company_id, timezone, locale, currency, fiscal_country, sat_enabled, fiscal_regime
          from platform_company_settings
          where company_id = $1
          limit 1
        `,
        [companyId]
      );

      return result.rows[0] ? mapSettingsRow(result.rows[0]) : undefined;
    },
    async saveProvisionedCompany(input) {
      const client = await pool.connect();

      try {
        await client.query("begin");
        await seedCatalogs(client);

        const company: CompanyRecord = {
          id: createPrefixedId("cmp"),
          legalName: input.legalName,
          tradeName: input.tradeName,
          countryCode: input.countryCode,
          taxId: input.taxId,
          status: "active",
          enabledModules: Array.from(new Set(input.enabledModules))
        };

        const temporaryPassword = generateTemporaryPassword();
        const adminUser: UserRecord = {
          id: createPrefixedId("usr"),
          companyId: company.id,
          fullName: input.adminFullName,
          email: input.adminEmail,
          roleKey: "company-admin",
          status: "active",
          passwordHash: hashPassword(temporaryPassword)
        };

        const settings: SettingsRecord = {
          companyId: company.id,
          timezone: input.timezone,
          locale: input.locale,
          currency: input.currency,
          fiscalCountry: input.fiscalCountry,
          satEnabled: input.fiscalCountry === "MX",
          fiscalRegime: input.fiscalRegime
        };

        await client.query(
          `
            insert into platform_companies
              (id, external_key, legal_name, trade_name, country_code, tax_id, status)
            values ($1, $2, $3, $4, $5, $6, $7)
          `,
          [company.id, company.id, company.legalName, company.tradeName, company.countryCode, company.taxId, company.status]
        );

        await client.query(
          `
            insert into platform_users
              (id, company_id, full_name, email, role_key, status, password_hash)
            values ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            adminUser.id,
            adminUser.companyId,
            adminUser.fullName,
            adminUser.email,
            adminUser.roleKey,
            adminUser.status,
            adminUser.passwordHash
          ]
        );

        await client.query(
          `
            insert into platform_company_settings
              (company_id, timezone, locale, currency, fiscal_country, sat_enabled, fiscal_regime)
            values ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            settings.companyId,
            settings.timezone,
            settings.locale,
            settings.currency,
            settings.fiscalCountry,
            settings.satEnabled,
            settings.fiscalRegime
          ]
        );

        for (const moduleKey of company.enabledModules) {
          await client.query(
            `
              insert into platform_company_modules
                (company_id, module_key, enabled, activated_by)
              values ($1, $2, true, $3)
              on conflict (company_id, module_key) do update
                set enabled = excluded.enabled,
                    activated_by = excluded.activated_by
            `,
            [company.id, moduleKey, adminUser.id]
          );
        }

        await client.query(
          `
            insert into audit_events
              (id, company_id, actor_user_id, aggregate_type, aggregate_id, action, metadata)
            values ($1, $2, $3, $4, $5, $6, $7::jsonb)
          `,
          [
            createPrefixedId("aud"),
            company.id,
            adminUser.id,
            "company",
            company.id,
            "platform.company.provisioned",
            JSON.stringify({ enabledModules: company.enabledModules })
          ]
        );

        await client.query("commit");

        return {
          company,
          adminUser,
          settings,
          temporaryPassword
        };
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
    async saveRefreshToken(input) {
      const record: RefreshTokenRecord = {
        id: createPrefixedId("rtk"),
        createdAt: new Date().toISOString(),
        ...input
      };

      await pool.query(
        `
          insert into auth_refresh_tokens
            (id, user_id, company_id, token_hash, expires_at, created_at, revoked_at)
          values ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          record.id,
          record.userId,
          record.companyId,
          record.tokenHash,
          record.expiresAt,
          record.createdAt,
          record.revokedAt ?? null
        ]
      );

      return record;
    },
    async addAuditEvent(event) {
      await pool.query(
        `
          insert into audit_events
            (id, company_id, actor_user_id, aggregate_type, aggregate_id, action, metadata)
          values ($1, $2, $3, $4, $5, $6, $7::jsonb)
        `,
        [
          createPrefixedId("aud"),
          event.companyId ?? null,
          event.actorUserId ?? null,
          event.aggregateType,
          event.aggregateId,
          event.action,
          JSON.stringify(event.metadata)
        ]
      );
    }
  };
}
