import { closePostgresPool, getPostgresPool } from "../db/postgres.js";

function firstRow<T>(rows: T[]) {
  return rows[0] ?? null;
}

async function main() {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query("begin");

    const companyResult = await client.query<{
      id: string;
      trade_name: string;
    }>("select id, trade_name from platform_companies order by created_at asc limit 1");

    const company = firstRow(companyResult.rows);
    if (!company) {
      throw new Error("No company found. Run db:bootstrap-local first.");
    }

    const existingPurchaseOrders = await client.query<{ total: string }>(
      "select count(*)::text as total from procurement_purchase_orders where company_id = $1",
      [company.id]
    );
    const existingFieldRequests = await client.query<{ total: string }>(
      "select count(*)::text as total from field_material_requests where company_id = $1",
      [company.id]
    );
    const existingProcurementRequisitions = await client.query<{ total: string }>(
      "select count(*)::text as total from procurement_requisitions where company_id = $1",
      [company.id]
    );
    const existingProcurementPackages = await client.query<{ total: string }>(
      "select count(*)::text as total from procurement_packages where company_id = $1",
      [company.id]
    );

    const existingProjects = await client.query<{ total: string }>(
      "select count(*)::text as total from project_portfolio where company_id = $1",
      [company.id]
    );

    if (Number(existingProjects.rows[0]?.total ?? 0) === 0) {
      await client.query(
        `
          insert into project_portfolio
            (id, company_id, external_key, name, client_name, segment, status, stage, progress_percent, schedule_variance_days, budget_health, quality_holds, permit_blockers, active_fronts, next_milestone, updated_at)
          values
            ('prj_demo_torre', $1, 'AR-TD-01', 'Torre Demo', 'Cliente Demo', 'Vertical housing', 'active', 'Structure', 42, 3, 'warning', 1, 0, 2, 'Liberar cimentacion y arrancar columnas.', now())
          on conflict (id) do nothing
        `,
        [company.id]
      );

      await client.query(
        `
          insert into project_risks
            (id, project_id, title, category, severity, owner_name, status)
          values
            ('prr_demo_quality', 'prj_demo_torre', 'El frente de acabados mantiene hallazgos de calidad abiertos', 'Quality', 'warning', 'Project manager', 'Containment in progress'),
            ('prr_demo_equipment', 'prj_demo_torre', 'La grua mantiene una restriccion mecánica que presiona la secuencia', 'Equipment', 'critical', 'Operations lead', 'Maintenance release pending')
          on conflict (id) do nothing
        `
      );
    }

    if (Number(existingProcurementPackages.rows[0]?.total ?? 0) === 0) {
      await client.query(
        `
          insert into procurement_packages
            (id, company_id, code, package_name, project_name, buyer, status, budget_amount, bid_count, approval_hours, strategic, supplier_contention, next_action, updated_at)
          values
            ('pkg_demo_steel', $1, 'PKG-STEEL-01', 'Steel package', 'Torre Demo', 'Luis Operaciones', 'awaiting_approval', 1480000, 3, 30, true, 3, 'Cerrar aprobacion directiva y confirmar ventana de entrega inicial.', now()),
            ('pkg_demo_finishes', $1, 'PKG-FNS-02', 'Finishes package', 'Torre Demo', 'Luis Operaciones', 'blocked', 640000, 1, 46, false, 1, 'Reabrir competencia y resolver expediente del proveedor antes de adjudicar.', now()),
            ('pkg_demo_mep', $1, 'PKG-MEP-03', 'MEP package', 'Torre Demo', 'Luis Operaciones', 'sourcing', 925000, 2, 18, false, 2, 'Cerrar tercera cotizacion y pasar comparativo a aprobacion.', now())
          on conflict (id) do nothing
        `,
        [company.id]
      );

      await client.query(
        `
          insert into procurement_package_risks
            (id, package_id, title, category, severity, owner_name, status)
          values
            ('pkr_demo_steel_approval', 'pkg_demo_steel', 'La aprobacion ejecutiva del paquete de acero sigue abierta', 'Approval', 'warning', 'Procurement lead', 'Executive approval pending'),
            ('pkr_demo_finishes_supplier', 'pkg_demo_finishes', 'El proveedor de acabados mantiene baja competencia y riesgo comercial', 'Supplier concentration', 'critical', 'Procurement controller', 'Rebid required'),
            ('pkr_demo_mep_comparison', 'pkg_demo_mep', 'El comparativo MEP todavia no cierra con cobertura suficiente', 'Competition', 'warning', 'Buyer lead', 'Third quote pending')
          on conflict (id) do nothing
        `
      );
    }

    if (Number(existingPurchaseOrders.rows[0]?.total ?? 0) === 0) {
      await client.query(
        `
          insert into procurement_purchase_orders
            (id, company_id, code, requisition_code, project_name, supplier_name, buyer, category, status, total_amount, committed_eta, received_percent, invoice_match_status, logistics_mode, next_action, updated_at)
          values
            ('po_demo_steel', $1, 'PO-RBR-18', 'REQ-MNL-001', 'Torre Demo', 'Aceros del Sureste', 'Luis Operaciones', 'Steel', 'confirmed', 812000, '2026-07-18', 0, 'pending', 'Direct to jobsite', 'Confirmar liberacion de molino y coordinar ventana de descarga.', now()),
            ('po_demo_finish', $1, 'PO-FNS-22', 'REQ-FLD-002', 'Torre Demo', 'Acabados Peninsulares', 'Luis Operaciones', 'Finishes', 'partial', 265000, '2026-07-15', 68, 'matched', 'Cross-dock yard', 'Cerrar diferencia de material danado y completar saldo.', now())
          on conflict (id) do nothing
        `,
        [company.id]
      );

      await client.query(
        `
          insert into procurement_purchase_order_risks
            (id, purchase_order_id, title, category, severity, owner_name, status)
          values
            ('ppo_demo_eta', 'po_demo_steel', 'La liberacion del molino aun no esta confirmada', 'Logistics', 'warning', 'Buyer lead', 'Supplier confirmation pending'),
            ('ppo_demo_tiles', 'po_demo_finish', 'El paquete de acabados mantiene diferencia y devolucion parcial', 'Variance', 'critical', 'Procurement controller', 'Damage resolution open')
          on conflict (id) do nothing
        `
      );
    }

    if (Number(existingProcurementRequisitions.rows[0]?.total ?? 0) === 0) {
      await client.query(
        `
          insert into procurement_requisitions
            (id, company_id, code, project_name, front_name, requested_by, category, status, budget_amount, requested_items, approval_hours, supplier_coverage, linked_field_request_id, next_action, updated_at)
          values
            ('req_demo_foundation', $1, 'REQ-FLD-001', 'Torre Demo', 'Frente Cimentacion', 'Luis Operaciones', 'Steel / formwork', 'approved', 420000, 6, 12, 2, 'fld_demo_foundation', 'Convertir requisicion aprobada en orden de compra y confirmar primer frente de entrega.', now()),
            ('req_demo_finishes', $1, 'REQ-FLD-002', 'Torre Demo', 'Jobsite B', 'Luis Operaciones', 'Finishes', 'sourcing', 185000, 4, 18, 1, 'fld_demo_finishes', 'Completar comparativo de proveedor y amarrar evidencia de campo antes de adjudicar.', now())
          on conflict (id) do nothing
        `,
        [company.id]
      );

      await client.query(
        `
          insert into procurement_requisition_risks
            (id, requisition_id, title, category, severity, owner_name, status)
          values
            ('prrq_demo_foundation', 'req_demo_foundation', 'La requisicion de cimentacion sigue atada al primer frente de entrega', 'Execution dependency', 'warning', 'Procurement lead', 'PO conversion pending'),
            ('prrq_demo_finishes', 'req_demo_finishes', 'La requisicion de acabados mantiene competencia limitada y presion del frente', 'Supplier contention', 'critical', 'Buyer lead', 'Commercial resolution open')
          on conflict (id) do nothing
        `
      );
    }

    if (Number(existingFieldRequests.rows[0]?.total ?? 0) === 0) {
      await client.query(
        `
          insert into field_material_requests
            (id, company_id, requisition_id, project_name, front_name, requested_by, summary, detail, requested_volume, urgency, category, requested_items, budget_amount, approval_hours, supplier_coverage, next_action, created_at)
          values
            ('fld_demo_foundation', $1, 'req_demo_foundation', 'Torre Demo', 'Frente Cimentacion', 'Luis Operaciones', 'Acero y cimbra para cimentacion inmediata', 'El frente ya consume stock comprometido y requiere liberar surtido de acero y formaleta para no frenar el colado.', '42 ton', 'watch', 'Field materials', 6, 420000, 12, 2, 'Cerrar requisicion y coordinar ventana de descarga en cimentacion.', now()),
            ('fld_demo_finishes', $1, 'req_demo_finishes', 'Torre Demo', 'Jobsite B', 'Luis Operaciones', 'Saldo de acabados para remate de frentes', 'El frente de acabados mantiene faltantes que ya pegan en cuadrilla, evidencia y cierre de punch list.', '96 cajas', 'critical', 'Field materials', 4, 185000, 18, 1, 'Sostener frente con compra urgente y validar recepcion completa en obra.', now())
          on conflict (id) do nothing
        `,
        [company.id]
      );
    }

    const existingReceipts = await client.query<{ total: string }>(
      "select count(*)::text as total from inventory_receipts where company_id = $1",
      [company.id]
    );

    if (Number(existingReceipts.rows[0]?.total ?? 0) === 0) {
      await client.query(
        `
          insert into inventory_receipts
            (id, company_id, code, supplier_name, destination_name, destination_type, purchase_reference, eta_date, received_date, status, ordered_units, received_units, variance_units, variance_percent, pending_evidence, rejected_units, next_action, updated_at)
          values
            ('rcv_demo_steel', $1, 'RCV-STEEL-01', 'Aceros del Sureste', 'Central warehouse', 'Warehouse', 'PO-RBR-18', '2026-07-12T13:00:00.000Z', null, 'in_transit', 240, 0, 0, 0, 3, 0, 'Recibir embarque y cerrar evidencia antes del corte de patio.', now()),
            ('rcv_demo_finish', $1, 'RCV-FIN-02', 'Acabados Peninsulares', 'Jobsite B', 'Jobsite', 'PO-FNS-22', '2026-07-11T16:00:00.000Z', null, 'blocked', 96, 72, 24, 25, 5, 8, 'Resolver pallets danados y cargar evidencia de discrepancia.', now())
          on conflict (id) do nothing
        `,
        [company.id]
      );

      await client.query(
        `
          insert into inventory_receipt_risks
            (id, receipt_id, title, category, severity, owner_name, status)
          values
            ('irr_demo_damage', 'rcv_demo_finish', 'Pallets danados pendientes de resolucion con proveedor', 'Quality rejection', 'critical', 'Field storekeeper', 'Supplier response pending'),
            ('irr_demo_evidence', 'rcv_demo_finish', 'El paquete de evidencia de recepcion sigue incompleto', 'Documentation', 'warning', 'Warehouse analyst', 'Missing signed discrepancy photos')
          on conflict (id) do nothing
        `
      );
    }

    const existingMovements = await client.query<{ total: string }>(
      "select count(*)::text as total from inventory_movements where company_id = $1",
      [company.id]
    );

    if (Number(existingMovements.rows[0]?.total ?? 0) === 0) {
      await client.query(
        `
          insert into inventory_movements
            (id, company_id, code, movement_type, sku_name, source_name, destination_name, requested_by, upstream_receipt_code, purchase_reference, status, requested_units, moved_units, variance_units, pending_evidence, impact_level, next_action, updated_at)
          values
            ('mov_demo_conduit', $1, 'MOV-CON-01', 'transfer', 'Conduit 1in', 'Central warehouse', 'Jobsite B', 'Luis Operaciones', 'RCV-STEEL-01', 'PO-RBR-18', 'in_transit', 180, 180, 0, 2, 'watch', 'Confirmar recepcion en frente y anexar evidencia de descarga.', now()),
            ('mov_demo_return', $1, 'MOV-TIL-02', 'return', 'Ceramic tile box', 'Jobsite B', 'Central warehouse', 'Luis Operaciones', 'RCV-FIN-02', 'PO-FNS-22', 'blocked', 24, 16, 8, 4, 'critical', 'Resolver cajas danadas y documentar diferencia antes del reingreso.', now())
          on conflict (id) do nothing
        `,
        [company.id]
      );

      await client.query(
        `
          insert into inventory_movement_risks
            (id, movement_id, title, category, severity, owner_name, status)
          values
            ('imr_demo_return', 'mov_demo_return', 'La devolucion mantiene diferencia fisica y evidencia incompleta', 'Traceability', 'critical', 'Field storekeeper', 'Reconciliation pending'),
            ('imr_demo_conduit', 'mov_demo_conduit', 'La transferencia aun no tiene firma final de frente', 'Handoff', 'warning', 'Warehouse analyst', 'Field confirmation pending')
          on conflict (id) do nothing
        `
      );
    }

    const existingDailyLogs = await client.query<{ total: string }>(
      "select count(*)::text as total from daily_log_entries where company_id = $1",
      [company.id]
    );

    if (Number(existingDailyLogs.rows[0]?.total ?? 0) === 0) {
      await client.query(
        `
          insert into daily_log_entries
            (id, company_id, project_name, front_name, supervisor, log_date, shift, weather, status, progress_percent, workforce_count, incidents_count, blockers_count, evidence_count, concrete_pour_m3, next_action, updated_at)
          values
            ('dlg_demo_core', $1, 'Torre Demo', 'Frente Cimentacion', 'Luis Operaciones', '2026-07-13', 'morning', 'clear', 'submitted', 42, 24, 0, 0, 9, 18, 'Liberar frente de acero y preparar vaciado de cimentacion.', now()),
            ('dlg_demo_finishes', $1, 'Torre Demo', 'Jobsite B', 'Luis Operaciones', '2026-07-12', 'mixed', 'rain', 'flagged', 68, 18, 1, 2, 6, 0, 'Contener diferencia de acabados y reprogramar cuadrilla de colocacion.', now())
          on conflict (id) do nothing
        `,
        [company.id]
      );

      await client.query(
        `
          insert into daily_log_risks
            (id, log_id, title, category, severity, owner_name, status)
          values
            ('dlr_demo_finishes', 'dlg_demo_finishes', 'La bitacora del frente de acabados mantiene bloqueadores abiertos', 'Execution', 'critical', 'Resident engineer', 'Needs same-day containment'),
            ('dlr_demo_weather', 'dlg_demo_finishes', 'La lluvia redujo rendimiento y evidencia completa de cierre', 'Weather / evidence', 'warning', 'Field supervisor', 'Pending updated evidence pack')
          on conflict (id) do nothing
        `
      );
    }

    const existingMachines = await client.query<{ total: string }>(
      "select count(*)::text as total from machine_items where company_id = $1",
      [company.id]
    );

    if (Number(existingMachines.rows[0]?.total ?? 0) === 0) {
      await client.query(
        `
          insert into machine_items
            (id, company_id, code, machine_name, machine_type, project_name, front_name, status, health, availability_percent, utilization_percent, hour_meter, next_maintenance_hours, maintenance_due_date, maintenance_backlog, open_failures, critical_open_failures, last_service_at, next_action, updated_at)
          values
            ('eq_demo_exc', $1, 'EQ-EXC-01', 'Excavadora 320GC', 'Excavadora', 'Torre Demo', 'Frente Cimentacion', 'available', 'watch', 92, 74, 1840, 110, '2026-07-18T18:00:00.000Z', 0, 1, 0, '2026-06-28T15:00:00.000Z', 'Inspeccionar desgaste de pernos de cucharon antes del siguiente ciclo.', now()),
            ('eq_demo_crane', $1, 'EQ-CRN-04', 'Grua torre TC-8', 'Grua torre', 'Torre Demo', 'Jobsite B', 'maintenance', 'critical', 64, 58, 4120, 0, '2026-07-09T13:00:00.000Z', 2, 2, 1, '2026-06-10T11:30:00.000Z', 'Cerrar falla del freno de giro y liberar ticket de mantenimiento firmado.', now())
          on conflict (id) do nothing
        `,
        [company.id]
      );

      await client.query(
        `
          insert into machine_risks
            (id, machine_id, title, category, severity, owner_name, status)
          values
            ('mkr_demo_crane', 'eq_demo_crane', 'La grua mantiene una falla critica abierta en el freno de giro', 'Mechanical', 'critical', 'Maintenance lead', 'Repair in progress'),
            ('mkr_demo_exc', 'eq_demo_exc', 'La excavadora requiere inspeccion preventiva antes del siguiente frente', 'Preventive maintenance', 'warning', 'Equipment planner', 'Inspection pending')
          on conflict (id) do nothing
        `
      );
    }

    const existingWorkforces = await client.query<{ total: string }>(
      "select count(*)::text as total from hr_workforce_items where company_id = $1",
      [company.id]
    );
    const existingFinanceItems = await client.query<{ total: string }>(
      "select count(*)::text as total from finance_ledger_items where company_id = $1",
      [company.id]
    );
    const existingSupplierMasterProfiles = await client.query<{ total: string }>(
      "select count(*)::text as total from supplier_master_profiles where company_id = $1",
      [company.id]
    );
    const existingAccountsPayableInvoices = await client.query<{ total: string }>(
      "select count(*)::text as total from accounts_payable_invoices where company_id = $1",
      [company.id]
    );
    const existingTreasuryRuns = await client.query<{ total: string }>(
      "select count(*)::text as total from treasury_payment_runs where company_id = $1",
      [company.id]
    );
    const existingDocumentControlItems = await client.query<{ total: string }>(
      "select count(*)::text as total from document_control_items where company_id = $1",
      [company.id]
    );

    if (Number(existingWorkforces.rows[0]?.total ?? 0) === 0) {
      await client.query(
        `
          insert into hr_workforce_items
            (id, company_id, code, contractor_name, front_name, active_headcount, attendance_rate, productivity_rate, compliance_expirations, incident_count, safety_status, next_action, updated_at)
          values
            ('wrk_demo_foundation', $1, 'WF-101', 'Cimentaciones del Sureste', 'Frente Cimentacion', 24, 93, 88, 0, 0, 'controlled', 'Mantener cuadrilla estable para vaciado y habilitado.', now()),
            ('wrk_demo_finishes', $1, 'WF-114', 'Acabados Peninsulares', 'Jobsite B', 18, 84, 76, 2, 1, 'critical', 'Regularizar asistencias y cerrar vencimientos de seguridad.', now())
          on conflict (id) do nothing
        `,
        [company.id]
      );

      await client.query(
        `
          insert into hr_workforce_risks
            (id, workforce_id, title, category, severity, owner_name, status)
          values
            ('hrr_demo_finishes', 'wrk_demo_finishes', 'La cuadrilla de acabados mantiene expiraciones y una incidencia abierta', 'Compliance / safety', 'critical', 'Field HR', 'Immediate regularization required'),
            ('hrr_demo_foundation', 'wrk_demo_foundation', 'La cuadrilla de cimentacion requiere monitoreo de productividad por arranque de fase', 'Productivity', 'info', 'Operations lead', 'Monitoring current shift')
          on conflict (id) do nothing
        `
      );
    }

    if (Number(existingFinanceItems.rows[0]?.total ?? 0) === 0) {
      await client.query(
        `
          insert into finance_ledger_items
            (id, company_id, code, metric_name, value_label, trend_label, note, cash_impact, urgent_items, close_readiness, sat_status, updated_at)
          values
            ('fin_demo_cash', $1, 'FIN-CASH-01', 'Cash position', 'MXN 12.4M', 'Forecast +4%', 'Caja operativa suficiente para sostener el ciclo actual de obra y compras inmediatas.', 12400000, 0, 94, 'controlled', now()),
            ('fin_demo_ap', $1, 'FIN-AP-02', 'Accounts payable', 'MXN 3.6M', '6 urgent', 'Existen facturas y complementos pendientes ligados a evidencia de recepcion y cierre documental.', -3600000, 6, 82, 'watch', now()),
            ('fin_demo_sat', $1, 'FIN-SAT-03', 'SAT posture', 'Watch', '3 CFDI exceptions', 'Persisten incidencias CFDI y validaciones de expediente fiscal de proveedores criticos.', -240000, 3, 78, 'watch', now())
          on conflict (id) do nothing
        `,
        [company.id]
      );

      await client.query(
        `
          insert into finance_risks
            (id, ledger_id, title, category, severity, owner_name, status)
          values
            ('frk_demo_ap_invoice', 'fin_demo_ap', 'Facturas bloqueadas aun presionan el siguiente corte de pagos', 'Accounts payable', 'warning', 'Treasury lead', 'Waiting for receiving evidence'),
            ('frk_demo_sat_cfdi', 'fin_demo_sat', 'CFDI y complementos de pago mantienen discrepancias abiertas', 'SAT / CFDI', 'critical', 'Fiscal controller', 'Reconciliation in progress'),
            ('frk_demo_sat_supplier', 'fin_demo_sat', 'Expediente fiscal de proveedor critico sigue incompleto', 'Supplier compliance', 'warning', 'Procurement controller', 'Vendor packet pending')
          on conflict (id) do nothing
        `
      );
    }

    if (Number(existingSupplierMasterProfiles.rows[0]?.total ?? 0) === 0) {
      await client.query(
        `
          insert into supplier_master_profiles
            (id, supplier_id, company_id, supplier_name, trade_name, rfc, fiscal_regime, cfdi_use, payment_method, payment_terms_days, bank_account_masked, contact_name, contact_email, contact_phone, compliance_status, sat_status, fiscal_packet_completion, last_validated_at, next_action, updated_at)
          values
            ('supm_demo_steel', 'sup_aceros_del_sureste', $1, 'Aceros del Sureste', 'Aceros del Sureste SA de CV', 'ASU240101AB1', '601', 'G03', 'Transferencia', 30, '****9012', 'Monica Fiscal', 'fiscal@acerosdelsureste.mx', '9991234567', 'watch', 'watch', 82, '2026-07-10T12:00:00.000Z', 'Cerrar validacion de constancia fiscal y complemento de pago antes de liberar el ciclo completo.', now()),
            ('supm_demo_mep', 'sup_electromec_mx', $1, 'Electromec MX', 'Electromec MX Integraciones', 'EMX240101BC2', '601', 'I01', 'Transferencia', 21, '****4455', 'Laura Cuentas', 'cuentas@electromecmx.com', '9997654321', 'blocked', 'critical', 64, '2026-07-09T16:30:00.000Z', 'Mantener bloqueo hasta recibir opinion SAT, constancia y expediente bancario actualizados.', now())
          on conflict (id) do nothing
        `,
        [company.id]
      );

      await client.query(
        `
          insert into supplier_master_risks
            (id, supplier_profile_id, title, category, severity, owner_name, status)
          values
            ('smr_demo_steel_constancia', 'supm_demo_steel', 'Constancia de situacion fiscal pendiente de validacion final', 'SAT', 'warning', 'Fiscal controller', 'Awaiting refreshed document'),
            ('smr_demo_mep_packet', 'supm_demo_mep', 'Opinion de cumplimiento SAT y expediente bancario siguen incompletos', 'Vendor compliance', 'critical', 'Procurement controller', 'Vendor blocked until packet is complete')
          on conflict (id) do nothing
        `
      );
    }

    if (Number(existingAccountsPayableInvoices.rows[0]?.total ?? 0) === 0) {
      await client.query(
        `
          insert into accounts_payable_invoices
            (id, company_id, supplier_profile_id, supplier_name, code, invoice_number, invoice_uuid, project_name, purchase_order_code, receipt_code, status, sat_status, complement_status, receipt_evidence_status, payment_method, due_date, scheduled_payment_date, received_at, subtotal, tax, total, pending_amount, packet_completion, next_action, updated_at)
          values
            ('apin_demo_steel', $1, 'supm_demo_steel', 'Aceros del Sureste', 'AP-0001', 'FAS-1842', '0D4B2E47-5C1A-48CC-A503-000000000111', 'Torre Demo', 'PO-RBR-18', 'RCV-STEEL-01', 'matched', 'watch', 'pending', 'partial', 'Transferencia', '2026-07-22', null, '2026-07-12T15:10:00.000Z', 700000, 112000, 812000, 812000, 86, 'Cerrar evidencia de recepcion firmada y validar complemento antes del siguiente corte de pagos.', now()),
            ('apin_demo_finish', $1, null, 'Acabados Peninsulares', 'AP-0002', 'AP-9921', '7A91F6D1-8234-4B62-9F90-000000000222', 'Torre Demo', 'PO-FNS-22', 'RCV-FIN-02', 'blocked', 'critical', 'risk', 'missing', 'Transferencia', '2026-07-16', null, '2026-07-11T17:00:00.000Z', 228448.28, 36551.72, 265000, 265000, 62, 'Resolver pallets danados, CFDI observado y evidencia de recepcion antes de liberar pago.', now())
          on conflict (id) do nothing
        `,
        [company.id]
      );

      await client.query(
        `
          insert into accounts_payable_risks
            (id, invoice_id, title, category, severity, owner_name, status)
          values
            ('apr_demo_steel_packet', 'apin_demo_steel', 'Complemento de pago y evidencia de recepcion aun no cierran el expediente', 'SAT / evidence', 'warning', 'Fiscal controller', 'Waiting for signed receiving packet'),
            ('apr_demo_finish_block', 'apin_demo_finish', 'Factura bloqueada por devolucion parcial y CFDI observado', 'Commercial / fiscal', 'critical', 'Treasury lead', 'Blocked until supplier correction and receipt reconciliation')
          on conflict (id) do nothing
        `
      );
    }

    if (Number(existingTreasuryRuns.rows[0]?.total ?? 0) === 0) {
      await client.query(
        `
          insert into treasury_payment_runs
            (id, company_id, code, bank_account_label, scheduled_date, status, owner_name, next_action, updated_at)
          values
            ('tpr_demo_friday', $1, 'TPR-0001', 'Banorte Operacion ****4451', '2026-07-24', 'blocked', 'Treasury lead', 'Separar factura bloqueada y liberar corrida parcial solo con expediente fiscal y evidencia completos.', now())
          on conflict (id) do nothing
        `,
        [company.id]
      );

      await client.query(
        `
          insert into treasury_payment_run_invoices (payment_run_id, invoice_id)
          values
            ('tpr_demo_friday', 'apin_demo_steel'),
            ('tpr_demo_friday', 'apin_demo_finish')
          on conflict do nothing
        `
      );

      await client.query(
        `
          insert into treasury_payment_run_risks
            (id, payment_run_id, title, category, severity, owner_name, status)
          values
            ('tprr_demo_blocked_invoice', 'tpr_demo_friday', 'La corrida incluye una factura bloqueada por CFDI y evidencia incompleta', 'Release rule', 'critical', 'Treasury lead', 'Split required before execution')
          on conflict (id) do nothing
        `
      );
    }

    if (Number(existingDocumentControlItems.rows[0]?.total ?? 0) === 0) {
      await client.query(
        `
          insert into document_control_items
            (id, company_id, code, document_type, subject, project_name, owner_name, status, revision_count, turnaround_days, open_comments, health, next_action, updated_at)
          values
            ('doc_demo_foundation_rfi', $1, 'DOC-001', 'RFI', 'Cruce de planos en cimentacion', 'Torre Demo', 'Document control', 'awaiting_response', 1, 3.2, 4, 'watch', 'Consolidar respuesta tecnica y liberar detalle de cimentacion antes del siguiente colado.', now()),
            ('doc_demo_finishes_submittal', $1, 'DOC-002', 'Submittal', 'Ficha tecnica de acabados y cierre de observaciones', 'Torre Demo', 'Document control', 'blocked', 2, 6.8, 5, 'critical', 'Destrabar paquete tecnico y cerrar comentarios de arquitectura ligados al frente de acabados.', now())
          on conflict (id) do nothing
        `,
        [company.id]
      );

      await client.query(
        `
          insert into document_control_risks
            (id, item_id, title, category, severity, owner_name, status)
          values
            ('dcr_demo_foundation', 'doc_demo_foundation_rfi', 'La respuesta de cimentacion todavia no cierra con planos consistentes', 'Coordination', 'warning', 'Project coordination', 'Technical answer pending'),
            ('dcr_demo_finishes', 'doc_demo_finishes_submittal', 'El submittal de acabados sigue bloqueando cierre de punch list y compra final', 'Approval / field dependency', 'critical', 'Document control', 'Architecture comments unresolved')
          on conflict (id) do nothing
        `
      );
    }

    const existingQuality = await client.query<{ total: string }>(
      "select count(*)::text as total from quality_inspections where company_id = $1",
      [company.id]
    );

    if (Number(existingQuality.rows[0]?.total ?? 0) === 0) {
      await client.query(
        `
          insert into quality_inspections
            (id, company_id, code, area_name, checklist_name, contractor_name, severity, open_findings, evidence_completion, release_readiness, rework_rate, status, next_action, updated_at)
          values
            ('qlt_demo_foundation', $1, 'QIN-320', 'Frente Cimentacion', 'Liberacion de cimentacion', 'Cimentaciones del Sureste', 'major', 2, 92, 88, 2.4, 'pending_release', 'Cerrar observaciones menores y ejecutar caminata final de liberacion.', now()),
            ('qlt_demo_finishes', $1, 'QIN-334', 'Jobsite B', 'Punch list de acabados', 'Acabados Peninsulares', 'critical', 5, 78, 64, 6.2, 'blocked', 'Corregir detalles de acabado y anexar evidencia de cierre.', now())
          on conflict (id) do nothing
        `,
        [company.id]
      );

      await client.query(
        `
          insert into quality_risks
            (id, inspection_id, title, category, severity, owner_name, status)
          values
            ('qrr_demo_finishes', 'qlt_demo_finishes', 'El frente de acabados no puede liberarse por hallazgos abiertos', 'Finish quality', 'critical', 'Site quality', 'Blocked until rework closure'),
            ('qrr_demo_foundation', 'qlt_demo_foundation', 'La liberacion de cimentacion aun requiere evidencia georreferenciada final', 'Documentation', 'warning', 'QC coordinator', 'Final evidence pending')
          on conflict (id) do nothing
        `
      );
    }

    await client.query("commit");
    console.log(`Operations demo seeded for ${company.trade_name} (${company.id}).`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await closePostgresPool();
  }
}

await main();
