import { formatCurrency, selectReferencePrice, summarizeDeckValue } from "../../collector";
import type { Bracket, CollectorCurrency, Deck, DeckCard, OwnedCard } from "../../types/domain";
import { analyzeLiveBracket, formatBracket } from "./bracketAnalysis";
import { getMainDeckCards, getMainDeckCount } from "./cardClassification";

export type DeckChangeKind = "add" | "remove" | "replace" | "move" | "update" | "metadata";

export interface DeckMetricDelta {
  label: string;
  delta: number;
  formatted: string;
}

export interface DeckChangeAnalysis {
  kind: DeckChangeKind;
  addedCards: DeckCard[];
  removedCards: DeckCard[];
  cardCountDelta: number;
  ownedCountDelta: number;
  missingCountDelta: number;
  averageManaValueDelta: number;
  valueDelta: number | null;
  valueCurrency: CollectorCurrency;
  bracketBefore: Bracket;
  bracketAfter: Bracket;
  bracketChanged: boolean;
  roleDeltas: DeckMetricDelta[];
  goalDeltas: string[];
  summary: string[];
  details: string[];
}

function allCards(deck: Deck): DeckCard[] {
  return [...deck.cards, ...deck.maybeboard, ...deck.cuts];
}

function cardKey(card: DeckCard): string {
  return card.id || card.scryfallId || card.oracleId || card.name.trim().toLowerCase();
}

function cardQuantity(cards: readonly DeckCard[]): number {
  return cards.reduce((total, card) => total + card.quantity, 0);
}

function averageManaValue(deck: Deck): number {
  const cards = getMainDeckCards(deck.cards).filter((card) => card.section !== "commander");
  const quantity = cardQuantity(cards);
  if (quantity === 0) return 0;

  const total = cards.reduce((sum, card) => sum + (card.manaValue ?? 0) * card.quantity, 0);
  return total / quantity;
}

function ownedCount(deck: Deck): number {
  return getMainDeckCards(deck.cards).reduce(
    (total, card) => total + Math.max(0, card.quantity - card.missingQuantity),
    0,
  );
}

function missingCount(deck: Deck): number {
  return getMainDeckCards(deck.cards).reduce(
    (total, card) => total + Math.max(0, card.missingQuantity),
    0,
  );
}

function roleCounts(deck: Deck): Map<string, number> {
  const counts = new Map<string, number>();
  for (const card of getMainDeckCards(deck.cards).filter((item) => item.section !== "commander")) {
    for (const role of [...card.roleTags, ...card.customTags]) {
      const key = role.trim().toLowerCase();
      if (key) counts.set(key, (counts.get(key) ?? 0) + card.quantity);
    }
  }
  return counts;
}

function inferKind(addedCards: readonly DeckCard[], removedCards: readonly DeckCard[]): DeckChangeKind {
  if (addedCards.length > 0 && removedCards.length > 0) return "replace";
  if (addedCards.length > 0) return "add";
  if (removedCards.length > 0) return "remove";
  return "update";
}

function signed(value: number, digits = 0): string {
  const rounded = Number(value.toFixed(digits));
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}

function changeCards(before: Deck, after: Deck): { addedCards: DeckCard[]; removedCards: DeckCard[] } {
  const beforeById = new Map(allCards(before).map((card) => [cardKey(card), card]));
  const afterById = new Map(allCards(after).map((card) => [cardKey(card), card]));
  const addedCards: DeckCard[] = [];
  const removedCards: DeckCard[] = [];

  for (const [key, card] of afterById) {
    const previous = beforeById.get(key);
    if (!previous) {
      if (card.section === "main" || card.section === "commander") addedCards.push(card);
      continue;
    }
    if (card.quantity > previous.quantity && (card.section === "main" || card.section === "commander")) {
      addedCards.push({ ...card, quantity: card.quantity - previous.quantity });
    }
  }

  for (const [key, card] of beforeById) {
    const next = afterById.get(key);
    if (!next) {
      if (card.section === "main" || card.section === "commander") removedCards.push(card);
      continue;
    }
    if (card.quantity > next.quantity && (card.section === "main" || card.section === "commander")) {
      removedCards.push({ ...card, quantity: card.quantity - next.quantity });
    }
    if (card.section === "main" && next.section !== "main" && next.section !== "commander") {
      removedCards.push(card);
    }
    if (card.section !== "main" && card.section !== "commander" && (next.section === "main" || next.section === "commander")) {
      addedCards.push(next);
    }
  }

  return { addedCards, removedCards };
}

