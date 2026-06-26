import type { Deck, DeckCard } from "../../types/domain";
import { isWithinCommanderColorIdentity } from "../../utils/colorIdentity";
import {
  classifyCardSection,
  getMainDeckCount,
  isBasicLandName,
} from "./cardClassification";
import type {
  AddCardRuleResult,
  ManualCardInput,
  RuleEnforcementMode,
  RuleWarning,
} from "./builderTypes";

export function evaluateAddCardRules({
  deck,
  input,
  mode,
}: {
  deck: Deck;
  input: ManualCardInput;
  mode: RuleEnforcementMode;
}): AddCardRuleResult {
  const warnings: RuleWarning[] = [];
  const isMainDestination = input.destination === "main";
  const targetSection = classifyCardSection(input.typeLine, input.requestedSection);
  const mainDeckCount = getMainDeckCount(deck.cards);
  const commanderIdentityIsKnown =
    deck.cards.some((card) => card.section === "commander") ||
    deck.colorIdentity.length > 0;

  if (
    isMainDestination &&
    commanderIdentityIsKnown &&
    !isWithinCommanderColorIdentity(deck.colorIdentity, input.colorIdentity)
  ) {
    warnings.push({
      id: "outside-color-identity",
      severity: "illegal",
      message:
        "This card is outside your commander's color identity. Add anyway and mark deck illegal?",
    });
  }

  if (
    isMainDestination &&
    targetSection !== "commander" &&
    !isBasicLandName(input.name)
  ) {
    const existing = deck.cards.some(
      (card) =>
        (card.section === "main" || card.section === "commander") &&
        card.name.trim().toLowerCase() === input.name.trim().toLowerCase(),
    );

    if (existing) {
      warnings.push({
        id: "singleton",
        severity: "illegal",
        message: "Commander singleton rule allows only one copy.",
      });
    }
  }

  if (isMainDestination && mainDeckCount + 1 > 100) {
    warnings.push({
      id: "over-100",
      severity: "warning",
      message: "Adding this card would put the deck over 100 cards.",
    });
  }

  const blocked =
    mode === "strict" &&
    isMainDestination &&
    warnings.some((warning) => warning.severity === "illegal");

  return {
    enforcementMode: mode,
    legal: warnings.every((warning) => warning.severity !== "illegal"),
    blocked,
    warnings,
  };
}

export function evaluateDeckRules(deck: Deck): RuleWarning[] {
  const warnings: RuleWarning[] = [];
  const mainDeckCards = deck.cards.filter(
    (card) => card.section === "main" || card.section === "commander",
  );
  const mainDeckCount = getMainDeckCount(deck.cards);
  const commanderCount = deck.cards.filter(
    (card) => card.section === "commander",
  ).length;

  if (mainDeckCount !== 100) {
    warnings.push({
      id: "deck-count",
      severity: "warning",
      message: `Commander decks are built toward 100 cards. Current main deck count is ${mainDeckCount}.`,
    });
  }

  if (commanderCount === 0) {
    warnings.push({
      id: "commander-missing",
      severity: "warning",
      message: "Commander zone has no confirmed commander card.",
    });
  }

  if (commanderCount > 2) {
    warnings.push({
      id: "commander-count",
      severity: "illegal",
      message: "Commander zone has more than two commander cards.",
    });
  }

  const seen = new Set<string>();
  for (const card of mainDeckCards) {
    const key = card.name.trim().toLowerCase();
    if (!key || isBasicLandName(card.name)) {
      continue;
    }

    if (seen.has(key)) {
      warnings.push({
        id: `duplicate-${key}`,
        severity: "illegal",
        message: `${card.name} appears more than once in the main deck.`,
      });
    }
    seen.add(key);
  }

  for (const card of mainDeckCards) {
    if (
      (deck.cards.some((candidate) => candidate.section === "commander") ||
        deck.colorIdentity.length > 0) &&
      card.colorIdentity &&
      !isWithinCommanderColorIdentity(deck.colorIdentity, card.colorIdentity)
    ) {
      warnings.push({
        id: `outside-color-${card.id}`,
        severity: "illegal",
        message: `${card.name} is outside your commander's color identity.`,
      });
    }
  }

  return warnings;
}

export function getCardLegalityLabel(deck: Deck, card: DeckCard): string {
  const commanderIdentityIsKnown =
    deck.cards.some((candidate) => candidate.section === "commander") ||
    deck.colorIdentity.length > 0;

  if (
    commanderIdentityIsKnown &&
    card.colorIdentity &&
    !isWithinCommanderColorIdentity(deck.colorIdentity, card.colorIdentity)
  ) {
    return "Outside color identity";
  }

  if (
    (card.section === "main" || card.section === "commander") &&
    !isBasicLandName(card.name)
  ) {
    const copies = deck.cards.filter(
      (candidate) =>
        (candidate.section === "main" || candidate.section === "commander") &&
        candidate.name.trim().toLowerCase() === card.name.trim().toLowerCase(),
    );

    if (copies.length > 1) {
      return "Singleton warning";
    }
  }

  if (card.missingQuantity > 0) {
    return "Legal status separate from missing";
  }

  return "No rule warnings";
}

export function getBannedStatusLabel(): string {
  return "Commander legality data unavailable";
}
