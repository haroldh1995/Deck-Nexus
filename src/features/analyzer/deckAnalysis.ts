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

function isVoltronGoal(deck: Deck): boolean {
  return deck.goals.some((goal) => normalize(goal.name).includes("voltron"));
}

function isTopVoltronGoal(deck: Deck): boolean {
  const topGoal = [...deck.goals].sort((left, right) => left.priority - right.priority)[0];
  return Boolean(topGoal && normalize(topGoal.name).includes("voltron"));
}

const voltronPriorityRoles = new Set([
  "equipment",
  "aura",
  "voltron",
  "protection",
  "evasion",
  "power boost",
  "double strike",
  "trample",
  "flying",
  "menace",
  "hexproof",
  "indestructible",
  "ward",
  "haste",
  "attack trigger",
  "combat damage",
  "commander recast",
]);

function roleMatchesGoal(card: CatalogCard, deck: Deck): string[] {
  return deck.goals
    .map((goal) => goal.name)
    .filter((goal) =>
      card.roles.some((role) => normalize(goal).includes(normalize(role))) ||
      (normalize(goal).includes("voltron") &&
        card.roles.some((role) => voltronPriorityRoles.has(normalize(role)))),
    );
}

function tabMatchesRecommendation({
  card,
  deck,
  tab,
  ownedQuantity,
}: {
  card: CatalogCard;
  deck: Deck;
  tab: DeckRecommendation["tab"];
  ownedQuantity: number;
}): boolean {
  const roles = new Set(card.roles.map(normalize));
  const typeLine = normalize(card.typeLine);

  switch (tab) {
    case "owned_first":
      return ownedQuantity > 0;
    case "role_fixes":
      return ["ramp", "draw", "removal", "interaction", "protection"].some((role) =>
        roles.has(role),
      );
    case "goal_support":
      return roleMatchesGoal(card, deck).length > 0 || isVoltronGoal(deck);
    case "goal_specific":
      return isVoltronGoal(deck)
        ? card.roles.some((role) => voltronPriorityRoles.has(normalize(role)))
        : roleMatchesGoal(card, deck).length > 0;
    case "mana_curve":
      return card.manaValue <= 3 || typeLine.includes("land");
    case "staples":
      return roles.has("staple") || roles.has("fixing");
    case "replacements":
      return ["interaction", "removal", "protection", "draw", "ramp"].some((role) =>
        roles.has(role),
      );
    case "wild":
      return true;
    case "best_fits":
      return true;
  }
}

