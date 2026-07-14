create table if not exists daily_log_entries (
  id text primary key,
  company_id text not null references platform_companies(id) on delete cascade,
  project_name text not null,
  front_name text not null,
  supervisor text not null,
  log_date date not null,
  shift text not null check (shift in ('morning', 'mixed', 'night')),
  weather text not null check (weather in ('clear', 'windy', 'rain', 'storm')),
  status text not null check (status in ('draft', 'submitted', 'approved', 'flagged')),
  progress_percent numeric(5,2) not null default 0,
  workforce_count integer not null default 0,
  incidents_count integer not null default 0,
  blockers_count integer not null default 0,
  evidence_count integer not null default 0,
  concrete_pour_m3 numeric(14,2) not null default 0,
  next_action text not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists daily_log_risks (
  id text primary key,
  log_id text not null references daily_log_entries(id) on delete cascade,
  title text not null,
  category text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  owner_name text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists machine_items (
  id text primary key,
  company_id text not null references platform_companies(id) on delete cascade,
  code text not null,
  machine_name text not null,
  machine_type text not null,
  project_name text not null,
  front_name text not null,
  status text not null check (status in ('available', 'maintenance', 'down')),
  health text not null check (health in ('healthy', 'watch', 'critical')),
  availability_percent numeric(5,2) not null default 0,
  utilization_percent numeric(5,2) not null default 0,
  hour_meter numeric(14,2) not null default 0,
  next_maintenance_hours numeric(14,2) not null default 0,
  maintenance_due_date timestamptz not null,
  maintenance_backlog integer not null default 0,
  open_failures integer not null default 0,
  critical_open_failures integer not null default 0,
  last_service_at timestamptz not null,
  next_action text not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (company_id, code)
);

create table if not exists machine_risks (
  id text primary key,
  machine_id text not null references machine_items(id) on delete cascade,
  title text not null,
  category text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  owner_name text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_daily_log_entries_company on daily_log_entries(company_id, log_date desc, updated_at desc);
create index if not exists idx_daily_log_risks_log on daily_log_risks(log_id, severity);
create index if not exists idx_machine_items_company on machine_items(company_id, updated_at desc);
create index if not exists idx_machine_risks_machine on machine_risks(machine_id, severity);
