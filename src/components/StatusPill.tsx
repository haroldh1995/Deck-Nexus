import type { ReactNode } from "react";

export function StatusPill({
  children,
  tone = "cyan",
}: {
  children: ReactNode;
  tone?: "cyan" | "violet" | "silver" | "amber";
}) {
  return <span className={`status-pill status-pill--${tone}`}>{children}</span>;
}
