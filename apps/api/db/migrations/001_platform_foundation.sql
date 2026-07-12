create extension if not exists pgcrypto;

create table if not exists platform_companies (
  id text primary key,
  external_key text not null unique,
  legal_name text not null,
  trade_name text not null,
  country_code char(2) not null,
  tax_id text not null unique,
  status text not null check (status in ('draft', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists platform_modules (
  module_key text primary key,
  name text not null,
  area text not null,
  scope text not null check (scope in ('platform', 'operations')),
  description text not null,
  enabled_by_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists platform_roles (
  role_key text primary key,
  name text not null,
  scope text not null check (scope in ('platform', 'operations')),
  created_at timestamptz not null default now()
);

create table if not exists platform_role_permissions (
  role_key text not null references platform_roles(role_key) on delete cascade,
  permission_key text not null,
  primary key (role_key, permission_key)
);

create table if not exists platform_users (
  id text primary key,
  company_id text not null references platform_companies(id),
  full_name text not null,
  email text not null unique,
  role_key text not null references platform_roles(role_key),
  status text not null check (status in ('invited', 'active', 'disabled')),
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists platform_company_settings (
  company_id text primary key references platform_companies(id),
  timezone text not null,
  locale text not null,
  currency char(3) not null,
  fiscal_country char(2) not null,
  sat_enabled boolean not null default true,
  fiscal_regime text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists platform_company_modules (
  company_id text not null references platform_companies(id),
  module_key text not null references platform_modules(module_key),
  enabled boolean not null default true,
  activated_at timestamptz not null default now(),
  activated_by text,
  primary key (company_id, module_key)
);

create table if not exists auth_refresh_tokens (
  id text primary key,
  user_id text not null references platform_users(id) on delete cascade,
  company_id text not null references platform_companies(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists audit_events (
  id text primary key,
  company_id text references platform_companies(id),
  actor_user_id text references platform_users(id),
  aggregate_type text not null,
  aggregate_id text not null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_platform_users_company on platform_users(company_id);
create index if not exists idx_platform_company_modules_company on platform_company_modules(company_id);
create index if not exists idx_auth_refresh_tokens_user on auth_refresh_tokens(user_id, created_at desc);
create index if not exists idx_audit_events_company on audit_events(company_id, created_at desc);
