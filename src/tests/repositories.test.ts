import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabaseForTests } from "../db/database";
import {
  createBlankCommanderDeck,
  deleteDeck,
  ensureAppSettings,
  listOwnedCards,
  listDecks,
  updateAppSettings,
} from "../db/repositories";
import { applyCollectionImport } from "../features/import/collectionImportService";
import type { ImportResolvedEntry } from "../features/import/importResolution";

describe("local IndexedDB repositories", () => {
  beforeEach(async () => {
    await resetDatabaseForTests();
  });

  it("creates default app settings locally and keeps local-first mode enabled", async () => {
    const settings = await ensureAppSettings();

    expect(settings.id).toBe("app");
    expect(settings.localFirstMode).toBe(true);
  });

  it("saves settings updates to IndexedDB", async () => {
    await ensureAppSettings();
    const settings = await updateAppSettings({
      reducedMotion: true,
      staticHomeScreen: true,
      glowIntensity: 0.7,
    });

    expect(settings.reducedMotion).toBe(true);
    expect(settings.staticHomeScreen).toBe(true);
    expect(settings.glowIntensity).toBe(0.7);
    expect((await ensureAppSettings()).staticHomeScreen).toBe(true);
  });

  it("creates and deletes a blank Commander deck", async () => {
    const deck = await createBlankCommanderDeck({
      name: "Moonlit Nexus",
      commanderName: "Alela, Artful Provocateur",
      goals: ["Flyers", "Artifacts"],
    });

    expect(deck.format).toBe("commander");
    expect(deck.commanderNames).toEqual(["Alela, Artful Provocateur"]);
    expect(deck.goals).toHaveLength(2);

    const decks = await listDecks();
    expect(decks).toHaveLength(1);
    expect(decks[0].name).toBe("Moonlit Nexus");

    await deleteDeck(deck.id);
    expect(await listDecks()).toHaveLength(0);
  });

  it("imports repeated collection quantities without losing canonical printing data", async () => {
    const entry: ImportResolvedEntry = {
      id: "entry-1",
      quantity: 1,
      name: "Sol Ring",
      section: "main",
      originalLine: "1 Sol Ring",
      duplicateCount: 1,
      status: "resolved",
      fuzzy: false,
      exactPrinting: true,
      ownershipStatus: "not_owned",
      warnings: [],
      removed: false,
      keepUnresolved: false,
      catalogCard: {
        id: "seed-sol-ring",
        scryfallId: "scryfall-sol-ring",
        oracleId: "oracle-sol-ring",
        name: "Sol Ring",
        manaCost: "{1}",
        manaValue: 1,
        typeLine: "Artifact",
        oracleText: "{T}: Add {C}{C}.",
        colorIdentity: [],
        keywords: [],
        roles: [],
        commanderLegal: true,
        banned: false,
        bracketImpact: 0,
      },
    };
    await applyCollectionImport({ entries: [entry], sourceName: "test.csv", detectedFormat: "csv", strategy: "merge", originalText: "1,Sol Ring" });
    await applyCollectionImport({ entries: [entry], sourceName: "test.csv", detectedFormat: "csv", strategy: "merge", originalText: "1,Sol Ring" });
    const owned = await listOwnedCards();
    expect(owned[0]?.quantityOwned).toBe(2);
  });
});
