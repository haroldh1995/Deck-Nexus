import type { ReactNode } from "react";

export function PageHeader({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <p className="page-header__sigil">Deck Nexus</p>
        <h1>{title}</h1>
      </div>
      {children ? <div className="page-header__actions">{children}</div> : null}
    </header>
  );
}
