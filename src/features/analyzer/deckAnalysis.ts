import { localCardCatalog, type CatalogCard } from "../../data/cardCatalog";
import type {
  Deck,
  DeckAnalysis,
  DeckCard,
  DeckRecommendation,
  OwnedCard,
  SmartBuildCard,
  SmartBuildConfig,
  SmartBuildMode,
  SmartBuildResult,
} from "../../types/domain";
import { createId, nowIso } from "../../utils/ids";
import { isWithinCommanderColorIdentity } from "../../utils/colorIdentity";
import { analyzeLiveBracket, formatBracket } from "../decks/bracketAnalysis";
import {
  getCardBuilderSection,
  getMainDeckCount,
  getMainDeckCards,
} from "../decks/cardClassification";
import { evaluateDeckRules } from "../decks/commanderRules";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function estimateManaValue(manaCost?: string): number {
  if (!manaCost) {
    return 0;
  }

  return (manaCost.match(/\{([^}]+)\}/g) ?? []).reduce((total, symbol) => {
    const value = symbol.replace(/[{}]/g, "");
    const numeric = Number(value);

    if (Number.isFinite(numeric)) {
      return total + numeric;
    }

    return total + (value === "X" ? 0 : 1);
  }, 0);
}

export function getOwnedQuantity(name: string, ownedCards: readonly OwnedCard[]): number {
  const normalizedName = normalize(name);

  return ownedCards
    .filter((ownedCard) => normalize(ownedCard.name) === normalizedName)
    .reduce((total, ownedCard) => total + ownedCard.quantityOwned, 0);
}

function roleCount(cards: readonly DeckCard[], role: string): number {
  const normalizedRole = normalize(role);
  return cards.filter((card) =>
    [...card.roleTags, ...card.customTags].some((tag) =>
      normalize(tag).includes(normalizedRole),
    ),
  ).length;
}

function catalogAllowedForDeck(deck: Deck, card: CatalogCard): boolean {
  return (
    card.commanderLegal &&
    !card.banned &&
    isWithinCommanderColorIdentity(deck.colorIdentity, card.colorIdentity)
  );
}

function alreadyKnown(deck: Deck, card: CatalogCard): boolean {
  const names = new Set(
    [...deck.cards, ...deck.maybeboard, ...deck.cuts].map((deckCard) =>
      normalize(deckCard.name),
    ),
  );
  return names.has(normalize(card.name));
}

function isInBracket(deck: Deck, card: CatalogCard): boolean {
  if (!deck.bracketLock.enabled) {
    return true;
  }

  if (!deck.bracketLock.allowFastMana && card.roles.includes("fast mana")) {
    return false;
  }

  if (!deck.bracketLock.allowTutors && card.roles.includes("tutor")) {
    return false;
  }

  if (!deck.bracketLock.allowCombos && card.roles.includes("combo")) {
    return false;
  }

  if (!deck.bracketLock.allowStax && card.roles.includes("stax")) {
    return false;
  }

  return deck.bracketLock.bracket === "bracket_5" || card.bracketImpact < 0.5;
}

