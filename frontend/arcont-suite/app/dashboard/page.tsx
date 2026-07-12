import { AppShell } from "../../components/app-shell";

export default function DashboardPage() {
  return (
    <AppShell
      title="Executive Dashboard"
      subtitle="Lectura ejecutiva inicial para ventas, cierre, inventario y bloqueos críticos."
    >
      <section className="grid cols4">
        <article className="metric">
          <div className="eyebrow">Prospectos</div>
          <div className="value">1,284</div>
          <div className="meta">Activos y priorizados por señal comercial.</div>
        </article>
        <article className="metric">
          <div className="eyebrow">Cierres</div>
          <div className="value">218</div>
          <div className="meta">Conversión consolidada por proyecto.</div>
        </article>
        <article className="metric">
          <div className="eyebrow">Gestoría</div>
          <div className="value">29</div>
          <div className="meta">Expedientes en riesgo.</div>
        </article>
        <article className="metric">
          <div className="eyebrow">Requisiciones</div>
          <div className="value">37</div>
          <div className="meta">Pendientes con foco ejecutivo.</div>
        </article>
      </section>

      <section className="grid cols2">
        <article className="card">
          <h3>Cuellos de botella</h3>
          <ul className="list">
            <li className="item">
              <div>
                <strong>Gestoría atrasada</strong>
                <div className="meta">Documentación incompleta y saturación notarial.</div>
              </div>
              <span className="status statusAlert">Crítico</span>
            </li>
            <li className="item">
              <div>
                <strong>Inventario frío</strong>
                <div className="meta">76 unidades sin movimiento reciente.</div>
              </div>
              <span className="status statusWarn">Atención</span>
            </li>
          </ul>
        </article>

        <article className="card">
          <h3>Decisión esperada</h3>
          <p>
            Esta pantalla ya marca el tono del nuevo producto: menos tablas planas y
            más visibilidad accionable para dirección.
          </p>
        </article>
      </section>
    </AppShell>
  );
}
