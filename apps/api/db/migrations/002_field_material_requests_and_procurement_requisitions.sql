create table if not exists field_material_requests (
  id text primary key,
  company_id text not null references platform_companies(id) on delete cascade,
  requisition_id text,
  project_name text not null,
  front_name text not null,
  requested_by text not null,
  summary text not null,
  detail text not null,
  requested_volume text not null,
  urgency text not null check (urgency in ('planned', 'watch', 'critical')),
  next_action text not null,
  status text not null check (status in ('requested', 'converted', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists procurement_requisitions (
  id text primary key,
  company_id text not null references platform_companies(id) on delete cascade,
  code text not null,
  project_name text not null,
  front_name text not null,
  requested_by text not null,
  category text not null,
  status text not null check (status in ('draft', 'submitted', 'approved', 'sourcing', 'blocked')),
  requested_items integer not null default 0,
  budget_amount numeric(14,2) not null default 0,
  urgency text not null check (urgency in ('planned', 'watch', 'critical')),
  approval_hours numeric(10,2) not null default 0,
  supplier_coverage integer not null default 0,
  next_action text not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (company_id, code)
);

alter table field_material_requests
  add constraint field_material_requests_requisition_fk
  foreign key (requisition_id) references procurement_requisitions(id) on delete set null;

create table if not exists procurement_requisition_risks (
  id text primary key,
  requisition_id text not null references procurement_requisitions(id) on delete cascade,
  title text not null,
  category text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  owner_name text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_field_material_requests_company on field_material_requests(company_id, created_at desc);
create index if not exists idx_procurement_requisitions_company on procurement_requisitions(company_id, updated_at desc);
create index if not exists idx_procurement_requisition_risks_req on procurement_requisition_risks(requisition_id, severity);
