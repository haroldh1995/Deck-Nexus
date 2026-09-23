import type { FavoriteItem } from "../../../types/domain";
import type { HomeOrbitItem } from "../../../types/navigation";
import type { HomeHologramCard, HomeSceneDeckState } from "./homeSceneTypes";

const permanentCardCopy: Record<
  string,
  { subtitle: string; actionLabel: string; visualGlyph: string }
> = {
  "create-deck": {
    subtitle: "Summon a Commander shell",
    actionLabel: "Open Create Deck",
    visualGlyph: "CR",
  },
  "deck-library": {
    subtitle: "Browse local decks",
    actionLabel: "Open Deck Library",
    visualGlyph: "LB",
  },
  "card-search": {
    subtitle: "Search card records",
    actionLabel: "Open Card Search",
    visualGlyph: "SE",
  },
  "owned-cards": {
    subtitle: "Review local inventory",
    actionLabel: "Open Owned Cards",
    visualGlyph: "VA",
  },
  "import-center": {
    subtitle: "Bring in your collection",
    actionLabel: "Open Import Center",
    visualGlyph: "IM",
  },
  analyzer: {
    subtitle: "Read deck signals",
    actionLabel: "Open Analyzer",
    visualGlyph: "AN",
  },
  "deck-groups": {
    subtitle: "Organize deck constellations",
    actionLabel: "Open Deck Groups",
    visualGlyph: "GR",
  },
  tags: {
    subtitle: "Shape custom runes",
    actionLabel: "Open Tags",
    visualGlyph: "TG",
  },
  "test-deck": {
    subtitle: "Simulate opening hands",
    actionLabel: "Open Test Deck",
    visualGlyph: "TS",
  },
  export: {
    subtitle: "Project a decklist",
    actionLabel: "Open Export",
    visualGlyph: "EX",
  },
  settings: {
    subtitle: "Tune local command",
    actionLabel: "Open Settings",
    visualGlyph: "ST",
  },
};

const cardBuildCache = new Map<string, HomeHologramCard[]>();

function rememberCardBuild(key: string, cards: HomeHologramCard[]) {
  if (cardBuildCache.size >= 32) {
    const oldestKey = cardBuildCache.keys().next().value;
    if (oldestKey) {
      cardBuildCache.delete(oldestKey);
    }
  }
  cardBuildCache.set(key, cards);
}

function getCardBuildKey(orbitItems: readonly HomeOrbitItem[]) {
  return orbitItems
    .map((item) =>
      [
        item.id,
        item.label,
        item.shortLabel,
        item.route,
        item.icon,
        item.kind,
        item.subtitle ?? "",
      ].join("\u001f"),
    )
    .join("\u001e");
}

export function buildHomeHologramCards(
  orbitItems: readonly HomeOrbitItem[],
): HomeHologramCard[] {
  const cacheKey = getCardBuildKey(orbitItems);
  const cachedCards = cardBuildCache.get(cacheKey);
  if (cachedCards) {
    return cachedCards;
  }

  const nextCards = orbitItems.map((item) => {
    const permanentCopy = permanentCardCopy[item.id];
    const subtitle =
      item.subtitle ??
      permanentCopy?.subtitle ??
      `Open ${item.label} from the local command hub`;

    return {
      ...item,
      subtitle,
      actionLabel: permanentCopy?.actionLabel ?? `Open ${item.label}`,
      visualGlyph: permanentCopy?.visualGlyph ?? "FV",
    };
  });

  rememberCardBuild(cacheKey, nextCards);
  return nextCards;
}

export function getHomeStatusCopy(deckState: HomeSceneDeckState) {
  if (!deckState.hasDecks) {
    return {
      title: "No decks summoned",
      detail: "Create or import your first Commander deck",
      status: "Local chamber standing by",
    };
  }

  return {
    title: "Commander Nexus",
    detail: `${deckState.deckCount} local Commander deck${
      deckState.deckCount === 1 ? "" : "s"
    } anchored`,
    status: deckState.mostRecentDeckName
      ? `Last edited: ${deckState.mostRecentDeckName}`
      : "Local library active",
  };
}

export function favoriteToOrbitPreview(favorite: FavoriteItem) {
  return {
    id: `favorite:${favorite.id}`,
    label: favorite.title,
    route: favorite.route,
  };
}
