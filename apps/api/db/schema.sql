-- ARCONT platform foundation schema
-- Consolidated PostgreSQL schema for multi-tenant platform and module activation.

create extension if not exists pgcrypto;

create table if not exists platform_companies (
  id text primary key,
  external_key text not null unique,
  legal_name text not null,
  trade_name text not null,
  country_code char(2) not null,
  tax_id text not null unique,
  status text not null check (status in ('draft', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists platform_modules (
  module_key text primary key,
  name text not null,
  area text not null,
  scope text not null check (scope in ('platform', 'operations')),
  description text not null,
  enabled_by_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists platform_company_modules (
  company_id text not null references platform_companies(id),
  module_key text not null references platform_modules(module_key),
  enabled boolean not null default true,
  activated_at timestamptz not null default now(),
  activated_by text,
  primary key (company_id, module_key)
);

create table if not exists platform_roles (
  role_key text primary key,
  name text not null,
  scope text not null check (scope in ('platform', 'operations')),
  created_at timestamptz not null default now()
);

create table if not exists platform_role_permissions (
  role_key text not null references platform_roles(role_key) on delete cascade,
  permission_key text not null,
  primary key (role_key, permission_key)
);

create table if not exists platform_users (
  id text primary key,
  company_id text not null references platform_companies(id),
  full_name text not null,
  email text not null unique,
  role_key text not null references platform_roles(role_key),
  status text not null check (status in ('invited', 'active', 'disabled')),
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists platform_company_settings (
  company_id text primary key references platform_companies(id),
  timezone text not null,
  locale text not null,
  currency char(3) not null,
  fiscal_country char(2) not null,
  sat_enabled boolean not null default true,
  fiscal_regime text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists auth_refresh_tokens (
  id text primary key,
  user_id text not null references platform_users(id) on delete cascade,
  company_id text not null references platform_companies(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists audit_events (
  id text primary key,
  company_id text references platform_companies(id),
  actor_user_id text references platform_users(id),
  aggregate_type text not null,
  aggregate_id text not null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_platform_users_company on platform_users(company_id);
create index if not exists idx_platform_company_modules_company on platform_company_modules(company_id);
create index if not exists idx_auth_refresh_tokens_user on auth_refresh_tokens(user_id, created_at desc);
create index if not exists idx_audit_events_company on audit_events(company_id, created_at desc);

-- Operations domain starts with company scoping and can later branch into
-- sales, projects, procurement, finance, HR, compliance, and integrations.
create table if not exists operations_workspaces (
  id text primary key,
  company_id text not null references platform_companies(id),
  workspace_key text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (company_id, workspace_key)
);

create table if not exists project_portfolio (
  id text primary key,
  company_id text not null references platform_companies(id) on delete cascade,
  external_key text not null,
  name text not null,
  client_name text not null,
  segment text not null,
  status text not null check (status in ('planning', 'active', 'at_risk', 'blocked', 'closed')),
  stage text not null,
  progress_percent numeric(5,2) not null default 0,
  schedule_variance_days numeric(8,2) not null default 0,
  budget_health text not null check (budget_health in ('on_track', 'warning', 'critical')),
  quality_holds integer not null default 0,
  permit_blockers integer not null default 0,
  active_fronts integer not null default 0,
  next_milestone text not null,
  updated_at timestamptz not null default now(),
  unique (company_id, external_key)
);

create table if not exists project_risks (
  id text primary key,
  project_id text not null references project_portfolio(id) on delete cascade,
  title text not null,
  category text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  owner_name text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_project_portfolio_company on project_portfolio(company_id, updated_at desc);
create index if not exists idx_project_risks_project on project_risks(project_id, severity);

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

create table if not exists procurement_packages (
  id text primary key,
  company_id text not null references platform_companies(id) on delete cascade,
  code text not null,
  package_name text not null,
  project_name text not null,
  buyer text not null,
  status text not null check (status in ('draft', 'sourcing', 'awaiting_approval', 'awarded', 'blocked')),
  budget_amount numeric(14,2) not null default 0,
  bid_count integer not null default 0,
  approval_hours numeric(10,2) not null default 0,
  strategic boolean not null default false,
  supplier_contention integer not null default 0,
  next_action text not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (company_id, code)
);

create table if not exists procurement_package_risks (
  id text primary key,
  package_id text not null references procurement_packages(id) on delete cascade,
  title text not null,
  category text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  owner_name text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists supplier_control_lines (
  id text primary key,
  supplier_id text not null,
  company_id text not null references platform_companies(id) on delete cascade,
  supplier_name text not null,
  owner_name text not null,
  awarded_packages integer not null default 0,
  active_packages integer not null default 0,
  contracted_amount numeric(14,2) not null default 0,
  concentration_percent numeric(5,2) not null default 0,
  bid_coverage numeric(5,2) not null default 0,
  delivery_health text not null check (delivery_health in ('controlled', 'watch', 'critical')),
  approval_pressure_hours numeric(10,2) not null default 0,
  compliance_alerts integer not null default 0,
  next_action text not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (company_id, supplier_id)
);

create table if not exists supplier_master_profiles (
  id text primary key,
  supplier_id text not null,
  company_id text not null references platform_companies(id) on delete cascade,
  supplier_name text not null,
  trade_name text not null,
  rfc text not null,
  fiscal_regime text not null,
  cfdi_use text not null,
  payment_method text not null,
  payment_terms_days integer not null default 0,
  bank_account_masked text not null,
  contact_name text not null,
  contact_email text not null,
  contact_phone text not null,
  compliance_status text not null check (compliance_status in ('complete', 'watch', 'blocked')),
  sat_status text not null check (sat_status in ('controlled', 'watch', 'critical')),
  fiscal_packet_completion numeric(5,2) not null default 0,
  last_validated_at timestamptz,
  next_action text not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (company_id, supplier_id),
  unique (company_id, rfc)
);

create table if not exists supplier_master_risks (
  id text primary key,
  supplier_profile_id text not null references supplier_master_profiles(id) on delete cascade,
  title text not null,
  category text not null,
  severity text not null check (severity in ('info', 'warning', 'critical')),
  owner_name text not null,
  status text not null,
  created_at timestamptz not null default now()
);

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

create index if not exists idx_field_material_requests_company on field_material_requests(company_id, created_at desc);
create index if not exists idx_procurement_requisitions_company on procurement_requisitions(company_id, updated_at desc);
create index if not exists idx_procurement_requisition_risks_req on procurement_requisition_risks(requisition_id, severity);
create index if not exists idx_procurement_packages_company on procurement_packages(company_id, updated_at desc);
create index if not exists idx_procurement_package_risks_pkg on procurement_package_risks(package_id, severity);
create index if not exists idx_supplier_control_lines_company on supplier_control_lines(company_id, updated_at desc);
create index if not exists idx_supplier_master_profiles_company on supplier_master_profiles(company_id, updated_at desc);
create index if not exists idx_supplier_master_risks_profile on supplier_master_risks(supplier_profile_id, severity);
create index if not exists idx_procurement_purchase_orders_company on procurement_purchase_orders(company_id, updated_at desc);
create index if not exists idx_procurement_purchase_order_risks_po on procurement_purchase_order_risks(purchase_order_id, severity);
create index if not exists idx_inventory_receipts_company on inventory_receipts(company_id, updated_at desc);
create index if not exists idx_inventory_receipt_risks_receipt on inventory_receipt_risks(receipt_id, severity);
create index if not exists idx_inventory_movements_company on inventory_movements(company_id, updated_at desc);
create index if not exists idx_inventory_movement_risks_movement on inventory_movement_risks(movement_id, severity);
create index if not exists idx_daily_log_entries_company on daily_log_entries(company_id, log_date desc, updated_at desc);
create index if not exists idx_daily_log_risks_log on daily_log_risks(log_id, severity);
create index if not exists idx_machine_items_company on machine_items(company_id, updated_at desc);
create index if not exists idx_machine_risks_machine on machine_risks(machine_id, severity);
create index if not exists idx_hr_workforce_items_company on hr_workforce_items(company_id, updated_at desc);
create index if not exists idx_hr_workforce_risks_workforce on hr_workforce_risks(workforce_id, severity);
create index if not exists idx_finance_ledger_items_company on finance_ledger_items(company_id, updated_at desc);
create index if not exists idx_finance_risks_ledger on finance_risks(ledger_id, severity);
create index if not exists idx_accounts_payable_invoices_company on accounts_payable_invoices(company_id, updated_at desc);
create index if not exists idx_accounts_payable_risks_invoice on accounts_payable_risks(invoice_id, severity);
create index if not exists idx_treasury_payment_runs_company on treasury_payment_runs(company_id, scheduled_date desc, updated_at desc);
create index if not exists idx_treasury_payment_run_invoices_run on treasury_payment_run_invoices(payment_run_id, created_at desc);
create index if not exists idx_treasury_payment_run_risks_run on treasury_payment_run_risks(payment_run_id, severity);
create index if not exists idx_document_control_items_company on document_control_items(company_id, updated_at desc);
create index if not exists idx_document_control_risks_item on document_control_risks(item_id, severity);
create index if not exists idx_quality_inspections_company on quality_inspections(company_id, updated_at desc);
create index if not exists idx_quality_risks_inspection on quality_risks(inspection_id, severity);