export function analyzeDeck(deck: Deck, ownedCards: readonly OwnedCard[] = []): DeckAnalysis {
  const now = nowIso();
  const mainCards = getMainDeckCards(deck.cards);
  const categoryCounts = mainCards.reduce<Record<string, number>>((counts, card) => {
    const section = getCardBuilderSection(card);
    counts[section] = (counts[section] ?? 0) + card.quantity;
    return counts;
  }, {});
  const roleCounts = mainCards.reduce<Record<string, number>>((counts, card) => {
    for (const role of card.roleTags) {
      counts[role] = (counts[role] ?? 0) + card.quantity;
    }
    return counts;
  }, {});
  const deckRules = evaluateDeckRules(deck);
  const bracket = analyzeLiveBracket(deck);
  const cardCount = getMainDeckCount(deck.cards);
  const missingCount = mainCards.reduce(
    (total, card) => total + Math.max(0, card.quantity - getOwnedQuantity(card.name, ownedCards)),
    0,
  );
  const duplicateWarnings = ownedCards.filter(
    (card) => card.duplicateFlag && card.duplicateFlag !== "none",
  ).length;
  const manaSamples = mainCards.filter((card) => card.section !== "commander");
  const averageManaValue =
    manaSamples.length > 0
      ? manaSamples.reduce((total, card) => total + estimateManaValue(card.manaCost), 0) /
        manaSamples.length
      : 0;
  const buckets = manaSamples.reduce<Record<string, number>>((totals, card) => {
    const value = estimateManaValue(card.manaCost);
    const bucket = value >= 7 ? "7+" : String(value);
    totals[bucket] = (totals[bucket] ?? 0) + card.quantity;
    return totals;
  }, {});
  const ramp = roleCount(mainCards, "ramp");
  const draw = roleCount(mainCards, "draw");
  const removal = roleCount(mainCards, "removal") + roleCount(mainCards, "interaction");
  const notes = [
    `${cardCount} Commander-counted cards. Maybeboard and cuts are excluded.`,
    `${formatBracket(bracket.estimatedBracket)} estimated with ${bracket.confidence.toLowerCase()} confidence.`,
    `${missingCount} card${missingCount === 1 ? "" : "s"} missing or not confirmed owned.`,
  ];
  const legalityIssues: NonNullable<DeckAnalysis["legalityIssues"]> = deckRules.map((warning) => ({
    id: warning.id,
    severity: warning.severity === "illegal" ? ("illegal" as const) : ("needs_review" as const),
    title: warning.id,
    detail: warning.message,
    action: "Review deck rules",
  }));

  if (ramp < 8) {
    legalityIssues.push({
      id: "ramp-density",
      severity: "needs_work",
      title: "Ramp below target",
      detail: "Commander decks usually want a stable ramp package. Additions should stay in color identity.",
      action: "Open Role Fixes recommendations",
    });
  }

  if (draw < 8) {
    legalityIssues.push({
      id: "draw-density",
      severity: "needs_work",
      title: "Draw below target",
      detail: "The deck may run low on card flow. Additions should stay in color identity.",
      action: "Open Draw recommendations",
    });
  }

  if (removal < 6) {
    legalityIssues.push({
      id: "interaction-density",
      severity: "needs_work",
      title: "Interaction below target",
      detail: "A few more removal or protection tools may make the deck more functional.",
      action: "Open Interaction recommendations",
    });
  }

  const health =
    deckRules.some((warning) => warning.severity === "illegal")
      ? "Illegal"
      : cardCount === 100 && legalityIssues.length === 0
        ? "Excellent"
        : cardCount === 100
          ? "Needs Review"
          : "Incomplete";

  return {
    id: createId("analysis"),
    deckId: deck.id,
    cardCount,
    colorIdentity: deck.colorIdentity,
    categoryCounts,
    roleCounts,
    health,
    legalityIssues,
    suggestions: legalityIssues.map((issue) => ({
      id: createId("suggestion"),
      title: issue.title,
      detail: issue.detail,
      source: "analyzer",
      targetSection: "main",
    })),
    manaCurve: {
      averageManaValue: Number(averageManaValue.toFixed(2)),
      buckets,
    },
    ownership: {
      ownedCount: Math.max(0, cardCount - missingCount),
      missingCount,
      duplicateWarnings,
    },
    notes,
    createdAt: now,
  };
}

function recommendationReason(deck: Deck, card: CatalogCard): string {
  const goalNames = deck.goals.map((goal) => normalize(goal.name));

  if (goalNames.some((goal) => goal.includes("voltron")) && card.roles.includes("voltron")) {
    return "Supports the Commander Voltron goal with protection, evasion, or power pressure.";
  }

  if (card.roles.includes("ramp")) {
    return "Improves mana development while staying inside commander color identity.";
  }

  if (card.roles.includes("draw")) {
    return "Adds card flow for longer Commander games.";
  }

  if (card.roles.includes("interaction") || card.roles.includes("removal")) {
    return "Adds interaction without changing the deck's color identity.";
  }

  return "Fits the deck's commander color identity and fills a useful Commander role.";
}

export function getDeckRecommendations({
  deck,
  ownedCards = [],
  tab = "best_fits",
  ownedOnly = false,
  doNotSuggest = [],
}: {
  deck: Deck;
  ownedCards?: readonly OwnedCard[];
  tab?: DeckRecommendation["tab"];
  ownedOnly?: boolean;
  doNotSuggest?: readonly string[];
}): DeckRecommendation[] {
  const excluded = new Set(doNotSuggest.map(normalize));

  return localCardCatalog
    .filter((card) => catalogAllowedForDeck(deck, card))
    .filter((card) => !alreadyKnown(deck, card))
    .filter((card) => isInBracket(deck, card))
    .filter((card) => !excluded.has(normalize(card.name)))
    .filter((card) => !ownedOnly || getOwnedQuantity(card.name, ownedCards) > 0)
    .map<DeckRecommendation>((card) => ({
      id: createId("recommendation"),
      deckId: deck.id,
      scryfallId: card.scryfallId,
      oracleId: card.oracleId,
      name: card.name,
      manaCost: card.manaCost,
      typeLine: card.typeLine,
      colorIdentity: card.colorIdentity,
      roleTags: card.roles,
      reason: recommendationReason(deck, card),
      synergyReason: recommendationReason(deck, card),
      goalMatches: deck.goals
        .map((goal) => goal.name)
        .filter((goal) => card.roles.some((role) => normalize(goal).includes(normalize(role)))),
      ownedQuantity: getOwnedQuantity(card.name, ownedCards),
      bracketFit: isInBracket(deck, card) ? "In selected bracket constraints" : "Review bracket pressure",
      tab,
      createdAt: nowIso(),
    }))
    .sort((left, right) => {
      const ownedDelta = right.ownedQuantity - left.ownedQuantity;
      if (ownedDelta !== 0) {
        return ownedDelta;
      }

      return right.roleTags.length - left.roleTags.length || left.name.localeCompare(right.name);
    });
}

