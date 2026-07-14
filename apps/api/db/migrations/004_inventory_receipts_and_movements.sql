create table if not exists inventory_receipts (
  id text primary key,
  company_id text not null references platform_companies(id) on delete cascade,
  code text not null,
  supplier_name text not null,
  destination_name text not null,
  destination_type text not null,
  purchase_reference text not null,
  eta_date timestamptz not null,
  received_date timestamptz,
  status text not null check (status in ('draft', 'in_transit', 'received', 'blocked')),
  ordered_units numeric(14,2) not null default 0,
  received_units numeric(14,2) not null default 0,
  variance_units numeric(14,2) not null default 0,
  variance_percent numeric(10,2) not null default 0,
  pending_evidence integer not null default 0,
  rejected_units integer not null default 0,
  next_action text not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (company_id, code)
);

create table if not exists inventory_receipt_risks (
  id text primary key,
  receipt_id text not null references inventory_receipts(id) on delete cascade,
  title text not null,
  category text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  owner_name text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists inventory_movements (
  id text primary key,
  company_id text not null references platform_companies(id) on delete cascade,
  code text not null,
  movement_type text not null check (movement_type in ('transfer', 'issue', 'return')),
  sku_name text not null,
  source_name text not null,
  destination_name text not null,
  requested_by text not null,
  upstream_receipt_code text,
  purchase_reference text,
  status text not null check (status in ('draft', 'in_transit', 'received', 'blocked')),
  requested_units numeric(14,2) not null default 0,
  moved_units numeric(14,2) not null default 0,
  variance_units numeric(14,2) not null default 0,
  pending_evidence integer not null default 0,
  impact_level text not null check (impact_level in ('controlled', 'watch', 'critical')),
  next_action text not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (company_id, code)
);

create table if not exists inventory_movement_risks (
  id text primary key,
  movement_id text not null references inventory_movements(id) on delete cascade,
  title text not null,
  category text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  owner_name text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_inventory_receipts_company on inventory_receipts(company_id, updated_at desc);
create index if not exists idx_inventory_receipt_risks_receipt on inventory_receipt_risks(receipt_id, severity);
create index if not exists idx_inventory_movements_company on inventory_movements(company_id, updated_at desc);
create index if not exists idx_inventory_movement_risks_movement on inventory_movement_risks(movement_id, severity);
