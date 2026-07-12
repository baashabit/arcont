import Link from "next/link";
import { loadAppData } from "@/lib/app-data";
import { LogoMark } from "@/components/logo-mark";
import { Badge } from "@/components/ui/badge";

export default async function LoginPage() {
  const data = await loadAppData();
  const companies = data.companies.slice(0, 3);

  return (
    <main className="loginPage">
      <section className="loginHero">
        <div>
          <div className="brandCard">
            <LogoMark />
            <div className="brandMeta">
              <strong>ARCONT SUITE</strong>
              <small>Platform, operations and traceability in one shell</small>
            </div>
          </div>

          <div className="loginLead">
            <h1>Control the platform before you scale the operation.</h1>
            <p>
              This foundation already separates tenant governance from operational domains, aligns with shared
              contracts and keeps a graceful path between API mode and local development.
            </p>
          </div>
        </div>

        <div className="grid cols2">
          <div className="heroMetric">
            <strong>{companies.length} tenants</strong>
            <span>Ready for multi-company switching and module entitlements.</span>
          </div>
          <div className="heroMetric">
            <strong>{data.modules.length} modules</strong>
            <span>Catalogued from shared contracts for platform and operations.</span>
          </div>
        </div>
      </section>

      <section className="loginPanel">
        <div className="loginCard">
          <div className="tagRow">
            <Badge tone={data.source === "api" ? "success" : "warning"}>{data.source}</Badge>
            <Badge tone="gold">tenant-aware</Badge>
            <Badge tone="info">module-gated</Badge>
          </div>

          <h2 className="sectionTitle" style={{ marginTop: 18 }}>
            Sign in to the web foundation
          </h2>
          <p className="sectionText">
            Demo access is represented here without wiring a full auth flow yet. The platform pages already
            consume real contracts and can read from the API when it is available locally.
          </p>

          <div className="loginGrid">
            <input className="field" aria-label="Email" defaultValue={data.session.user.email} />
            <input className="field" aria-label="Password" defaultValue="********" />
            <select className="selectField" defaultValue={data.session.companyId}>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.tradeName}
                </option>
              ))}
            </select>
          </div>

          <div className="emptyActions">
            <Link className="button" href="/dashboard">
              Enter dashboard
            </Link>
            <Link className="buttonGhost" href="/platform/companies">
              Review platform
            </Link>
          </div>

          <div style={{ marginTop: 24 }}>
            <h3 className="sectionTitle">Bootstrap notes</h3>
            <div className="list">
              <div className="listItem">
                <div>
                  <strong>Current API base</strong>
                  <p className="mono">{data.apiBaseUrl}</p>
                </div>
              </div>
              <div className="listItem">
                <div>
                  <strong>Example tenants</strong>
                  <p>{companies.map((company) => company.tradeName).join(", ")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
