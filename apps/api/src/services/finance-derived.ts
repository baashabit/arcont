import type { PlatformRepository } from "../repositories/platform-repository.js";

function roundMetric(value: number) {
  return Number(value.toFixed(1));
}

export async function buildDerivedFinanceState(repository: PlatformRepository, companyId: string) {
  const [baseItems, baseRisks, payableInvoices, payableRisks, supplierProfiles, supplierRisks] = await Promise.all([
    repository.listFinanceItems(companyId),
    repository.listFinanceRisks(companyId),
    repository.listAccountsPayableInvoices(companyId),
    repository.listAccountsPayableRisks(companyId),
    repository.listSupplierMasterProfiles(companyId),
    repository.listSupplierMasterRisks(companyId)
  ]);

  const items = baseItems.map((item) => ({ ...item }));
  const risks = baseRisks.map((risk) => ({ ...risk }));
  const apAnchor = items.find((item) => item.code === "FIN-AP-02" || item.metricName.toLowerCase() === "accounts payable");
  const satAnchor = items.find((item) => item.code === "FIN-SAT-03" || item.metricName.toLowerCase() === "sat posture");

  if (apAnchor && payableInvoices.length > 0) {
    const openInvoices = payableInvoices.filter((invoice) => invoice.status !== "paid");
    const blockedInvoices = openInvoices.filter((invoice) => invoice.status === "blocked");
    const urgentInvoices = openInvoices.filter(
      (invoice) =>
        invoice.status === "blocked" ||
        invoice.satStatus === "critical" ||
        invoice.complementStatus === "risk" ||
        invoice.receiptEvidenceStatus === "missing"
    );
    const openAmount = openInvoices.reduce((sum, invoice) => sum + invoice.pendingAmount, 0);
    const closeReadiness =
      openInvoices.length > 0
        ? roundMetric(
            openInvoices.reduce((sum, invoice) => {
              const evidenceScore =
                invoice.receiptEvidenceStatus === "complete" ? 100 : invoice.receiptEvidenceStatus === "partial" ? 72 : 35;
              const complementScore =
                invoice.complementStatus === "complete"
                  ? 100
                  : invoice.complementStatus === "not_required"
                    ? 100
                    : invoice.complementStatus === "pending"
                      ? 68
                      : 30;
              return sum + roundMetric(invoice.packetCompletion * 0.5 + evidenceScore * 0.25 + complementScore * 0.25);
            }, 0) / openInvoices.length
          )
        : 100;

    apAnchor.valueLabel = `MXN ${Math.round(openAmount).toLocaleString()}`;
    apAnchor.trendLabel = `${urgentInvoices.length} urgent`;
    apAnchor.note =
      blockedInvoices.length > 0
        ? `${blockedInvoices.length} blocked invoice(s) still hold the next payment run because receiving, CFDI or complement evidence remains incomplete.`
        : `${openInvoices.length} supplier invoice(s) remain active and need fiscal plus receiving closure before cash leaves the company.`;
    apAnchor.cashImpact = -openAmount;
    apAnchor.urgentItems = urgentInvoices.length;
    apAnchor.closeReadiness = closeReadiness;
    apAnchor.satStatus =
      blockedInvoices.length > 0 || urgentInvoices.some((invoice) => invoice.satStatus === "critical")
        ? "critical"
        : urgentInvoices.length > 0
          ? "watch"
          : "controlled";
    apAnchor.updatedAt = openInvoices.reduce(
      (latest, invoice) => (Date.parse(invoice.updatedAt) > Date.parse(latest) ? invoice.updatedAt : latest),
      apAnchor.updatedAt
    );

    risks.push(
      ...payableRisks
        .filter((risk) => {
          const invoice = payableInvoices.find((candidate) => candidate.id === risk.invoiceId);
          return invoice?.status !== "paid";
        })
        .map((risk) => ({
          id: `fin-ap-${risk.id}`,
          ledgerId: apAnchor.id,
          title: risk.title,
          category: risk.category,
          severity: risk.severity,
          owner: risk.owner,
          status: risk.status
        }))
    );
  }

  if (satAnchor && (payableInvoices.length > 0 || supplierProfiles.length > 0)) {
    const cfdiExceptions = payableInvoices.filter(
      (invoice) => invoice.satStatus === "critical" || invoice.complementStatus === "risk"
    );
    const supplierExceptions = supplierProfiles.filter(
      (profile) => profile.satStatus === "critical" || profile.fiscalPacketCompletion < 100
    );
    const fiscalExceptionCount = cfdiExceptions.length + supplierExceptions.length;
    const satReadinessBase =
      payableInvoices.length + supplierProfiles.length > 0
        ? roundMetric(
            (
              payableInvoices.reduce((sum, invoice) => {
                const complementScore =
                  invoice.complementStatus === "complete"
                    ? 100
                    : invoice.complementStatus === "not_required"
                      ? 100
                      : invoice.complementStatus === "pending"
                        ? 70
                        : 25;
                const satScore = invoice.satStatus === "controlled" ? 100 : invoice.satStatus === "watch" ? 72 : 30;
                return sum + roundMetric(satScore * 0.5 + complementScore * 0.5);
              }, 0) +
              supplierProfiles.reduce((sum, profile) => {
                const satScore = profile.satStatus === "controlled" ? 100 : profile.satStatus === "watch" ? 72 : 28;
                return sum + roundMetric(profile.fiscalPacketCompletion * 0.55 + satScore * 0.45);
              }, 0)
            ) /
              (payableInvoices.length + supplierProfiles.length)
          )
        : satAnchor.closeReadiness;

    satAnchor.valueLabel =
      fiscalExceptionCount === 0 ? "Controlled" : cfdiExceptions.some((invoice) => invoice.satStatus === "critical") ? "Critical" : "Watch";
    satAnchor.trendLabel = `${fiscalExceptionCount} fiscal exceptions`;
    satAnchor.note =
      fiscalExceptionCount === 0
        ? "CFDI, complements and supplier fiscal packets are currently aligned for the active payment cycle."
        : `${cfdiExceptions.length} invoice-side CFDI/complement issue(s) and ${supplierExceptions.length} supplier packet exception(s) remain open.`;
    satAnchor.cashImpact = -cfdiExceptions.reduce((sum, invoice) => sum + invoice.pendingAmount, 0);
    satAnchor.urgentItems = fiscalExceptionCount;
    satAnchor.closeReadiness = satReadinessBase;
    satAnchor.satStatus =
      cfdiExceptions.some((invoice) => invoice.satStatus === "critical") ||
      supplierProfiles.some((profile) => profile.satStatus === "critical")
        ? "critical"
        : fiscalExceptionCount > 0
          ? "watch"
          : "controlled";

    risks.push(
      ...payableRisks
        .filter((risk) => {
          const invoice = payableInvoices.find((candidate) => candidate.id === risk.invoiceId);
          return invoice && (invoice.satStatus === "critical" || invoice.complementStatus === "risk");
        })
        .map((risk) => ({
          id: `fin-sat-${risk.id}`,
          ledgerId: satAnchor.id,
          title: risk.title,
          category: risk.category,
          severity: risk.severity,
          owner: risk.owner,
          status: risk.status
        })),
      ...supplierRisks.map((risk) => ({
        id: `fin-sat-${risk.id}`,
        ledgerId: satAnchor.id,
        title: risk.title,
        category: risk.category,
        severity: risk.severity,
        owner: risk.owner,
        status: risk.status
      }))
    );
  }

  return {
    items,
    risks,
    payableInvoices,
    payableRisks,
    supplierProfiles,
    supplierRisks
  };
}
