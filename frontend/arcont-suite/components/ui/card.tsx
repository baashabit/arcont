import type { ReactNode } from "react";

export function Card({
  title,
  description,
  aside,
  children
}: {
  title: string;
  description?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="surface">
      <div className="surfaceHeader">
        <div>
          <h3>{title}</h3>
          {description ? <p>{description}</p> : null}
        </div>
        {aside}
      </div>
      <div className="surfaceBody">{children}</div>
    </section>
  );
}
