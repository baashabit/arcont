export type CompanyRecord = {
  id: string;
  legalName: string;
  tradeName: string;
  countryCode: string;
  taxId: string;
  status: "draft" | "active" | "suspended";
  enabledModules: string[];
};

export type UserRecord = {
  id: string;
  companyId: string;
  fullName: string;
  email: string;
  roleKey: string;
  status: "invited" | "active" | "disabled";
  passwordHash: string;
};

export type RefreshTokenRecord = {
  id: string;
  userId: string;
  companyId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
  revokedAt?: string;
};

export type SettingsRecord = {
  companyId: string;
  timezone: string;
  locale: string;
  currency: string;
  fiscalCountry: string;
  satEnabled: boolean;
  fiscalRegime: string;
};

export type ProvisionCompanyInput = {
  legalName: string;
  tradeName: string;
  taxId: string;
  countryCode: string;
  timezone: string;
  locale: string;
  currency: string;
  fiscalCountry: string;
  fiscalRegime: string;
  adminFullName: string;
  adminEmail: string;
  enabledModules: string[];
};

export type AuditEventInput = {
  companyId?: string;
  actorUserId?: string;
  aggregateType: string;
  aggregateId: string;
  action: string;
  metadata: Record<string, unknown>;
};
