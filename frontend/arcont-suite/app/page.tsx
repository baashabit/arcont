import { AppShell } from "../components/app-shell";

export default function HomePage() {
  return (
    <AppShell
      title="ARCONT Frontend"
      subtitle="Base real de Next.js para empezar la transición del rediseño a producto operable."
    >
      <section className="hero">
        <div>
          <h2>Una base real para reemplazar la capa legacy.</h2>
          <p>
            Este proyecto ya no es solo mockup. Aquí arranca la aplicación nueva de
            ARCONT con un shell consistente y rutas clave para dirección, CRM y
            customer 360.
          </p>
          <div className="heroMetrics">
            <div className="heroMetric">
              <strong>Next.js</strong>
              <span>App Router</span>
            </div>
            <div className="heroMetric">
              <strong>ARCONT</strong>
              <span>Marca unificada</span>
            </div>
            <div className="heroMetric">
              <strong>8 rutas</strong>
              <span>Front office y backoffice</span>
            </div>
          </div>
        </div>
        <div className="card">
          <h3>Fases inmediatas</h3>
          <ul className="list">
            <li className="item">
              <div>
                <strong>1. Shell e identidad</strong>
                <div className="meta">Base de navegación, layout y branding.</div>
              </div>
            </li>
            <li className="item">
              <div>
                <strong>2. Dashboard ejecutivo</strong>
                <div className="meta">Primera experiencia con impacto para dirección.</div>
              </div>
            </li>
            <li className="item">
              <div>
                <strong>3. CRM y cliente 360</strong>
                <div className="meta">Ruta comercial y de cierre sobre nueva UI.</div>
              </div>
            </li>
            <li className="item">
              <div>
                <strong>4. Inventario, gestoría y ERP</strong>
                <div className="meta">Nuevas vistas reales para operación y backoffice.</div>
              </div>
            </li>
          </ul>
        </div>
      </section>

      <section className="grid cols4">
        <article className="metric">
          <div className="eyebrow">Marca</div>
          <div className="value">ARCONT</div>
          <div className="meta">Paleta alineada al logo enterprise.</div>
        </article>
        <article className="metric">
          <div className="eyebrow">Ruta</div>
          <div className="value">Gradual</div>
          <div className="meta">Sin romper la lógica actual.</div>
        </article>
        <article className="metric">
          <div className="eyebrow">Base</div>
          <div className="value">Typed</div>
          <div className="meta">TypeScript desde el inicio.</div>
        </article>
        <article className="metric">
          <div className="eyebrow">Foco</div>
          <div className="value">Pro</div>
          <div className="meta">UX más seria y comprable.</div>
        </article>
      </section>

      <section className="cards">
        <a className="routeCard" href="/inventory">
          <strong>Inventario</strong>
          <p>Disponibilidad, absorción y riesgo comercial por torre y tipología.</p>
        </a>
        <a className="routeCard" href="/gestoria">
          <strong>Gestoria</strong>
          <p>Pipeline de cierre, bloqueos documentales y coordinación notarial.</p>
        </a>
        <a className="routeCard" href="/expediente">
          <strong>Expediente</strong>
          <p>Detalle de caso con checklist, hitos y responsables visibles.</p>
        </a>
        <a className="routeCard" href="/backoffice">
          <strong>Backoffice</strong>
          <p>Requisiciones, aprobaciones y salud administrativa del proceso.</p>
        </a>
      </section>
    </AppShell>
  );
}
