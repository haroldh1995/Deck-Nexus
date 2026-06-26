import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

type HolographicPanelProps<T extends ElementType> = {
  as?: T;
  variant?: "panel" | "card" | "quiet";
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children">;

export function HolographicPanel<T extends ElementType = "section">({
  as,
  variant = "panel",
  className,
  children,
  ...props
}: HolographicPanelProps<T>) {
  const Component = as ?? "section";
  const classes = ["holo-panel", `holo-panel--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <Component className={classes} {...props}>
      {children}
    </Component>
  );
}
