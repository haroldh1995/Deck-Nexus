import type { CommanderColor, Deck, DeckCard } from "../../types/domain";
import {
  getCardBuilderSection,
  getMainDeckCount,
} from "./cardClassification";
import {
  mainBuilderSectionIds,
  type BuilderSectionId,
  type BuilderTab,
} from "./builderTypes";

export const deckWorkspaceSectionOrder: BuilderSectionId[] = [
  "creatures",
  "instants",
  "sorceries",
  "artifacts",
  "enchantments",
  "otherPermanents",
  "lands",
];

export const deckWorkspaceSectionRows: BuilderSectionId[][] = [
  ["creatures"],
  ["instants", "sorceries"],
  ["artifacts", "enchantments"],
  ["otherPermanents", "lands"],
];

export type DeckCountTone = "progress" | "complete" | "attention" | "over";

export interface DeckCountSummary {
  count: number;
  required: 100;
  status: "Incomplete" | "Complete" | "Legal" | "Illegal" | "Over Limit";
  tone: DeckCountTone;
  ariaLabel: string;
}

export interface ColorIdentityOrbState {
  color: CommanderColor;
  label: string;
  shortLabel: string;
  active: boolean;
  description: string;
}

export interface ColorlessIdentityState {
  active: boolean;
  description: string;
}

const colorOrder: CommanderColor[] = ["W", "U", "B", "R", "G"];

const colorLabels: Record<CommanderColor, { label: string; shortLabel: string }> =
  {
    W: { label: "White", shortLabel: "Radiance" },
    U: { label: "Blue", shortLabel: "Tide" },
    B: { label: "Black", shortLabel: "Shadow" },
    R: { label: "Red", shortLabel: "Flame" },
    G: { label: "Green", shortLabel: "Growth" },
  };

export function sumDeckCardQuantities(cards: readonly DeckCard[]): number {
  return cards.reduce((total, card) => total + card.quantity, 0);
}

export function getCardsForBuilderTab(
  deck: Deck,
  tab: BuilderTab,
): DeckCard[] {
  if (tab === "maybeboard") {
    return deck.maybeboard;
  }

  if (tab === "cuts") {
    return deck.cuts;
  }

  return deck.cards;
}

export function getCardsForWorkspaceSection(
  deck: Deck,
  section: BuilderSectionId,
  tab: BuilderTab,
): DeckCard[] {
  return getCardsForBuilderTab(deck, tab).filter(
    (card) => getCardBuilderSection(card) === section,
  );
}

export function getWorkspaceSectionCounts(
  deck: Deck,
  tab: BuilderTab = "main",
): Record<BuilderSectionId, number> {
  return mainBuilderSectionIds.reduce(
    (counts, section) => ({
      ...counts,
      [section]: sumDeckCardQuantities(
        getCardsForWorkspaceSection(deck, section, tab),
      ),
    }),
    {
      commander: sumDeckCardQuantities(
        deck.cards.filter((card) => card.section === "commander"),
      ),
    } as Record<BuilderSectionId, number>,
  );
}

export function getDeckCountSummary(
  deck: Deck,
  hasIllegalWarnings = false,
): DeckCountSummary {
  const count = getMainDeckCount(deck.cards);
  const overLimit = count > 100;
  const complete = count === 100;
  const status = overLimit
    ? "Over Limit"
    : hasIllegalWarnings
      ? "Illegal"
      : complete
        ? "Legal"
        : "Incomplete";
  const tone: DeckCountTone = overLimit
    ? "over"
    : hasIllegalWarnings
      ? "attention"
      : complete
        ? "complete"
        : "progress";

  return {
    count,
    required: 100,
    status,
    tone,
    ariaLabel: `${count} of 100 Commander cards. ${status}. Commander zone and main deck count; maybeboard and cuts excluded.`,
  };
}

export function combineCommanderColorIdentity(
  commanderCards: readonly Pick<DeckCard, "colorIdentity">[],
): CommanderColor[] {
  const selected = new Set(
    commanderCards.flatMap((card) => card.colorIdentity ?? []),
  );
  return colorOrder.filter((color) => selected.has(color));
}

