import Link from "next/link";

export function EmptyState({
  title,
  description,
  primaryAction,
  secondaryAction
}: {
  title: string;
  description: string;
  primaryAction?: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
}) {
  return (
    <section className="emptyState">
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="emptyActions">
        {primaryAction ? (
          <Link className="button" href={primaryAction.href}>
            {primaryAction.label}
          </Link>
        ) : null}
        {secondaryAction ? (
          <Link className="buttonGhost" href={secondaryAction.href}>
            {secondaryAction.label}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
