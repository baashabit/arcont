import type { ReactNode } from "react";

export function FilterBar({
  summary,
  children
}: {
  summary: string;
  children?: ReactNode;
}) {
  return (
    <div className="filterBar">
      <div className="filterBarMeta">{summary}</div>
      <div className="filterBarControls">{children}</div>
    </div>
  );
}
