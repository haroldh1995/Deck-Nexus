import type { BracketLock, Deck } from "../../types/domain";

export function getDeckCardCount(deck: Deck): number {
  return deck.cards.reduce((total, card) => total + card.quantity, 0);
}

export function formatCommanderNames(deck: Deck): string {
  return deck.commanderNames.length > 0
    ? deck.commanderNames.join(" / ")
    : "Commander unassigned";
}

export function formatBracketLock(bracketLock: BracketLock): string {
  if (!bracketLock.enabled) {
    return "Bracket unlocked";
  }

  return bracketLock.bracket
    .replace("bracket_", "Bracket ")
    .replace("custom", "Custom bracket");
}
