import Link from "next/link";

export default function LoginPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "1.05fr 0.95fr",
        background:
          "radial-gradient(circle at top left, rgba(110,156,203,0.22), transparent 32%), linear-gradient(180deg, #f8fbfe 0%, #eef4f9 100%)"
      }}
    >
      <section
        style={{
          padding: "42px",
          background:
            "linear-gradient(135deg, rgba(15,27,51,0.98), rgba(25,75,132,0.96))",
          color: "white"
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "14px",
            padding: "14px 16px",
            borderRadius: "18px",
            background: "rgba(255,255,255,0.06)"
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              display: "grid",
              placeItems: "center",
              background: "linear-gradient(135deg, #6E9CCB, #194B84)",
              fontWeight: 800
            }}
          >
            A
          </div>
          <div>
            <strong style={{ display: "block", letterSpacing: "0.06em" }}>
              ARCONT SUITE
            </strong>
            <small style={{ color: "rgba(255,255,255,0.68)" }}>
              Real Estate Operating System
            </small>
          </div>
        </div>

        <div style={{ marginTop: 48, maxWidth: 560 }}>
          <h1
            style={{
              margin: 0,
              fontSize: "clamp(2.8rem, 5vw, 4.6rem)",
              lineHeight: 1,
              letterSpacing: "-0.05em"
            }}
          >
            Un acceso a todo el negocio.
          </h1>
          <p style={{ marginTop: 16, color: "rgba(255,255,255,0.76)", lineHeight: 1.62 }}>
            La nueva capa de ARCONT ya arranca con una identidad más seria y una
            base lista para MFA, sesiones auditables y rutas por rol.
          </p>
        </div>
      </section>

      <section style={{ display: "grid", placeItems: "center", padding: "42px 24px" }}>
        <div
          style={{
            width: "min(100%, 520px)",
            padding: 32,
            borderRadius: 28,
            background: "rgba(255,255,255,0.94)",
            border: "1px solid rgba(15,27,51,0.08)",
            boxShadow: "0 24px 54px rgba(15,27,51,0.12)"
          }}
        >
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {["Nuevo acceso", "Seguro", "Role-first"].map((item) => (
              <span
                key={item}
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  background: "rgba(25,75,132,0.08)",
                  color: "#194B84",
                  fontSize: "0.82rem"
                }}
              >
                {item}
              </span>
            ))}
          </div>

          <h1 style={{ margin: "16px 0 0", fontSize: "clamp(2rem, 4vw, 2.8rem)" }}>
            Bienvenido de nuevo
          </h1>
          <p style={{ color: "#64748f", lineHeight: 1.58 }}>
            Accede a ventas, operación, gestoría, inventario, requisiciones y
            reportes desde una sola plataforma.
          </p>

          <div style={{ display: "grid", gap: 14, marginTop: 20 }}>
            <label>
              <div style={{ marginBottom: 8, color: "#64748f", fontSize: "0.88rem" }}>
                Usuario o correo
              </div>
              <input
                defaultValue="aaron.molina@arcont.mx"
                aria-label="Usuario o correo"
                style={{
                  width: "100%",
                  height: 52,
                  padding: "0 16px",
                  borderRadius: 16,
                  border: "1px solid rgba(15,27,51,0.12)",
                  background: "rgba(247,250,253,0.9)",
                  font: "inherit"
                }}
              />
            </label>
            <label>
              <div style={{ marginBottom: 8, color: "#64748f", fontSize: "0.88rem" }}>
                Contraseña
              </div>
              <input
                defaultValue="************"
                aria-label="Contraseña"
                style={{
                  width: "100%",
                  height: 52,
                  padding: "0 16px",
                  borderRadius: 16,
                  border: "1px solid rgba(15,27,51,0.12)",
                  background: "rgba(247,250,253,0.9)",
                  font: "inherit"
                }}
              />
            </label>
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "0 16px",
                height: 44,
                borderRadius: 999,
                border: "1px solid rgba(15,27,51,0.1)",
                background: "white"
              }}
            >
              Volver al overview
            </Link>
            <Link
              href="/dashboard"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "0 16px",
                height: 44,
                borderRadius: 999,
                background: "linear-gradient(135deg, #194B84, #4E95C7)",
                color: "white"
              }}
            >
              Ingresar al sistema
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