export function createSmartBuildConfig({
  deck,
  mode,
  ownedCards = [],
}: {
  deck: Deck;
  mode: SmartBuildMode;
  ownedCards?: readonly OwnedCard[];
}): SmartBuildConfig {
  const ownedPreference =
    mode === "owned_only"
      ? "owned_only"
      : mode === "owned_first_missing_upgrades"
        ? "owned_first"
        : deck.ownershipPreference;

  return {
    id: createId("smart-build-config"),
    deckId: deck.id,
    mode,
    commanderIds: deck.commanderIds,
    colorIdentity: deck.colorIdentity,
    goals: deck.goals,
    bracketLock: deck.bracketLock,
    ownershipPreference: ownedPreference,
    doNotSuggest: [],
    useCurrentDeckAsCore: true,
    protectedCardIds: deck.cards.filter((card) => card.protected).map((card) => card.id),
    outputPreference: mode === "owned_only" && ownedCards.length === 0 ? "upgrade_list_only" : "apply_after_review",
    createdAt: nowIso(),
  };
}

function recommendationToSmartBuildCard(
  recommendation: DeckRecommendation,
): SmartBuildCard {
  return {
    id: createId("smart-build-card"),
    scryfallId: recommendation.scryfallId,
    oracleId: recommendation.oracleId,
    name: recommendation.name,
    manaCost: recommendation.manaCost,
    typeLine: recommendation.typeLine,
    quantity: 1,
    reason: recommendation.reason,
    colorIdentity: recommendation.colorIdentity,
    targetSection: "main",
    roleTags: recommendation.roleTags,
    ownedQuantity: recommendation.ownedQuantity,
    bracketFit: recommendation.bracketFit,
    goalMatches: recommendation.goalMatches,
  };
}

export function runSmartBuild({
  deck,
  config,
  ownedCards = [],
}: {
  deck: Deck;
  config: SmartBuildConfig;
  ownedCards?: readonly OwnedCard[];
}): SmartBuildResult {
  const ownedOnly = config.mode === "owned_only";
  const recommendationTab =
    config.mode === "bracket_locked"
      ? "best_fits"
      : config.mode === "owned_first_missing_upgrades"
        ? "owned_first"
        : "goal_support";
  const recommendations = getDeckRecommendations({
    deck,
    ownedCards,
    tab: recommendationTab,
    ownedOnly,
    doNotSuggest: config.doNotSuggest,
  });
  const openSlots = Math.max(0, 100 - getMainDeckCount(deck.cards));
  const proposalLimit = config.mode === "rebuild_existing" ? 20 : Math.min(20, Math.max(6, openSlots || 10));
  const proposedCards = recommendations.slice(0, proposalLimit).map(recommendationToSmartBuildCard);
  const suggestions = proposedCards.map((card) => ({
    id: createId("smart-suggestion"),
    scryfallId: card.scryfallId,
    oracleId: card.oracleId,
    name: card.name,
    quantity: card.quantity,
    reason: card.reason,
    colorIdentity: card.colorIdentity,
    targetSection: card.targetSection,
  }));

  return {
    id: createId("smart-build"),
    deckId: deck.id,
    config,
    mode: config.mode,
    commanderIds: deck.commanderIds,
    colorIdentity: deck.colorIdentity,
    goals: deck.goals,
    suggestions,
    proposedCards,
    keptCards: deck.cards
      .filter((card) => card.protected || card.section === "commander")
      .map((card) => ({
        id: card.id,
        scryfallId: card.scryfallId,
        oracleId: card.oracleId,
        name: card.name,
        manaCost: card.manaCost,
        typeLine: card.typeLine ?? "",
        quantity: card.quantity,
        reason: card.protected ? "Protected card retained." : "Commander-zone card retained.",
        colorIdentity: card.colorIdentity ?? [],
        targetSection: card.section,
        roleTags: card.roleTags,
        ownedQuantity: card.ownedQuantityAtAdd,
        bracketFit: "Existing card",
        goalMatches: [],
      })),
    cutCards: [],
    missingCards: proposedCards.filter((card) => card.ownedQuantity <= 0),
    summary:
      "Smart Build created a review-only Commander proposal. Nothing is overwritten until applied.",
    applied: false,
    rejectedOutsideColorIdentity: [],
    createdAt: nowIso(),
  };
}
