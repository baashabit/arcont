create table if not exists treasury_payment_runs (
  id text primary key,
  company_id text not null references platform_companies(id) on delete cascade,
  code text not null,
  bank_account_label text not null,
  scheduled_date date not null,
  status text not null check (status in ('draft', 'ready', 'blocked', 'executed')),
  owner_name text not null,
  next_action text not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (company_id, code)
);

create table if not exists treasury_payment_run_invoices (
  payment_run_id text not null references treasury_payment_runs(id) on delete cascade,
  invoice_id text not null references accounts_payable_invoices(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (payment_run_id, invoice_id)
);

create table if not exists treasury_payment_run_risks (
  id text primary key,
  payment_run_id text not null references treasury_payment_runs(id) on delete cascade,
  title text not null,
  category text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  owner_name text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_treasury_payment_runs_company on treasury_payment_runs(company_id, scheduled_date desc, updated_at desc);
create index if not exists idx_treasury_payment_run_invoices_run on treasury_payment_run_invoices(payment_run_id, created_at desc);
create index if not exists idx_treasury_payment_run_risks_run on treasury_payment_run_risks(payment_run_id, severity);
