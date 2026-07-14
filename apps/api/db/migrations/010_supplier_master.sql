create table if not exists supplier_master_profiles (
  id text primary key,
  supplier_id text not null,
  company_id text not null references platform_companies(id) on delete cascade,
  supplier_name text not null,
  trade_name text not null,
  rfc text not null,
  fiscal_regime text not null,
  cfdi_use text not null,
  payment_method text not null,
  payment_terms_days integer not null default 0,
  bank_account_masked text not null,
  contact_name text not null,
  contact_email text not null,
  contact_phone text not null,
  compliance_status text not null check (compliance_status in ('complete', 'watch', 'blocked')),
  sat_status text not null check (sat_status in ('controlled', 'watch', 'critical')),
  fiscal_packet_completion numeric(5,2) not null default 0,
  last_validated_at timestamptz,
  next_action text not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (company_id, supplier_id),
  unique (company_id, rfc)
);

create table if not exists supplier_master_risks (
  id text primary key,
  supplier_profile_id text not null references supplier_master_profiles(id) on delete cascade,
  title text not null,
  category text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  owner_name text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_supplier_master_profiles_company on supplier_master_profiles(company_id, updated_at desc);
create index if not exists idx_supplier_master_risks_profile on supplier_master_risks(supplier_profile_id, severity);
