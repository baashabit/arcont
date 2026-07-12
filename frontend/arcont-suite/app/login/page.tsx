"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LogoMark } from "@/components/logo-mark";
import { useAppState } from "@/components/providers/app-state-provider";
import { Badge } from "@/components/ui/badge";

export default function LoginPage() {
  const router = useRouter();
  const { companies, session, signIn, source, isHydratingSession } = useAppState();
  const [email, setEmail] = useState(session.user.email);
  const [password, setPassword] = useState("password123");
  const [companyId, setCompanyId] = useState(session.companyId);
  const [error, setError] = useState<string | null>(null);
  const [resultSource, setResultSource] = useState<"api" | "mock" | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await signIn({
        email,
        password,
        companyId
      });

      setResultSource(result.source);

      if (!result.ok) {
        setError(result.error ?? "Unable to sign in.");
        return;
      }

      router.push("/dashboard");
    });
  };

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
            <h1>Sign into a real tenant context, not just a visual prototype.</h1>
            <p>
              This login now tries the backend first through `POST /auth/login`, then keeps a development-safe
              fallback so the web shell remains usable even when the API is offline.
            </p>
          </div>
        </div>

        <div className="grid cols2">
          <div className="heroMetric">
            <strong>{companies.length} tenants</strong>
            <span>Company switching is now prepared to reload bootstrap context per tenant.</span>
          </div>
          <div className="heroMetric">
            <strong>{source}</strong>
            <span>Initial load can come from API or local fallback depending on environment readiness.</span>
          </div>
        </div>
      </section>

      <section className="loginPanel">
        <div className="loginCard">
          <div className="tagRow">
            <Badge tone={source === "api" ? "success" : "warning"}>{source}</Badge>
            <Badge tone="gold">bootstrap-ready</Badge>
            <Badge tone="info">jwt-session</Badge>
          </div>

          <h2 className="sectionTitle" style={{ marginTop: 18 }}>
            Enter the enterprise shell
          </h2>
          <p className="sectionText">
            Demo backend credentials from the in-memory driver include `admin@arcont.local / password123` and
            `obra@arcont.local / password123`.
          </p>

          <form className="loginGrid" onSubmit={handleSubmit}>
            <input
              className="field"
              aria-label="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <input
              className="field"
              aria-label="Password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <select
              className="selectField"
              value={companyId}
              onChange={(event) => setCompanyId(event.target.value)}
            >
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.tradeName}
                </option>
              ))}
            </select>

            {error ? <p className="sectionText" style={{ color: "var(--danger)" }}>{error}</p> : null}

            <div className="emptyActions">
              <button className="button" type="submit" disabled={isPending || isHydratingSession}>
                {isPending || isHydratingSession ? "Signing in..." : "Sign in"}
              </button>
              <Link className="buttonGhost" href="/dashboard">
                Continue to dashboard
              </Link>
            </div>
          </form>

          <div style={{ marginTop: 24 }}>
            <h3 className="sectionTitle">Integration notes</h3>
            <div className="list">
              <div className="listItem">
                <div>
                  <strong>Result source</strong>
                  <p>{resultSource ? `Last sign-in used ${resultSource}.` : "No sign-in attempted in this session."}</p>
                </div>
              </div>
              <div className="listItem">
                <div>
                  <strong>Post-login bootstrap</strong>
                  <p>After successful auth, the app reloads tenant modules, users, roles, permissions and settings through `/platform/bootstrap`.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
