import type { CSSProperties, PointerEvent } from "react";
import { AppIcon } from "../../../components/AppIcon";
import type { HomeHologramCard, OrbitTransform } from "./homeSceneTypes";

export function OrbitCard({
  card,
  transform,
  index,
  focused,
  distorted,
  reducedMotion,
  onClick,
  onPointerDown,
}: {
  card: HomeHologramCard;
  transform: OrbitTransform;
  index: number;
  focused: boolean;
  distorted: boolean;
  reducedMotion: boolean;
  onClick: () => void;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      aria-current={focused ? "true" : undefined}
      aria-label={`${card.label}. ${card.subtitle}. ${
        focused ? "Open this command." : "Focus this command."
      }`}
      className={`home-orbit-card${focused ? " is-focused" : ""}${
        transform.rear ? " is-rear" : ""
      }${distorted ? " is-distorting" : ""}${
        reducedMotion ? " is-reduced" : ""
      }`}
      data-focused={focused}
      data-testid={`orbit-card-${card.id}`}
      data-depth={transform.rear ? "rear" : "front"}
      data-index={index}
      onClick={onClick}
      onPointerDown={onPointerDown}
      style={{
        filter: "none",
        opacity: "var(--card-opacity)",
        transform: `translate3d(calc(-50% + ${transform.x}px), ${transform.y}px, ${transform.z}px) rotateY(${transform.rotationY}deg) rotateX(${transform.rotationX}deg) scale(${transform.scale})`,
        zIndex: transform.zIndex,
        "--card-filter": "none",
        "--card-glow": transform.glow,
        "--card-opacity": transform.opacity,
      } as CSSProperties}
      type="button"
    >
      <span className="home-orbit-card__edge" aria-hidden="true" />
      <span className="home-orbit-card__corner home-orbit-card__corner--tl" />
      <span className="home-orbit-card__corner home-orbit-card__corner--tr" />
      <span className="home-orbit-card__corner home-orbit-card__corner--bl" />
      <span className="home-orbit-card__corner home-orbit-card__corner--br" />
      <span className="home-orbit-card__scan" aria-hidden="true" />
      <span className="home-orbit-card__icon-shell" aria-hidden="true">
        <AppIcon name={card.icon} />
        <span className="home-orbit-card__glyph">{card.visualGlyph}</span>
      </span>
      <span className="home-orbit-card__copy">
        <strong>{card.label}</strong>
        <small>{card.subtitle}</small>
      </span>
      <span className="home-orbit-card__action">{card.actionLabel}</span>
      <span className="home-orbit-card__back-rune" aria-hidden="true">
        <span />
      </span>
    </button>
  );
}