function scoreCatalogCard({
  deck,
  card,
  ownedQuantity,
  tab,
}: {
  deck: Deck;
  card: CatalogCard;
  ownedQuantity: number;
  tab: DeckRecommendation["tab"];
}): number {
  const roles = new Set(card.roles.map(normalize));
  const goalMatches = roleMatchesGoal(card, deck).length;
  let score = 20 + goalMatches * 12 + Math.max(0, 5 - card.manaValue);

  if (ownedQuantity > 0) {
    score += tab === "owned_first" ? 30 : 10;
  }

  if (roles.has("staple")) {
    score += 4;
  }

  if (tab === "mana_curve" && card.manaValue <= 2) {
    score += 8;
  }

  if (isTopVoltronGoal(deck)) {
    for (const role of card.roles) {
      if (voltronPriorityRoles.has(normalize(role))) {
        score += 10;
      }
    }
  }

  if (roles.has("fast mana") && deck.bracketLock.enabled && !deck.bracketLock.allowFastMana) {
    score -= 100;
  }

  score -= card.bracketImpact * 8;
  return score;
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

  if (
    goalNames.some((goal) => goal.includes("voltron")) &&
    card.roles.some((role) => voltronPriorityRoles.has(normalize(role)))
  ) {
    return "Fits the Commander Voltron package by improving protection, evasion, power, or combat pressure.";
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
    .filter((card) => !excluded.has(normalize(card.name)) && !excluded.has(normalize(card.oracleId)))
    .map((card) => ({ card, ownedQuantity: getOwnedQuantity(card.name, ownedCards) }))
    .filter(({ ownedQuantity }) => !ownedOnly || ownedQuantity > 0)
    .filter(({ card, ownedQuantity }) =>
      tabMatchesRecommendation({ card, deck, tab, ownedQuantity }),
    )
    .map(({ card, ownedQuantity }) => ({
      recommendation: {
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
        goalMatches: roleMatchesGoal(card, deck),
        ownedQuantity,
        bracketFit: isInBracket(deck, card)
          ? "In selected bracket constraints"
          : "Review bracket pressure",
        tab,
        createdAt: nowIso(),
      } satisfies DeckRecommendation,
      score: scoreCatalogCard({ deck, card, ownedQuantity, tab }),
    }))
    .sort((left, right) => {
      const scoreDelta = right.score - left.score;
      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      const ownedDelta = right.recommendation.ownedQuantity - left.recommendation.ownedQuantity;
      if (ownedDelta !== 0) {
        return ownedDelta;
      }

      return (
        right.recommendation.roleTags.length - left.recommendation.roleTags.length ||
        left.recommendation.name.localeCompare(right.recommendation.name)
      );
    })
    .map(({ recommendation }) => recommendation);
}

export function createSmartBuildConfig({
  deck,
  mode,
  ownedCards = [],
  outputPreference,
  doNotSuggest = [],
  useCurrentDeckAsCore = true,
  protectedCardIds,
  ownershipPreference,
  manaCurveGoal,
  existingDeckBehavior,
}: {
  deck: Deck;
  mode: SmartBuildMode;
  ownedCards?: readonly OwnedCard[];
  outputPreference?: SmartBuildConfig["outputPreference"];
  doNotSuggest?: readonly string[];
  useCurrentDeckAsCore?: boolean;
  protectedCardIds?: readonly string[];
  ownershipPreference?: SmartBuildConfig["ownershipPreference"];
  manaCurveGoal?: string;
  existingDeckBehavior?: SmartBuildConfig["existingDeckBehavior"];
}): SmartBuildConfig {
  const ownedPreference =
    ownershipPreference ??
    (mode === "owned_only"
      ? "owned_only"
      : mode === "owned_first_missing_upgrades"
        ? "owned_first"
        : deck.ownershipPreference);

  return {
    id: createId("smart-build-config"),
    deckId: deck.id,
    mode,
    commanderIds: deck.commanderIds,
    colorIdentity: deck.colorIdentity,
    goals: deck.goals,
    bracketLock: deck.bracketLock,
    ownershipPreference: ownedPreference,
    doNotSuggest: [...doNotSuggest],
    useCurrentDeckAsCore,
    protectedCardIds:
      protectedCardIds?.length
        ? [...protectedCardIds]
        : deck.cards.filter((card) => card.protected).map((card) => card.id),
    outputPreference:
      outputPreference ??
      (mode === "owned_only" && ownedCards.length === 0
        ? "upgrade_list_only"
        : "apply_after_review"),
    manaCurveGoal,
    existingDeckBehavior:
      existingDeckBehavior ??
      (mode === "rebuild_existing" ? "suggest_only" : "keep_everything_fill"),
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
        ? "best_fits"
        : isVoltronGoal(deck)
          ? "goal_specific"
          : "goal_support";
  const recommendations = getDeckRecommendations({
    deck,
    ownedCards,
    tab: recommendationTab,
    ownedOnly,
    doNotSuggest: config.doNotSuggest,
  });
  const mainDeckCards = getMainDeckCards(deck.cards);
  const coreCards =
    config.existingDeckBehavior === "keep_protected_only"
      ? mainDeckCards.filter((card) => card.protected || card.section === "commander")
      : config.existingDeckBehavior === "keep_commander_goals_only"
        ? mainDeckCards.filter((card) => card.section === "commander")
        : config.useCurrentDeckAsCore
          ? mainDeckCards
          : mainDeckCards.filter((card) => card.section === "commander");
  const openSlots = Math.max(0, 100 - coreCards.reduce((total, card) => total + card.quantity, 0));
  const proposalLimit =
    config.mode === "rebuild_existing" ? 20 : Math.min(20, Math.max(6, openSlots || 10));
  const proposedCards = recommendations.slice(0, proposalLimit).map(recommendationToSmartBuildCard);
  const roleBreakdown = proposedCards.reduce<Record<string, number>>((totals, card) => {
    for (const role of card.roleTags) {
      totals[role] = (totals[role] ?? 0) + card.quantity;
    }
    return totals;
  }, {});
  const proposedManaCurve = proposedCards.reduce<Record<string, number>>((totals, card) => {
    const value = estimateManaValue(card.manaCost);
    const bucket = value >= 7 ? "7+" : String(value);
    totals[bucket] = (totals[bucket] ?? 0) + card.quantity;
    return totals;
  }, {});
  const cutCandidates =
    config.mode === "rebuild_existing"
      ? mainDeckCards
          .filter((card) => !card.protected && card.section !== "commander")
          .filter((card) => card.roleTags.length === 0 || estimateManaValue(card.manaCost) >= 5)
          .slice(0, Math.min(10, proposedCards.length))
          .map<SmartBuildCard>((card) => ({
            id: card.id,
            scryfallId: card.scryfallId,
            oracleId: card.oracleId,
            name: card.name,
            manaCost: card.manaCost,
            typeLine: card.typeLine ?? "",
            quantity: card.quantity,
            reason: "Suggested cut for review only; Smart Build will not remove it automatically.",
            colorIdentity: card.colorIdentity ?? [],
            targetSection: "cuts",
            roleTags: card.roleTags,
            ownedQuantity: card.ownedQuantityAtAdd,
            bracketFit: "Review replacement",
            goalMatches: [],
          }))
      : [];
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
    keptCards: coreCards
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
    cutCards: cutCandidates,
    missingCards: proposedCards.filter((card) => card.ownedQuantity <= 0),
    summary:
      `Smart Build created a review-only ${config.mode.replace(/_/g, " ")} proposal. Nothing is overwritten until applied.`,
    roleBreakdown,
    manaCurve: {
      averageManaValue:
        proposedCards.length > 0
          ? Number(
              (
                proposedCards.reduce(
                  (total, card) => total + estimateManaValue(card.manaCost),
                  0,
                ) / proposedCards.length
              ).toFixed(2),
            )
          : 0,
      buckets: proposedManaCurve,
    },
    legalityStatus:
      proposedCards.every((card) =>
        isWithinCommanderColorIdentity(config.colorIdentity, card.colorIdentity),
      )
        ? "Legal within commander color identity"
        : "Needs color-identity review",
    bracketFit: config.bracketLock.enabled
      ? `Constrained by ${formatBracket(config.bracketLock.bracket)}`
      : "Bracket lock disabled",
    goalAlignment: isVoltronGoal(deck)
      ? "Commander Voltron priorities emphasize equipment, auras, protection, evasion, haste, and combat pressure."
      : "Suggestions are weighted by saved deck goals, role gaps, ownership, and mana curve.",
    applied: false,
    rejectedOutsideColorIdentity: localCardCatalog
      .filter((card) => card.commanderLegal && !card.banned)
      .filter((card) => !isWithinCommanderColorIdentity(deck.colorIdentity, card.colorIdentity))
      .slice(0, 10)
      .map((card) => ({
        id: createId("smart-rejected"),
        scryfallId: card.scryfallId,
        oracleId: card.oracleId,
        name: card.name,
        quantity: 1,
        reason: "Rejected automatically because it is outside commander color identity.",
        colorIdentity: card.colorIdentity,
        targetSection: "maybeboard",
      })),
    createdAt: nowIso(),
  };
}