export function getCommanderIdentityOrbStates(
  colorIdentity: readonly CommanderColor[],
): ColorIdentityOrbState[] {
  const activeColors = new Set(colorIdentity);

  return colorOrder.map((color) => {
    const { label, shortLabel } = colorLabels[color];
    const active = activeColors.has(color);

    return {
      color,
      label,
      shortLabel,
      active,
      description: `${label} color identity ${active ? "active" : "inactive"}.`,
    };
  });
}

export function getColorlessIdentityState(
  colorIdentity: readonly CommanderColor[],
  hasCommander: boolean,
): ColorlessIdentityState {
  const active = hasCommander && colorIdentity.length === 0;

  return {
    active,
    description: active
      ? "Colorless commander identity active."
      : "Colorless commander identity inactive.",
  };
}

export function getScrollRangeDescription(
  sectionLabel: string,
  totalCards: number,
  scrollLeft: number,
  clientWidth: number,
  itemWidth: number,
): string {
  if (totalCards <= 0) {
    return `${sectionLabel} has no cards.`;
  }

  const safeItemWidth = Math.max(1, itemWidth);
  const first = Math.min(
    totalCards,
    Math.max(1, Math.floor(scrollLeft / safeItemWidth) + 1),
  );
  const visibleCount = Math.max(1, Math.ceil(clientWidth / safeItemWidth));
  const last = Math.min(totalCards, first + visibleCount - 1);

  return `Showing ${sectionLabel.toLowerCase()} ${first} through ${last} of ${totalCards}.`;
}

export type SectionSortOption =
  | "custom"
  | "manaValue"
  | "name"
  | "color"
  | "cardType"
  | "role"
  | "owned"
  | "legality"
  | "recent"
  | "protected"
  | "missing";

export function sortWorkspaceCards(
  cards: readonly DeckCard[],
  option: SectionSortOption,
): DeckCard[] {
  const sorted = [...cards];

  if (option === "custom") {
    return sorted;
  }

  return sorted.sort((left, right) => {
    if (option === "recent") {
      return right.addedAt.localeCompare(left.addedAt);
    }

    if (option === "missing") {
      return right.missingQuantity - left.missingQuantity;
    }

    if (option === "protected") {
      return Number(right.protected) - Number(left.protected);
    }

    if (option === "owned") {
      return left.missingQuantity - right.missingQuantity;
    }

    if (option === "manaValue") {
      return estimateManaValue(left.manaCost ?? "") - estimateManaValue(right.manaCost ?? "");
    }

    if (option === "role") {
      return (left.roleTags[0] ?? "").localeCompare(right.roleTags[0] ?? "");
    }

    if (option === "cardType") {
      return (left.typeLine ?? "").localeCompare(right.typeLine ?? "");
    }

    if (option === "color") {
      return (left.colorIdentity ?? []).join("").localeCompare(
        (right.colorIdentity ?? []).join(""),
      );
    }

    return left.name.localeCompare(right.name);
  });
}

function estimateManaValue(manaCost: string): number {
  const symbols = manaCost.match(/\{([^}]+)\}/g) ?? [];

  return symbols.reduce((total, symbol) => {
    const value = symbol.replace(/[{}]/g, "");
    const numeric = Number(value);

    if (Number.isFinite(numeric)) {
      return total + numeric;
    }

    if (value.includes("/")) {
      return total + 1;
    }

    return total + (value === "X" ? 0 : 1);
  }, 0);
}

export function filterWorkspaceCards(
  cards: readonly DeckCard[],
  filter: string,
): DeckCard[] {
  if (filter === "missing") {
    return cards.filter((card) => card.missingQuantity > 0);
  }

  if (filter === "protected") {
    return cards.filter((card) => card.protected);
  }

  if (filter === "owned") {
    return cards.filter((card) => card.missingQuantity === 0);
  }

  return [...cards];
}
