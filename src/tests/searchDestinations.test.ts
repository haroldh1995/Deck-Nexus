import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDatabaseForTests } from "../db/database";
import { createBlankCommanderDeck } from "../db/repositories";
import {
  addCardsToCustomCollectionFromSearch,
  addCardsToWishlistFromSearch,
  applySearchUndoTransaction,
  favoriteCardsFromSearch,
  getPrimarySearchAction,
  getUniversalDestinations,
  isCommanderEligible,
  rankDecksForCards,
} from "../features/cards/searchDestinations";
import type { DeckstateScryfallCard } from "../types/domain";

function card(overrides: Partial<DeckstateScryfallCard> = {}): DeckstateScryfallCard {
  return {
    id: "scryfall-sol-ring",
    oracleId: "oracle-sol-ring",
    name: "Sol Ring",
    lang: "en",
    apiUri: "https://api.scryfall.com/cards/scryfall-sol-ring",
    layout: "normal",
    manaCost: "{1}",
    manaValue: 1,
    typeLine: "Artifact",
    oracleText: "{T}: Add {C}{C}.",
    colors: [],
    colorIdentity: [],
    keywords: [],
    legalities: { commander: "legal" },
    games: ["paper"],
    setCode: "cmm",
    setName: "Commander Masters",
    collectorNumber: "400",
    rarity: "uncommon",
    imageUris: { small: "small.jpg", normal: "normal.jpg" },
    cardFaces: [],
    lastFetchedAt: new Date(0).toISOString(),
    ...overrides,
  };
}

describe("Search destination workflows", () => {
  beforeEach(async () => {
    await resetDatabaseForTests();
  });

  it("exposes Add To destinations and context-specific primary actions", () => {
    expect(getUniversalDestinations({ context: "global", hasCurrentDeck: false }).map((destination) => destination.id)).toContain("wishlist");
    expect(getUniversalDestinations({ context: "deck", hasCurrentDeck: true }).map((destination) => destination.id)).toContain("current_deck");
    expect(getPrimarySearchAction({ context: "global", hasCurrentDeck: false }).label).toBe("View Card");
    expect(getPrimarySearchAction({ context: "deck", hasCurrentDeck: true }).label).toBe("Add to Current Deck");
    expect(getPrimarySearchAction({ context: "owned", hasCurrentDeck: false }).destination).toBe("owned");
  });

  it("detects commander eligibility without silently accepting illegal commanders", () => {
    expect(isCommanderEligible(card())).toBe(false);
    expect(isCommanderEligible(card({ name: "Tatyova, Benthic Druid", typeLine: "Legendary Creature - Merfolk Druid" }))).toBe(true);
  });

  it("merges wishlist quantities and records undo data", async () => {
    await addCardsToWishlistFromSearch({
      cards: [card()],
      quantity: 1,
      priority: "normal",
      sourceQuery: "sol ring",
    });
    const second = await addCardsToWishlistFromSearch({
      cards: [card()],
      quantity: 2,
      priority: "high",
      sourceQuery: "sol ring",
    });

    const wishlist = await db.wishlist.toArray();
    expect(wishlist).toHaveLength(1);
    expect(wishlist[0].desiredQuantity).toBe(3);
    expect(wishlist[0].priority).toBe("high");

    if (second.undo) {
      await applySearchUndoTransaction(second.undo);
    }
    const restored = await db.wishlist.toArray();
    expect(restored).toHaveLength(1);
    expect(restored[0].desiredQuantity).toBe(1);
    expect(restored[0].priority).toBe("normal");
  });

  it("creates custom collections and favorites without price fields", async () => {
    const collectionResult = await addCardsToCustomCollectionFromSearch({
      cards: [card()],
      collectionName: "Future Commanders",
      sourceQuery: "sol ring",
    });
    const favoriteResult = await favoriteCardsFromSearch({ cards: [card()], sourceQuery: "sol ring" });

    expect(await db.customCollections.count()).toBe(1);
    expect(await db.customCollectionEntries.count()).toBe(1);
    expect(await db.favorites.count()).toBe(1);
    expect(JSON.stringify(await db.customCollectionEntries.toArray())).not.toMatch(/usd|eur|tix|purchase|tcgplayer/i);

    if (collectionResult.undo) {
      await applySearchUndoTransaction(collectionResult.undo);
    }
    if (favoriteResult.undo) {
      await applySearchUndoTransaction(favoriteResult.undo);
    }
    expect(await db.customCollections.count()).toBe(0);
    expect(await db.favorites.count()).toBe(0);
  });

  it("ranks compatible existing decks before incompatible decks", async () => {
    const simic = await createBlankCommanderDeck({ name: "Simic Deck" });
    await db.decks.put({ ...simic, colorIdentity: ["G", "U"] });
    const monoRed = await createBlankCommanderDeck({ name: "Red Deck" });
    await db.decks.put({ ...monoRed, colorIdentity: ["R"] });

    const ranked = rankDecksForCards(
      await db.decks.toArray(),
      [card({ name: "Tatyova, Benthic Druid", oracleId: "oracle-tatyova", id: "scryfall-tatyova", colorIdentity: ["G", "U"] })],
    );

    expect(ranked[0].deck.name).toBe("Simic Deck");
    expect(ranked[0].compatibleCount).toBe(1);
    expect(ranked[1].outsideIdentityCount).toBe(1);
  });
});
