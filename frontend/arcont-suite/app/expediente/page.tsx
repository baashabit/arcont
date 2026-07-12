import Link from "next/link";
import { AppShell } from "../../components/app-shell";

export default function ExpedientePage() {
  return (
    <AppShell
      title="Expediente"
      subtitle="Detalle de caso con checklist, hitos, bloqueos y responsables visibles para bajar la caja negra del cierre."
    >
      <section className="grid splitStrong">
        <article className="card">
          <div className="profileHeader">
            <div className="avatar">E</div>
            <div>
              <h3 style={{ marginBottom: 6 }}>EXP-24031</h3>
              <div className="tagRow">
                <span className="tag">Adriana León</span>
                <span className="tag">Unidad B-1406</span>
                <span className="tag">Brenda Solís</span>
              </div>
            </div>
          </div>

          <div className="kpiRow" style={{ marginTop: 18 }}>
            <div className="kpiBox">
              <strong>81%</strong>
              <div className="meta">Completitud</div>
            </div>
            <div className="kpiBox">
              <strong>5</strong>
              <div className="meta">Documentos validados</div>
            </div>
            <div className="kpiBox">
              <strong>2</strong>
              <div className="meta">Bloqueos activos</div>
            </div>
          </div>

          <div className="grid cols2" style={{ marginTop: 18 }}>
            <div className="card" style={{ padding: 18 }}>
              <h3>Resumen</h3>
              <div className="detailGrid">
                <div className="detailRow">
                  <div className="detailLabel">Proyecto</div>
                  <div>Patio Centro</div>
                </div>
                <div className="detailRow">
                  <div className="detailLabel">Notaría</div>
                  <div>Notaría 4</div>
                </div>
                <div className="detailRow">
                  <div className="detailLabel">Estatus</div>
                  <div><span className="status statusWarn">Validación final</span></div>
                </div>
                <div className="detailRow">
                  <div className="detailLabel">Fecha objetivo</div>
                  <div>22 abril 2026</div>
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: 18 }}>
              <h3>Checklist</h3>
              <div className="meta">Identidad</div>
              <div className="progress" style={{ marginTop: 10 }}>
                <span style={{ width: "100%" }} />
              </div>
              <div className="meta" style={{ marginTop: 14 }}>Crédito</div>
              <div className="progress" style={{ marginTop: 10 }}>
                <span style={{ width: "82%" }} />
              </div>
              <div className="meta" style={{ marginTop: 14 }}>Notaría</div>
              <div className="progress" style={{ marginTop: 10 }}>
                <span style={{ width: "61%" }} />
              </div>
            </div>
          </div>
        </article>

        <article className="card">
          <h3>Hitos del expediente</h3>
          <div className="timeline">
            <div className="timelineItem">
              <strong>Expediente creado</strong>
              <div className="meta">Se vinculó desde CRM al momento de separación.</div>
            </div>
            <div className="timelineItem">
              <strong>Documentación base completa</strong>
              <div className="meta">Identidad y RFC ya validados.</div>
            </div>
            <div className="timelineItem">
              <strong>Crédito en validación</strong>
              <div className="meta">Falta confirmación de documento complementario.</div>
            </div>
            <div className="timelineItem">
              <strong>Agenda notarial pendiente</strong>
              <div className="meta">La notaría sigue sin fecha confirmada.</div>
            </div>
          </div>

          <div className="panelNote" style={{ marginTop: 20 }}>
            <strong>Bloqueos visibles</strong>
            <p className="footnote" style={{ marginTop: 8 }}>
              La pantalla ya está pensada para dejar claro qué falta, quién lo mueve y
              cuánto compromete la fecha de cierre.
            </p>
          </div>

          <div style={{ marginTop: 18 }}>
            <Link href="/gestoria" className="button buttonPrimary">
              Volver a Gestoria
            </Link>
          </div>
        </article>
      </section>

      <section className="grid cols3">
        <article className="card">
          <h3>Bloqueos</h3>
          <ul className="list">
            <li className="item">
              <div>
                <strong>Comprobante complementario</strong>
                <div className="meta">Pendiente por parte del cliente.</div>
              </div>
              <span className="status statusWarn">Cliente</span>
            </li>
            <li className="item">
              <div>
                <strong>Agenda notarial</strong>
                <div className="meta">Fecha tentativa todavía sin confirmación.</div>
              </div>
              <span className="status statusAlert">Externo</span>
            </li>
          </ul>
        </article>
        <article className="card">
          <h3>Documentos</h3>
          <ul className="list">
            <li className="item">
              <div>
                <strong>RFC</strong>
                <div className="meta">Validado</div>
              </div>
              <span className="status statusOk">OK</span>
            </li>
            <li className="item">
              <div>
                <strong>NSS</strong>
                <div className="meta">Validado</div>
              </div>
              <span className="status statusOk">OK</span>
            </li>
            <li className="item">
              <div>
                <strong>Comprobante</strong>
                <div className="meta">Pendiente</div>
              </div>
              <span className="status statusWarn">Falta</span>
            </li>
          </ul>
        </article>
        <article className="card">
          <h3>Qué mejora</h3>
          <div className="tagRow">
            <span className="tag">menos caja negra</span>
            <span className="tag">ownership visible</span>
            <span className="tag">mejor SLA</span>
          </div>
          <p className="footnote">
            Esta ya es una versión real del detalle de expediente del mockup, lista para
            después conectarse a documentos, comentarios y eventos reales.
          </p>
        </article>
      </section>
    </AppShell>
  );
}
