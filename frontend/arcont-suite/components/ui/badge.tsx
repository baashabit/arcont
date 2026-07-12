import type { ReactNode } from "react";

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "gold";

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: BadgeTone }) {
  return <span className={`badge badge${tone[0].toUpperCase()}${tone.slice(1)}`}>{children}</span>;
}
