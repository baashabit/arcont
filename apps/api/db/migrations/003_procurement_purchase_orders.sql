create table if not exists procurement_purchase_orders (
  id text primary key,
  company_id text not null references platform_companies(id) on delete cascade,
  code text not null,
  requisition_code text not null,
  project_name text not null,
  supplier_name text not null,
  buyer text not null,
  category text not null,
  status text not null check (status in ('issued', 'confirmed', 'in_transit', 'partial', 'received', 'blocked')),
  total_amount numeric(14,2) not null default 0,
  committed_eta date not null,
  received_percent numeric(5,2) not null default 0,
  invoice_match_status text not null check (invoice_match_status in ('matched', 'pending', 'risk')),
  logistics_mode text not null,
  next_action text not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (company_id, code)
);

create table if not exists procurement_purchase_order_risks (
  id text primary key,
  purchase_order_id text not null references procurement_purchase_orders(id) on delete cascade,
  title text not null,
  category text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  owner_name text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_procurement_purchase_orders_company on procurement_purchase_orders(company_id, updated_at desc);
create index if not exists idx_procurement_purchase_order_risks_po on procurement_purchase_order_risks(purchase_order_id, severity);
