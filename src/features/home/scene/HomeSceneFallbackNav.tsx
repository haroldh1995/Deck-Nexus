import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { AppIcon } from "../../../components/AppIcon";
import type { HomeHologramCard } from "./homeSceneTypes";

export function HomeSceneFallbackNav({
  cards,
  selectedId,
  staticHomeScreen,
  onSelect,
  onMoveSelected,
}: {
  cards: readonly HomeHologramCard[];
  selectedId: string;
  staticHomeScreen: boolean;
  onSelect: (id: string) => void;
  onMoveSelected: (direction: -1 | 1) => void;
}) {
  return (
    <section
      aria-label="Command fallback navigation"
      className={`home-accessibility-nav${
        staticHomeScreen ? " home-accessibility-nav--static" : ""
      }`}
    >
      <div className="home-accessibility-nav__grid">
        {cards.map((card) => (
          <Link
            aria-label={card.actionLabel}
            className="home-accessibility-nav__item"
            data-testid={`fallback-card-${card.id}`}
            key={card.id}
            to={card.route}
          >
            <AppIcon name={card.icon} />
            <span>
              <strong>{card.label}</strong>
              <small>{card.subtitle}</small>
            </span>
          </Link>
        ))}
      </div>

      <div className="orbit-order-panel" aria-label="Orbit order controls">
        <label htmlFor="orbit-order-select">Orbit order</label>
        <select
          id="orbit-order-select"
          onChange={(event) => onSelect(event.target.value)}
          value={selectedId}
        >
          {cards.map((card) => (
            <option key={card.id} value={card.id}>
              {card.label}
            </option>
          ))}
        </select>
        <button
          aria-label="Move selected orbit card earlier"
          title="Move earlier"
          type="button"
          onClick={() => onMoveSelected(-1)}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
        <button
          aria-label="Move selected orbit card later"
          title="Move later"
          type="button"
          onClick={() => onMoveSelected(1)}
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
