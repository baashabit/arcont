create table if not exists document_control_items (
  id text primary key,
  company_id text not null references platform_companies(id) on delete cascade,
  code text not null,
  document_type text not null,
  subject text not null,
  project_name text not null,
  owner_name text not null,
  status text not null check (status in ('issued', 'in_review', 'awaiting_response', 'approved', 'blocked')),
  revision_count integer not null default 0,
  turnaround_days numeric(10,2) not null default 0,
  open_comments integer not null default 0,
  health text not null check (health in ('healthy', 'watch', 'critical')),
  next_action text not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (company_id, code)
);

create table if not exists document_control_risks (
  id text primary key,
  item_id text not null references document_control_items(id) on delete cascade,
  title text not null,
  category text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  owner_name text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_document_control_items_company on document_control_items(company_id, updated_at desc);
create index if not exists idx_document_control_risks_item on document_control_risks(item_id, severity);
