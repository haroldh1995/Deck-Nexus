import type { CommanderColor, DeckCard } from "../../types/domain";
import type { BuilderSectionId, ManualCardInput } from "./builderTypes";

const sectionSeedTypeLines: Record<BuilderSectionId, string> = {
  commander: "Legendary Creature",
  creatures: "Creature",
  instants: "Instant",
  sorceries: "Sorcery",
  artifacts: "Artifact",
  enchantments: "Enchantment",
  otherPermanents: "Planeswalker",
  lands: "Land",
};

const basicLandNames = new Set([
  "plains",
  "island",
  "swamp",
  "mountain",
  "forest",
  "wastes",
]);

export function getSeedTypeLine(sectionId: BuilderSectionId): string {
  return sectionSeedTypeLines[sectionId];
}

export function isBasicLandName(name: string): boolean {
  return basicLandNames.has(name.trim().toLowerCase());
}

export function normalizeTypeLine(typeLine: string): string {
  return typeLine.trim().replace(/\s+/g, " ");
}

export function getCardBadges(typeLine: string): string[] {
  const normalized = normalizeTypeLine(typeLine).toLowerCase();
  const badges: string[] = [];

  if (normalized.includes("artifact") && !normalized.includes("artifact token")) {
    badges.push("Artifact");
  }

  if (normalized.includes("enchantment")) {
    badges.push("Enchantment");
  }

  if (normalized.includes("land")) {
    badges.push("Land");
  }

  return badges;
}

export function classifyCardSection(
  typeLine: string,
  requestedSection?: BuilderSectionId,
): BuilderSectionId {
  const normalized = normalizeTypeLine(typeLine).toLowerCase();

  if (requestedSection === "commander" || normalized.includes("commander")) {
    return "commander";
  }

  if (normalized.includes("land")) {
    return "lands";
  }

  if (normalized.includes("creature")) {
    return "creatures";
  }

  if (normalized.includes("instant")) {
    return "instants";
  }

  if (normalized.includes("sorcery")) {
    return "sorceries";
  }

  if (normalized.includes("artifact")) {
    return "artifacts";
  }

  if (normalized.includes("enchantment")) {
    return "enchantments";
  }

  return "otherPermanents";
}

export function getCardBuilderSection(card: DeckCard): BuilderSectionId {
  if (card.section === "commander") {
    return "commander";
  }

  const categorySection = card.categories.find((category) =>
    [
      "creatures",
      "instants",
      "sorceries",
      "artifacts",
      "enchantments",
      "otherPermanents",
      "lands",
    ].includes(category),
  ) as BuilderSectionId | undefined;

  if (categorySection) {
    return categorySection;
  }

  return classifyCardSection(card.typeLine ?? "");
}

export function getMainDeckCards(deckCards: readonly DeckCard[]): DeckCard[] {
  return deckCards.filter(
    (card) => card.section === "main" || card.section === "commander",
  );
}

export function getMainDeckCount(deckCards: readonly DeckCard[]): number {
  return getMainDeckCards(deckCards).reduce(
    (total, card) => total + card.quantity,
    0,
  );
}

export function parseTagInput(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function parseColorIdentityInput(
  colors: readonly string[],
): CommanderColor[] {
  const colorOrder: CommanderColor[] = ["W", "U", "B", "R", "G"];
  const selected = new Set(colors);
  return colorOrder.filter((color) => selected.has(color));
}

export function cardInputToCategories(input: ManualCardInput): string[] {
  const builderSection = classifyCardSection(
    input.typeLine,
    input.requestedSection,
  );
  const categories: string[] = [builderSection];

  for (const badge of getCardBadges(input.typeLine)) {
    const normalizedBadge = badge.toLowerCase();
    if (!categories.includes(normalizedBadge)) {
      categories.push(normalizedBadge);
    }
  }

  return categories;
}
