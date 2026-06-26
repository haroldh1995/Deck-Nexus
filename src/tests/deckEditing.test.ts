import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabaseForTests } from "../db/database";
import {
  addDeckCard,
  createBlankCommanderDeck,
  duplicateDeck,
  getDeck,
  moveDeckCard,
  removeDeckCard,
  replaceDeckCard,
  updateDeckCard,
  updateDeckMetadata,
} from "../db/repositories";
import { getMainDeckCount } from "../features/decks/cardClassification";
import type { ManualCardInput } from "../features/decks/builderTypes";
import type { CommanderColor, Deck } from "../types/domain";

function manualCard(
  name: string,
  typeLine: string,
  colorIdentity: CommanderColor[] = [],
  destination: ManualCardInput["destination"] = "main",
  roleTags: string[] = [],
): ManualCardInput {
  return {
    name,
    typeLine,
    colorIdentity,
    roleTags,
    customTags: [],
    owned: true,
    destination,
  };
}

async function createDeckWithCommander(): Promise<Deck> {
  const deck = await createBlankCommanderDeck({ name: "Local Builder Test" });
  return addDeckCard(deck.id, {
    ...manualCard("Tatyova, Benthic Druid", "Legendary Creature", ["G", "U"]),
    requestedSection: "commander",
  });
}

describe("Deck Builder local edit repositories", () => {
  beforeEach(async () => {
    await resetDatabaseForTests();
  });

  it("adds cards to every deck builder section and persists commander identity", async () => {
    let deck = await createDeckWithCommander();

    const additions = [
      manualCard("Coiling Oracle", "Artifact Creature", ["G", "U"]),
      manualCard("Counterspell", "Instant", ["U"]),
      manualCard("Cultivate", "Sorcery", ["G"], "main", ["ramp"]),
      manualCard("Sol Ring Proxy", "Artifact", []),
      manualCard("Rancor", "Enchantment", ["G"]),
      manualCard("Jace, Local Adept", "Planeswalker", ["U"]),
      manualCard("Command Tower", "Artifact Land", []),
    ];

    for (const card of additions) {
      deck = await addDeckCard(deck.id, card);
    }

    const persisted = await getDeck(deck.id);

    expect(persisted?.commanderNames).toEqual(["Tatyova, Benthic Druid"]);
    expect(persisted?.colorIdentity).toEqual(["U", "G"]);
    expect(persisted?.cards.map((card) => card.name)).toEqual(
      expect.arrayContaining(additions.map((card) => card.name)),
    );
    expect(getMainDeckCount(persisted?.cards ?? [])).toBe(8);
  });

  it("saves protect, tag, note, bracket, move, cut, restore, and remove edits", async () => {
    let deck = await createDeckWithCommander();
    deck = await addDeckCard(deck.id, manualCard("Coiling Oracle", "Creature", ["G", "U"]));
    const oracle = deck.cards.find((card) => card.name === "Coiling Oracle");
    expect(oracle).toBeDefined();

    deck = await updateDeckCard(deck.id, oracle!.id, {
      protected: true,
      roleTags: ["synergy"],
      customTags: ["favorite"],
      notes: "Blink target",
    });
    const updated = deck.cards.find((card) => card.id === oracle!.id);
    expect(updated?.protected).toBe(true);
    expect(updated?.notes).toBe("Blink target");

    deck = await updateDeckMetadata(deck.id, {
      bracketLock: { ...deck.bracketLock, enabled: true, bracket: "bracket_3" },
    });
    expect(deck.bracketLock.enabled).toBe(true);

    deck = await moveDeckCard(deck.id, oracle!.id, "maybeboard");
    expect(deck.cards.some((card) => card.id === oracle!.id)).toBe(false);
    expect(deck.maybeboard.some((card) => card.id === oracle!.id)).toBe(true);
    expect(getMainDeckCount(deck.cards)).toBe(1);

    deck = await moveDeckCard(deck.id, oracle!.id, "main");
    expect(deck.cards.some((card) => card.id === oracle!.id)).toBe(true);

    deck = await moveDeckCard(deck.id, oracle!.id, "cuts", "Testing cut reason");
    expect(deck.cuts.find((card) => card.id === oracle!.id)?.cutReason).toBe(
      "Testing cut reason",
    );
    expect(getMainDeckCount(deck.cards)).toBe(1);

    deck = await moveDeckCard(deck.id, oracle!.id, "main");
    expect(deck.cards.some((card) => card.id === oracle!.id)).toBe(true);

    deck = await removeDeckCard(deck.id, oracle!.id);
    await expect(getDeck(deck.id)).resolves.toMatchObject({
      cards: expect.not.arrayContaining([expect.objectContaining({ id: oracle!.id })]),
    });
  });

  it("replaces a main deck card into cuts and duplicates the deck locally", async () => {
    let deck = await createDeckWithCommander();
    deck = await addDeckCard(deck.id, manualCard("Coiling Oracle", "Creature", ["G", "U"]));
    const oracle = deck.cards.find((card) => card.name === "Coiling Oracle");

    deck = await replaceDeckCard(
      deck.id,
      oracle!.id,
      manualCard("Llanowar Visionary", "Creature", ["G"]),
    );

    expect(deck.cards.some((card) => card.name === "Llanowar Visionary")).toBe(
      true,
    );
    expect(deck.cuts.find((card) => card.name === "Coiling Oracle")?.cutReason).toContain(
      "Replaced by Llanowar Visionary",
    );

    const duplicate = await duplicateDeck(deck.id);
    expect(duplicate.id).not.toBe(deck.id);
    expect(duplicate.name).toBe("Local Builder Test Copy");
    expect(duplicate.cards.map((card) => card.name)).toEqual(
      deck.cards.map((card) => card.name),
    );
  });
});
