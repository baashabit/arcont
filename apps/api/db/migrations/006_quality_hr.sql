create table if not exists hr_workforce_items (
  id text primary key,
  company_id text not null references platform_companies(id) on delete cascade,
  code text not null,
  contractor_name text not null,
  front_name text not null,
  active_headcount integer not null default 0,
  attendance_rate numeric(5,2) not null default 0,
  productivity_rate numeric(5,2) not null default 0,
  compliance_expirations integer not null default 0,
  incident_count integer not null default 0,
  safety_status text not null check (safety_status in ('controlled', 'watch', 'critical')),
  next_action text not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (company_id, code)
);

create table if not exists hr_workforce_risks (
  id text primary key,
  workforce_id text not null references hr_workforce_items(id) on delete cascade,
  title text not null,
  category text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  owner_name text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists quality_inspections (
  id text primary key,
  company_id text not null references platform_companies(id) on delete cascade,
  code text not null,
  area_name text not null,
  checklist_name text not null,
  contractor_name text not null,
  severity text not null check (severity in ('minor', 'major', 'critical')),
  open_findings integer not null default 0,
  evidence_completion numeric(5,2) not null default 0,
  release_readiness numeric(5,2) not null default 0,
  rework_rate numeric(10,2) not null default 0,
  status text not null check (status in ('scheduled', 'in_progress', 'pending_release', 'released', 'blocked')),
  next_action text not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (company_id, code)
);

create table if not exists quality_risks (
  id text primary key,
  inspection_id text not null references quality_inspections(id) on delete cascade,
  title text not null,
  category text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  owner_name text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_hr_workforce_items_company on hr_workforce_items(company_id, updated_at desc);
create index if not exists idx_hr_workforce_risks_workforce on hr_workforce_risks(workforce_id, severity);
create index if not exists idx_quality_inspections_company on quality_inspections(company_id, updated_at desc);
create index if not exists idx_quality_risks_inspection on quality_risks(inspection_id, severity);
