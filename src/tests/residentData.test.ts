import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDatabaseForTests } from "../db/database";
import { createBlankCommanderDeck } from "../db/repositories";
import {
  getResidentDecks,
  hydrateResidentDecks,
  refreshResidentDecks,
} from "../db/residentData";

describe("resident persisted data", () => {
  beforeEach(async () => {
    await resetDatabaseForTests();
  });

  it("deduplicates initial hydration and reuses unchanged data", async () => {
    const firstRequest = hydrateResidentDecks();
    const secondRequest = hydrateResidentDecks();

    expect(secondRequest).toBe(firstRequest);
    await expect(firstRequest).resolves.toEqual([]);
    expect(getResidentDecks()).toEqual([]);

    await createBlankCommanderDeck({ name: "Resident Deck" });

    await expect(hydrateResidentDecks()).resolves.toEqual([]);
    expect(getResidentDecks()).toEqual([]);
  });

  it("refreshes the resident collection only when explicitly invalidated", async () => {
    const deck = await createBlankCommanderDeck({ name: "Changed Deck" });
    await refreshResidentDecks();

    expect(getResidentDecks()).toHaveLength(1);
    await db.decks.delete(deck.id);
    expect(getResidentDecks()).toHaveLength(1);

    await refreshResidentDecks();
    expect(getResidentDecks()).toEqual([]);
  });
});
