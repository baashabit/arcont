create table if not exists supplier_control_lines (
  id text primary key,
  supplier_id text not null,
  company_id text not null references platform_companies(id) on delete cascade,
  supplier_name text not null,
  owner_name text not null,
  awarded_packages integer not null default 0,
  active_packages integer not null default 0,
  contracted_amount numeric(14,2) not null default 0,
  concentration_percent numeric(5,2) not null default 0,
  bid_coverage numeric(5,2) not null default 0,
  delivery_health text not null check (delivery_health in ('controlled', 'watch', 'critical')),
  approval_pressure_hours numeric(10,2) not null default 0,
  compliance_alerts integer not null default 0,
  next_action text not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (company_id, supplier_id)
);

create index if not exists idx_supplier_control_lines_company on supplier_control_lines(company_id, updated_at desc);
