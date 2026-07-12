import { AppShell } from "../../components/app-shell";

export default function CrmPage() {
  return (
    <AppShell
      title="CRM Prospectos"
      subtitle="Punto de partida real para captación, calificación, reserva y seguimiento comercial."
    >
      <section className="grid cols3">
        <article className="card">
          <h3>Pipeline</h3>
          <ul className="list">
            <li className="item">
              <div>
                <strong>Captado</strong>
                <div className="meta">422 leads</div>
              </div>
              <span className="status statusOk">Activo</span>
            </li>
            <li className="item">
              <div>
                <strong>Calificado</strong>
                <div className="meta">188 leads listos para visita.</div>
              </div>
              <span className="status statusWarn">Seguimiento</span>
            </li>
            <li className="item">
              <div>
                <strong>Reserva</strong>
                <div className="meta">54 oportunidades con unidad asignada.</div>
              </div>
              <span className="status statusOk">Revenue</span>
            </li>
          </ul>
        </article>
        <article className="card">
          <h3>Cliente destacado</h3>
          <div className="detailGrid">
            <div className="detailRow">
              <div className="detailLabel">Cliente</div>
              <div>Aaron Molina</div>
            </div>
            <div className="detailRow">
              <div className="detailLabel">Unidad sugerida</div>
              <div>B-1406</div>
            </div>
            <div className="detailRow">
              <div className="detailLabel">Estado</div>
              <div>Listo para visita</div>
            </div>
          </div>
        </article>
        <article className="card">
          <h3>Enfoque</h3>
          <p>
            Esta ruta ya prepara la migración del módulo legado de prospectos hacia un
            CRM más claro, más limpio y más ejecutable.
          </p>
        </article>
      </section>
    </AppShell>
  );
}
