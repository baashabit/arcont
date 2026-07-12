-- ARCONT platform foundation schema
-- Initial PostgreSQL design for multi-tenant platform and module activation.

create extension if not exists pgcrypto;

create table if not exists platform_companies (
  id uuid primary key default gen_random_uuid(),
  external_key text not null unique,
  legal_name text not null,
  trade_name text not null,
  country_code char(2) not null,
  tax_id text not null,
  status text not null check (status in ('draft', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists platform_modules (
  id uuid primary key default gen_random_uuid(),
  module_key text not null unique,
  name text not null,
  area text not null,
  scope text not null check (scope in ('platform', 'operations')),
  description text not null,
  enabled_by_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists platform_company_modules (
  company_id uuid not null references platform_companies(id),
  module_id uuid not null references platform_modules(id),
  enabled boolean not null default true,
  activated_at timestamptz not null default now(),
  activated_by uuid,
  primary key (company_id, module_id)
);

create table if not exists platform_roles (
  id uuid primary key default gen_random_uuid(),
  role_key text not null unique,
  name text not null,
  scope text not null check (scope in ('platform', 'operations')),
  created_at timestamptz not null default now()
);

create table if not exists platform_role_permissions (
  role_id uuid not null references platform_roles(id) on delete cascade,
  permission_key text not null,
  primary key (role_id, permission_key)
);

create table if not exists platform_users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references platform_companies(id),
  full_name text not null,
  email text not null unique,
  status text not null check (status in ('invited', 'active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists platform_user_roles (
  user_id uuid not null references platform_users(id) on delete cascade,
  role_id uuid not null references platform_roles(id),
  primary key (user_id, role_id)
);

create table if not exists platform_company_settings (
  company_id uuid primary key references platform_companies(id),
  timezone text not null,
  locale text not null,
  currency char(3) not null,
  fiscal_country char(2) not null,
  sat_enabled boolean not null default true,
  fiscal_regime text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references platform_companies(id),
  actor_user_id uuid references platform_users(id),
  aggregate_type text not null,
  aggregate_id text not null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_platform_users_company on platform_users(company_id);
create index if not exists idx_platform_company_modules_company on platform_company_modules(company_id);
create index if not exists idx_audit_events_company on audit_events(company_id, created_at desc);

-- Operations domain starts with company scoping and can later branch into
-- sales, projects, procurement, finance, HR, compliance, and integrations.
create table if not exists operations_workspaces (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references platform_companies(id),
  workspace_key text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (company_id, workspace_key)
);
