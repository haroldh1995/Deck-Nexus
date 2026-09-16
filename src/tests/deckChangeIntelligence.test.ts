import { describe, expect, it } from "vitest";
import { createScryfallPriceReference } from "../collector";
import { analyzeDeckChange } from "../features/decks/deckChangeIntelligence";
import { defaultBracketLock } from "../data/defaults";
import type { CommanderColor, Deck, DeckCard } from "../types/domain";

function card(
  id: string,
  name: string,
  section: DeckCard["section"],
  roleTags: string[] = [],
  options: Partial<DeckCard> = {},
): DeckCard {
  return {
    id,
    deckId: "change-deck",
    scryfallId: `scry-${id}`,
    oracleId: `oracle-${id}`,
    name,
    manaCost: "{2}",
    manaValue: 2,
    typeLine: section === "commander" ? "Legendary Creature" : "Creature",
    oracleText: "",
    colorIdentity: [] as CommanderColor[],
    quantity: 1,
    section,
    categories: ["creatures"],
    roleTags,
    customTags: [],
    notes: "",
    protected: false,
    ownedQuantityAtAdd: options.missingQuantity ? 0 : 1,
    missingQuantity: 0,
    addedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...options,
  };
}

function deck(cards: DeckCard[]): Deck {
  return {
    id: "change-deck",
    name: "Change Test",
    format: "commander",
    commanderIds: [],
    commanderNames: ["Test Commander"],
    colorIdentity: [],
    cards,
    maybeboard: [],
    cuts: [],
    goals: [],
    tags: [],
    style: "unspecified",
    powerTarget: 5,
    bracketLock: defaultBracketLock,
    ownershipPreference: "allow_missing",
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

describe("Deck Change Intelligence", () => {
  it("reports card, role, ownership, price, and bracket deltas", () => {
    const commander = card("commander", "Test Commander", "commander");
    const before = deck([commander]);
    const after = deck([
      commander,
      ...Array.from({ length: 4 }, (_, index) =>
        card(`combo-${index}`, `Combo ${index}`, "main", ["combo", "draw"], {
          manaValue: 1,
          manaCost: "{1}",
          missingQuantity: index === 3 ? 1 : 0,
          prices: createScryfallPriceReference({ usd: "2.50" }),
        }),
      ),
    ]);

    const analysis = analyzeDeckChange(before, after);

    expect(analysis.kind).toBe("add");
    expect(analysis.cardCountDelta).toBe(4);
    expect(analysis.missingCountDelta).toBe(1);
    expect(analysis.roleDeltas.find((item) => item.label === "combo")?.delta).toBe(4);
    expect(analysis.valueDelta).toBe(10);
    expect(analysis.bracketChanged).toBe(true);
    expect(analysis.summary.join(" ")).toContain("Estimated bracket");
  });

  it("recognizes replacements and preserves unavailable pricing as unknown", () => {
    const commander = card("commander", "Test Commander", "commander");
    const oldCard = card("old", "Old Ramp", "main", ["ramp"]);
    const newCard = card("new", "New Draw", "main", ["draw"]);
    const analysis = analyzeDeckChange(
      deck([commander, oldCard]),
      deck([commander, newCard]),
    );

    expect(analysis.kind).toBe("replace");
    expect(analysis.addedCards.map((item) => item.name)).toEqual(["New Draw"]);
    expect(analysis.removedCards.map((item) => item.name)).toEqual(["Old Ramp"]);
    expect(analysis.valueDelta).toBeNull();
    expect(analysis.details).toContain("Price unavailable for one or more changed cards.");
  });
});
