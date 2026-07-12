import { AppShell } from "../../components/app-shell";

export default function InventoryPage() {
  return (
    <AppShell
      title="Inventario"
      subtitle="Vista operable para disponibilidad, absorcion, reservas y riesgo comercial por torre, tipologia y unidad."
    >
      <section className="grid cols4">
        <article className="metric">
          <div className="eyebrow">Unidades disponibles</div>
          <div className="value">312</div>
          <div className="meta">Stock actual en comercialización.</div>
        </article>
        <article className="metric">
          <div className="eyebrow">Reservadas</div>
          <div className="value">48</div>
          <div className="meta">Con separación activa.</div>
        </article>
        <article className="metric">
          <div className="eyebrow">Inventario frío</div>
          <div className="value">76</div>
          <div className="meta">Sin movimiento reciente.</div>
        </article>
        <article className="metric">
          <div className="eyebrow">Absorción mensual</div>
          <div className="value">5.8%</div>
          <div className="meta">Dentro del rango meta.</div>
        </article>
      </section>

      <section className="grid cols2">
        <article className="card">
          <h3>Riesgo por frente</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Torre</th>
                <th>Disponibles</th>
                <th>Riesgo</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Torre B</td>
                <td>64</td>
                <td><span className="status statusOk">Saludable</span></td>
              </tr>
              <tr>
                <td>Torre C</td>
                <td>92</td>
                <td><span className="status statusWarn">Atención</span></td>
              </tr>
              <tr>
                <td>Garden House</td>
                <td>21</td>
                <td><span className="status statusInfo">Premium</span></td>
              </tr>
              <tr>
                <td>Etapa 2</td>
                <td>135</td>
                <td><span className="status statusWarn">Lanzamiento</span></td>
              </tr>
            </tbody>
          </table>
        </article>

        <article className="card">
          <h3>Lectura comercial</h3>
          <div className="meta">Cobertura de reservas</div>
          <div className="progress" style={{ marginTop: 12 }}>
            <span style={{ width: "62%" }} />
          </div>
          <div className="meta" style={{ marginTop: 16 }}>Velocidad de absorción</div>
          <div className="progress" style={{ marginTop: 12 }}>
            <span style={{ width: "71%" }} />
          </div>
          <div className="meta" style={{ marginTop: 16 }}>Exposición de inventario frío</div>
          <div className="progress" style={{ marginTop: 12 }}>
            <span style={{ width: "39%" }} />
          </div>
          <p className="footnote">
            Esta ruta ya se puede convertir después en grid por unidad, filtros y acciones
            de reserva o asignación comercial.
          </p>
        </article>
      </section>

      <section className="grid cols3">
        <article className="card">
          <h3>Tipologías calientes</h3>
          <div className="tagRow">
            <span className="tag">2 recámaras</span>
            <span className="tag">lock-off</span>
            <span className="tag">garden</span>
            <span className="tag">vista amenidad</span>
          </div>
        </article>
        <article className="card">
          <h3>Acciones recomendadas</h3>
          <ul className="list">
            <li className="item">
              <div>
                <strong>Repricing torre C</strong>
                <div className="meta">Explorar bundle antes de descuento directo.</div>
              </div>
              <span className="status statusWarn">Pricing</span>
            </li>
            <li className="item">
              <div>
                <strong>Campaña para etapa 2</strong>
                <div className="meta">Activar preventa segmentada por perfil inversionista.</div>
              </div>
              <span className="status statusOk">Go</span>
            </li>
          </ul>
        </article>
        <article className="card">
          <h3>Destino</h3>
          <p>
            Aquí ya estamos aterrizando una versión real del mockup de inventario para que
            luego podamos conectarla al stock verdadero del sistema.
          </p>
        </article>
      </section>
    </AppShell>
  );
}
