import { AppShell } from "../../components/app-shell";

export default function GestoriaPage() {
  return (
    <AppShell
      title="Gestoria"
      subtitle="Coordinación de cierre, notaría, checklist documental y bloqueos con ownership claro."
    >
      <section className="grid cols4">
        <article className="metric">
          <div className="eyebrow">Expedientes activos</div>
          <div className="value">184</div>
          <div className="meta">Con seguimiento operativo.</div>
        </article>
        <article className="metric">
          <div className="eyebrow">En riesgo</div>
          <div className="value">29</div>
          <div className="meta">Con amenaza a fecha objetivo.</div>
        </article>
        <article className="metric">
          <div className="eyebrow">Notaría saturada</div>
          <div className="value">12</div>
          <div className="meta">Casos esperando agenda.</div>
        </article>
        <article className="metric">
          <div className="eyebrow">SLA de cierre</div>
          <div className="value">87%</div>
          <div className="meta">Mejora sostenida mensual.</div>
        </article>
      </section>

      <section className="grid splitStrong">
        <article className="card">
          <h3>Pipeline de cierre</h3>
          <div className="timeline">
            <div className="timelineItem">
              <strong>Separación y apertura</strong>
              <div className="meta">CRM convierte y crea expediente con owner inicial.</div>
            </div>
            <div className="timelineItem">
              <strong>Validación documental</strong>
              <div className="meta">Identidad, crédito y anexos listos para revisión.</div>
            </div>
            <div className="timelineItem">
              <strong>Coordinación notarial</strong>
              <div className="meta">Agenda, pre-cierre y confirmación final.</div>
            </div>
            <div className="timelineItem">
              <strong>Firma y transición</strong>
              <div className="meta">Caso listo para entrega administrativa.</div>
            </div>
          </div>
        </article>

        <article className="card">
          <h3>Bloqueos principales</h3>
          <ul className="list">
            <li className="item">
              <div>
                <strong>Documentación incompleta</strong>
                <div className="meta">Cliente tarda en completar anexos fiscales.</div>
              </div>
              <span className="status statusWarn">Cliente</span>
            </li>
            <li className="item">
              <div>
                <strong>Saturación notarial</strong>
                <div className="meta">Afecta especialmente cierres de fin de mes.</div>
              </div>
              <span className="status statusAlert">Externo</span>
            </li>
            <li className="item">
              <div>
                <strong>Validación de crédito</strong>
                <div className="meta">Pendientes de integración bancaria final.</div>
              </div>
              <span className="status statusInfo">Finanzas</span>
            </li>
          </ul>
        </article>
      </section>

      <section className="grid cols3">
        <article className="card">
          <h3>Checklist por dominio</h3>
          <div className="meta">Identidad</div>
          <div className="progress" style={{ marginTop: 12 }}>
            <span style={{ width: "100%" }} />
          </div>
          <div className="meta" style={{ marginTop: 16 }}>Crédito</div>
          <div className="progress" style={{ marginTop: 12 }}>
            <span style={{ width: "82%" }} />
          </div>
          <div className="meta" style={{ marginTop: 16 }}>Notaría</div>
          <div className="progress" style={{ marginTop: 12 }}>
            <span style={{ width: "61%" }} />
          </div>
        </article>
        <article className="card">
          <h3>Casos prioritarios</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Expediente</th>
                <th>Owner</th>
                <th>Riesgo</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>EXP-24031</td>
                <td>Brenda Solís</td>
                <td><span className="status statusWarn">Alto</span></td>
              </tr>
              <tr>
                <td>EXP-24047</td>
                <td>Ivonne Cano</td>
                <td><span className="status statusInfo">Medio</span></td>
              </tr>
              <tr>
                <td>EXP-24052</td>
                <td>Marco Euan</td>
                <td><span className="status statusOk">Bajo</span></td>
              </tr>
            </tbody>
          </table>
        </article>
        <article className="card">
          <h3>Lectura de producto</h3>
          <p>
            Esta vista ya baja el mockup de gestoría a una pantalla funcional que después
            puede conectarse a expedientes reales y alertas automatizadas.
          </p>
        </article>
      </section>
    </AppShell>
  );
}
