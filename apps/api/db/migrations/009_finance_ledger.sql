create table if not exists finance_ledger_items (
  id text primary key,
  company_id text not null references platform_companies(id) on delete cascade,
  code text not null,
  metric_name text not null,
  value_label text not null,
  trend_label text not null,
  note text not null,
  cash_impact numeric(14,2) not null default 0,
  urgent_items integer not null default 0,
  close_readiness numeric(5,2) not null default 0,
  sat_status text not null check (sat_status in ('controlled', 'watch', 'critical')),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (company_id, code)
);

create table if not exists finance_risks (
  id text primary key,
  ledger_id text not null references finance_ledger_items(id) on delete cascade,
  title text not null,
  category text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  owner_name text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_finance_ledger_items_company on finance_ledger_items(company_id, updated_at desc);
create index if not exists idx_finance_risks_ledger on finance_risks(ledger_id, severity);
