import { AppShell } from "../../components/app-shell";

export default function Customer360Page() {
  return (
    <AppShell
      title="Cliente 360"
      subtitle="Ficha única conectada a prospecto, unidad, expediente y próximos pasos."
    >
      <section className="grid cols2">
        <article className="card">
          <h3>Resumen del cliente</h3>
          <div className="detailGrid">
            <div className="detailRow">
              <div className="detailLabel">Nombre</div>
              <div>Aaron Molina</div>
            </div>
            <div className="detailRow">
              <div className="detailLabel">Unidad</div>
              <div>B-1406</div>
            </div>
            <div className="detailRow">
              <div className="detailLabel">Owner</div>
              <div>Sandra Pérez</div>
            </div>
            <div className="detailRow">
              <div className="detailLabel">Expediente</div>
              <div>Exp-24031</div>
            </div>
          </div>
        </article>
        <article className="card">
          <h3>Timeline</h3>
          <div className="timeline">
            <div className="timelineItem">
              <strong>Lead captado</strong>
              <div className="meta">Ingreso desde canal digital.</div>
            </div>
            <div className="timelineItem">
              <strong>Perfilado comercial</strong>
              <div className="meta">Alineado a Torre B.</div>
            </div>
            <div className="timelineItem">
              <strong>Próxima visita</strong>
              <div className="meta">Programada para esta semana.</div>
            </div>
          </div>
        </article>
      </section>
    </AppShell>
  );
}
