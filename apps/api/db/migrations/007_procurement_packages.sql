create table if not exists procurement_packages (
  id text primary key,
  company_id text not null references platform_companies(id) on delete cascade,
  code text not null,
  package_name text not null,
  project_name text not null,
  buyer text not null,
  status text not null check (status in ('draft', 'sourcing', 'awaiting_approval', 'awarded', 'blocked')),
  budget_amount numeric(14,2) not null default 0,
  bid_count integer not null default 0,
  approval_hours numeric(10,2) not null default 0,
  strategic boolean not null default false,
  supplier_contention integer not null default 0,
  next_action text not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (company_id, code)
);

create table if not exists procurement_package_risks (
  id text primary key,
  package_id text not null references procurement_packages(id) on delete cascade,
  title text not null,
  category text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  owner_name text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_procurement_packages_company on procurement_packages(company_id, updated_at desc);
create index if not exists idx_procurement_package_risks_pkg on procurement_package_risks(package_id, severity);
