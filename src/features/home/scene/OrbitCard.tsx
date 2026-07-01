import { memo, type CSSProperties, type Ref } from "react";
import { AppIcon } from "../../../components/AppIcon";
import type { HomeHologramCard } from "./homeSceneTypes";

export const OrbitCard = memo(function OrbitCard({
  card,
  cardRef,
  index,
  total,
  focused,
  reducedMotion,
  onClick,
}: {
  card: HomeHologramCard;
  cardRef: Ref<HTMLButtonElement>;
  index: number;
  total: number;
  focused: boolean;
  reducedMotion: boolean;
  onClick: () => void;
}) {
  return (
    <button
      ref={cardRef}
      aria-current={focused ? "true" : undefined}
      aria-label={`${card.label}. ${card.subtitle}. ${index + 1} of ${total}. ${
        focused ? "Open this command." : "Focus this command."
      }`}
      className={`home-orbit-card${focused ? " is-focused" : ""}${
        reducedMotion ? " is-reduced" : ""
      }`}
      data-focused={focused}
      data-card-id={card.id}
      data-testid={`orbit-card-${card.id}`}
      data-depth="front"
      data-index={index}
      onClick={onClick}
      style={{
        "--card-index": index,
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
});
