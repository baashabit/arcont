import { Badge } from "@/components/ui/badge";

export function KpiCard({
  label,
  value,
  footnote,
  badge
}: {
  label: string;
  value: string;
  footnote: string;
  badge?: { label: string; tone?: Parameters<typeof Badge>[0]["tone"] };
}) {
  return (
    <article className="kpiCard">
      <div className="kpiHeader">
        <span className="kpiLabel">{label}</span>
        {badge ? <Badge tone={badge.tone}>{badge.label}</Badge> : null}
      </div>
      <div className="kpiValue">{value}</div>
      <div className="kpiFootnote">{footnote}</div>
    </article>
  );
}