export function analyzeDeckChange(
  before: Deck,
  after: Deck,
  ownedCards: readonly OwnedCard[] = [],
  kind?: DeckChangeKind,
): DeckChangeAnalysis {
  const { addedCards, removedCards } = changeCards(before, after);
  const beforeRoles = roleCounts(before);
  const afterRoles = roleCounts(after);
  const roleDeltas: DeckMetricDelta[] = [];
  const roles = new Set([...beforeRoles.keys(), ...afterRoles.keys()]);

  for (const role of roles) {
    const delta = (afterRoles.get(role) ?? 0) - (beforeRoles.get(role) ?? 0);
    if (delta !== 0) {
      roleDeltas.push({ label: role, delta, formatted: signed(delta) });
    }
  }
  roleDeltas.sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta));

  const beforeValue = summarizeDeckValue(before, ownedCards);
  const afterValue = summarizeDeckValue(after, ownedCards);
  const rawValueDelta = afterValue.totalEstimatedValue - beforeValue.totalEstimatedValue;
  const changedCards = [...addedCards, ...removedCards];
  const hasChangedCardPrice = changedCards.some(
    (card) => selectReferencePrice(card.prices, card.finish).value !== null,
  );
  const valueDelta = hasChangedCardPrice ? Number(rawValueDelta.toFixed(2)) : null;
  const bracketBefore = analyzeLiveBracket(before);
  const bracketAfter = analyzeLiveBracket(after);
  const cardCountDelta = getMainDeckCount(after.cards) - getMainDeckCount(before.cards);
  const ownedCountDelta = ownedCount(after) - ownedCount(before);
  const missingCountDelta = missingCount(after) - missingCount(before);
  const averageManaValueDelta = Number((averageManaValue(after) - averageManaValue(before)).toFixed(2));
  const goalDeltas = [
    ...after.goals.filter((goal) => !before.goals.some((previous) => previous.name === goal.name)).map((goal) => `Goal added: ${goal.name}`),
    ...before.goals.filter((goal) => !after.goals.some((next) => next.name === goal.name)).map((goal) => `Goal removed: ${goal.name}`),
  ];
  const resolvedKind = kind ?? inferKind(addedCards, removedCards);
  const primaryAdded = addedCards[0];
  const primaryRemoved = removedCards[0];
  const summary: string[] = [];
  const details: string[] = [];

  if (primaryAdded) summary.push(`+ ${primaryAdded.name}`);
  if (primaryRemoved) summary.push(`- ${primaryRemoved.name}`);
  if (cardCountDelta !== 0) details.push(`Main deck count ${signed(cardCountDelta)}.`);
  for (const role of roleDeltas.slice(0, 3)) details.push(`${role.label} ${role.formatted}.`);
  if (averageManaValueDelta !== 0) details.push(`Average mana value ${signed(averageManaValueDelta, 2)}.`);
  if (ownedCountDelta !== 0) details.push(`Owned copies ${signed(ownedCountDelta)}.`);
  if (missingCountDelta !== 0) details.push(`Missing copies ${signed(missingCountDelta)}.`);
  if (valueDelta !== null && valueDelta !== 0) {
    summary.push(`Deck value ${valueDelta > 0 ? "+" : ""}${formatCurrency(valueDelta, afterValue.currency)}`);
  } else if (valueDelta === null && changedCards.length > 0) {
    details.push("Price unavailable for one or more changed cards.");
  }
  if (bracketBefore.estimatedBracket !== bracketAfter.estimatedBracket) {
    summary.push(`Estimated bracket: ${formatBracket(bracketBefore.estimatedBracket)} -> ${formatBracket(bracketAfter.estimatedBracket)}`);
  } else if (addedCards.length > 0 || removedCards.length > 0) {
    summary.push("Estimated bracket unchanged");
  }
  if (after.bracketLock.enabled && bracketAfter.drift > 0) {
    summary.push(`Bracket Lock ${formatBracket(after.bracketLock.bracket)}: potential conflict`);
  }
  details.push(...goalDeltas);

  return {
    kind: resolvedKind,
    addedCards,
    removedCards,
    cardCountDelta,
    ownedCountDelta,
    missingCountDelta,
    averageManaValueDelta,
    valueDelta,
    valueCurrency: afterValue.currency,
    bracketBefore: bracketBefore.estimatedBracket,
    bracketAfter: bracketAfter.estimatedBracket,
    bracketChanged: bracketBefore.estimatedBracket !== bracketAfter.estimatedBracket,
    roleDeltas,
    goalDeltas,
    summary: summary.length > 0 ? summary : ["Deck metadata updated"],
    details,
  };
}
