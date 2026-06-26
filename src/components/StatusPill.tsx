export function StatusPill({
  children,
  tone = "cyan",
}: {
  children: string;
  tone?: "cyan" | "violet" | "silver";
}) {
  return <span className={`status-pill status-pill--${tone}`}>{children}</span>;
}
