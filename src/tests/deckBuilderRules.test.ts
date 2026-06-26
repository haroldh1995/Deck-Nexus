import { describe, expect, it } from "vitest";
import { defaultBracketLock } from "../data/defaults";
import { analyzeLiveBracket } from "../features/decks/bracketAnalysis";
import {
  classifyCardSection,
  getMainDeckCount,
} from "../features/decks/cardClassification";
import {
  evaluateAddCardRules,
  getCardLegalityLabel,
} from "../features/decks/commanderRules";
import type { ManualCardInput } from "../features/decks/builderTypes";
import type { CommanderColor, Deck, DeckCard } from "../types/domain";

function makeCard(
  id: string,
  name: string,
  typeLine: string,
  colorIdentity: CommanderColor[] = [],
  section: DeckCard["section"] = "main",
  roleTags: string[] = [],
): DeckCard {
  return {
    id,
    deckId: "deck-test",
    scryfallId: `scryfall-${id}`,
    oracleId: `oracle-${id}`,
    name,
    manaCost: "{2}",
    typeLine,
    oracleText: "",
    colorIdentity,
    quantity: 1,
    section,
    categories: [classifyCardSection(typeLine)],
    roleTags,
    customTags: [],
    notes: "",
    protected: false,
    ownedQuantityAtAdd: 1,
    missingQuantity: 0,
    addedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function makeDeck(cards: DeckCard[] = []): Deck {
  const commanders = cards.filter((card) => card.section === "commander");

  return {
    id: "deck-test",
    name: "Rules Test",
    format: "commander",
    commanderIds: [],
    commanderNames: commanders.map((card) => card.name),
    colorIdentity: commanders.flatMap((card) => card.colorIdentity ?? []),
    cards,
    maybeboard: [],
    cuts: [],
    goals: [],
    tags: [],
    style: "unspecified",
    powerTarget: 5,
    bracketLock: { ...defaultBracketLock, enabled: true, bracket: "bracket_2" },
    ownershipPreference: "owned_first",
    categoryStyle: "commander_roles",
    notes: "",
    status: "draft",
    originalImportText: "",
    unresolvedImports: [],
    createdFrom: "blank",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function input(name: string, typeLine: string, colorIdentity: CommanderColor[] = []): ManualCardInput {
  return {
    name,
    typeLine,
    colorIdentity,
    roleTags: [],
    customTags: [],
    owned: true,
    destination: "main",
  };
}

describe("Deck Builder rules foundation", () => {
  it("auto-sections card types using Commander deck zones", () => {
    expect(classifyCardSection("Legendary Creature", "commander")).toBe(
      "commander",
    );
    expect(classifyCardSection("Artifact Creature")).toBe("creatures");
    expect(classifyCardSection("Enchantment Creature")).toBe("creatures");
    expect(classifyCardSection("Instant")).toBe("instants");
    expect(classifyCardSection("Sorcery")).toBe("sorceries");
    expect(classifyCardSection("Artifact")).toBe("artifacts");
    expect(classifyCardSection("Enchantment")).toBe("enchantments");
    expect(classifyCardSection("Planeswalker")).toBe("otherPermanents");
    expect(classifyCardSection("Artifact Land")).toBe("lands");
  });

  it("warns before adding cards outside commander color identity", () => {
    const deck = makeDeck([
      makeCard("commander", "Tatyova", "Legendary Creature", ["G", "U"], "commander"),
    ]);

    const result = evaluateAddCardRules({
      deck,
      input: input("Lightning Bolt", "Instant", ["R"]),
      mode: "guided",
    });

    expect(result.blocked).toBe(false);
    expect(result.warnings.map((warning) => warning.id)).toContain(
      "outside-color-identity",
    );
  });

  it("blocks illegal main additions in Strict Mode", () => {
    const deck = makeDeck([
      makeCard("commander", "Tatyova", "Legendary Creature", ["G", "U"], "commander"),
    ]);

    const result = evaluateAddCardRules({
      deck,
      input: input("Red Elemental Burst", "Instant", ["R"]),
      mode: "strict",
    });

    expect(result.blocked).toBe(true);
  });

  it("warns on duplicate nonbasic singleton additions", () => {
    const deck = makeDeck([
      makeCard("commander", "Tatyova", "Legendary Creature", ["G", "U"], "commander"),
      makeCard("oracle", "Coiling Oracle", "Creature", ["G", "U"]),
    ]);

    const result = evaluateAddCardRules({
      deck,
      input: input("Coiling Oracle", "Creature", ["G", "U"]),
      mode: "guided",
    });

    expect(result.warnings.map((warning) => warning.id)).toContain("singleton");
  });

  it("warns when adding over 100 main deck cards", () => {
    const cards = [
      makeCard("commander", "Tatyova", "Legendary Creature", ["G", "U"], "commander"),
      ...Array.from({ length: 99 }, (_, index) =>
        makeCard(`card-${index}`, `Deck Card ${index}`, "Creature", []),
      ),
    ];
    const deck = makeDeck(cards);

    const result = evaluateAddCardRules({
      deck,
      input: input("Card 101", "Creature", []),
      mode: "guided",
    });

    expect(getMainDeckCount(deck.cards)).toBe(100);
    expect(result.warnings.map((warning) => warning.id)).toContain("over-100");
  });

  it("does not count maybeboard or cuts toward the 100-card main deck", () => {
    const deck = makeDeck([
      makeCard("commander", "Tatyova", "Legendary Creature", ["G", "U"], "commander"),
      makeCard("main", "Main Card", "Creature", []),
      makeCard("maybe", "Maybe Card", "Creature", [], "maybeboard"),
      makeCard("cut", "Cut Card", "Creature", [], "cuts"),
    ]);

    expect(getMainDeckCount(deck.cards)).toBe(2);
  });

  it("keeps missing ownership separate from legality", () => {
    const deck = makeDeck([
      makeCard("commander", "Tatyova", "Legendary Creature", ["G", "U"], "commander"),
    ]);
    const missingCard = {
      ...makeCard("missing", "Missing Ramp", "Artifact", []),
      ownedQuantityAtAdd: 0,
      missingQuantity: 1,
    };

    expect(getCardLegalityLabel(deck, missingCard)).toBe(
      "Legal status separate from missing",
    );
  });

  it("updates bracket estimates from card tags", () => {
    const lowDeck = makeDeck([
      makeCard("commander", "Tatyova", "Legendary Creature", ["G", "U"], "commander"),
      makeCard("ramp", "Cultivate", "Sorcery", ["G"], "main", ["ramp"]),
    ]);
    const higherDeck = makeDeck([
      ...lowDeck.cards,
      makeCard("fast", "Local Fast Mana", "Artifact", [], "main", [
        "fast mana",
      ]),
      makeCard("tutor", "Local Tutor", "Instant", ["U"], "main", ["tutor"]),
      makeCard("combo", "Local Combo Piece", "Artifact", [], "main", [
        "combo",
      ]),
    ]);

    expect(
      Number(analyzeLiveBracket(higherDeck).estimatedBracket.replace("bracket_", "")),
    ).toBeGreaterThanOrEqual(
      Number(analyzeLiveBracket(lowDeck).estimatedBracket.replace("bracket_", "")),
    );
  });
});
