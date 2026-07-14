create table if not exists accounts_payable_invoices (
  id text primary key,
  company_id text not null references platform_companies(id) on delete cascade,
  supplier_profile_id text references supplier_master_profiles(id) on delete set null,
  supplier_name text not null,
  code text not null,
  invoice_number text not null,
  invoice_uuid text not null,
  project_name text not null,
  purchase_order_code text,
  receipt_code text,
  status text not null check (status in ('received', 'matched', 'scheduled', 'blocked', 'paid')),
  sat_status text not null check (sat_status in ('controlled', 'watch', 'critical')),
  complement_status text not null check (complement_status in ('pending', 'complete', 'not_required', 'risk')),
  receipt_evidence_status text not null check (receipt_evidence_status in ('complete', 'partial', 'missing')),
  payment_method text not null,
  due_date date not null,
  scheduled_payment_date date,
  received_at timestamptz not null default now(),
  subtotal numeric(14,2) not null default 0,
  tax numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  pending_amount numeric(14,2) not null default 0,
  packet_completion numeric(5,2) not null default 0,
  next_action text not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (company_id, code),
  unique (company_id, invoice_uuid)
);

create table if not exists accounts_payable_risks (
  id text primary key,
  invoice_id text not null references accounts_payable_invoices(id) on delete cascade,
  title text not null,
  category text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  owner_name text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_accounts_payable_invoices_company on accounts_payable_invoices(company_id, updated_at desc);
create index if not exists idx_accounts_payable_risks_invoice on accounts_payable_risks(invoice_id, severity);
