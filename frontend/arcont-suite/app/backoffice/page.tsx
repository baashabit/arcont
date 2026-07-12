import { AppShell } from "../../components/app-shell";

export default function BackofficePage() {
  return (
    <AppShell
      title="Backoffice"
      subtitle="Control administrativo para requisiciones, aprobaciones, compras y visibilidad financiera de soporte a la operación."
    >
      <section className="grid cols4">
        <article className="metric">
          <div className="eyebrow">Requisiciones abiertas</div>
          <div className="value">143</div>
          <div className="meta">Pendientes en flujo actual.</div>
        </article>
        <article className="metric">
          <div className="eyebrow">Pendientes de aprobar</div>
          <div className="value">37</div>
          <div className="meta">Con impacto operativo inmediato.</div>
        </article>
        <article className="metric">
          <div className="eyebrow">Monto comprometido</div>
          <div className="value">$18.2M</div>
          <div className="meta">Compras en tránsito y OC abiertas.</div>
        </article>
        <article className="metric">
          <div className="eyebrow">SLA de aprobación</div>
          <div className="value">79%</div>
          <div className="meta">Aún con oportunidad de mejora.</div>
        </article>
      </section>

      <section className="grid cols2">
        <article className="card">
          <h3>Cola de aprobación</h3>
          <ul className="list">
            <li className="item">
              <div>
                <strong>REQ-1042 / Acero estructural</strong>
                <div className="meta">Obra Torre C, prioridad alta por ruta crítica.</div>
              </div>
              <span className="status statusAlert">Dirección</span>
            </li>
            <li className="item">
              <div>
                <strong>REQ-1068 / Carpintería lobby</strong>
                <div className="meta">Compra premium esperando comparativo final.</div>
              </div>
              <span className="status statusWarn">Compras</span>
            </li>
            <li className="item">
              <div>
                <strong>REQ-1091 / Equipo temporal</strong>
                <div className="meta">Renta de equipo vinculada a frente de obra.</div>
              </div>
              <span className="status statusInfo">Operación</span>
            </li>
          </ul>
        </article>

        <article className="card">
          <h3>Salud del proceso</h3>
          <div className="meta">Tiempo de aprobación</div>
          <div className="progress" style={{ marginTop: 12 }}>
            <span style={{ width: "79%" }} />
          </div>
          <div className="meta" style={{ marginTop: 16 }}>Cobertura documental</div>
          <div className="progress" style={{ marginTop: 12 }}>
            <span style={{ width: "91%" }} />
          </div>
          <div className="meta" style={{ marginTop: 16 }}>Disciplina presupuestal</div>
          <div className="progress" style={{ marginTop: 12 }}>
            <span style={{ width: "74%" }} />
          </div>
          <p className="footnote">
            La ruta real ya puede crecer después hacia detalle de requisición,
            integraciones y aprobaciones multinivel.
          </p>
        </article>
      </section>

      <section className="grid cols3">
        <article className="card">
          <h3>Módulos vivos</h3>
          <div className="tagRow">
            <span className="tag">requisiciones</span>
            <span className="tag">compras</span>
            <span className="tag">almacén</span>
            <span className="tag">tesorería</span>
            <span className="tag">costos</span>
          </div>
        </article>
        <article className="card">
          <h3>Focos de atención</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Frente</th>
                <th>Riesgo</th>
                <th>Dueño</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Torre C</td>
                <td>Sobrecompra</td>
                <td>Control de costos</td>
              </tr>
              <tr>
                <td>Patio Centro</td>
                <td>Retraso de surtido</td>
                <td>Compras</td>
              </tr>
              <tr>
                <td>Marina</td>
                <td>Flujo comprometido</td>
                <td>Tesorería</td>
              </tr>
            </tbody>
          </table>
        </article>
        <article className="card">
          <h3>Objetivo</h3>
          <p>
            Esta pantalla convierte el mockup de backoffice en una base real para ERP
            operativo, con foco en decisiones y no solo en captura administrativa.
          </p>
        </article>
      </section>
    </AppShell>
  );
}
