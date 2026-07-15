create table if not exists project_schedule_activities (
  id text primary key,
  company_id text not null references platform_companies(id) on delete cascade,
  project_id text not null references project_portfolio(id) on delete cascade,
  code text not null,
  name text not null,
  phase text not null,
  status text not null check (status in ('not_started', 'in_progress', 'blocked', 'completed')),
  planned_start date not null,
  planned_finish date not null,
  actual_start date,
  actual_finish date,
  progress_percent numeric(5,2) not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  predecessor_ids jsonb not null default '[]'::jsonb,
  owner_name text not null,
  next_action text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, code),
  check (planned_finish >= planned_start)
);

create index if not exists idx_project_schedule_activities_project on project_schedule_activities(project_id, planned_start, planned_finish);
create index if not exists idx_project_schedule_activities_company_status on project_schedule_activities(company_id, status, updated_at desc);
