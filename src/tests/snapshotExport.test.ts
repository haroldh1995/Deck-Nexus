import { describe, expect, it } from "vitest";
import { defaultAppSettings, defaultBracketLock } from "../data/defaults";
import {
  CURRENT_SCHEMA_VERSION,
  createArenaDeckExport,
  createBackupMetadata,
  createCollectionSnapshot,
  createDeckSnapshot,
  createEcosystemExportPackage,
  createEcosystemZipPackage,
  createProfileSnapshot,
  evaluateImportCompatibility,
  getCurrentSchemaVersions,
  serializeCompressedJson,
  serializePrettyJson,
  serializePrimaryJson,
} from "../ecosystem";
import type { Deck, DeckCard, OwnedCard } from "../types/domain";

const now = "2026-01-01T00:00:00.000Z";

function card(overrides: Partial<DeckCard>): DeckCard {
  return {
    id: "card-counterspell",
    deckId: "deck-1",
    scryfallId: "scryfall-counterspell",
    oracleId: "oracle-counterspell",
    name: "Counterspell",
    manaCost: "{U}{U}",
    manaValue: 2,
    typeLine: "Instant",
    oracleText: "Counter target spell.",
    colorIdentity: ["U"],
    setCode: "lea",
    setName: "Limited Edition Alpha",
    collectorNumber: "55",
    quantity: 1,
    section: "main",
    categories: ["interaction"],
    roleTags: ["countermagic"],
    customTags: ["favorite"],
    notes: "Hold up mana.",
    protected: false,
    ownedQuantityAtAdd: 1,
    missingQuantity: 0,
    addedAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function deck(): Deck {
  const commander = card({
    id: "card-talrand",
    scryfallId: "scryfall-talrand",
    oracleId: "oracle-talrand",
    name: "Talrand, Sky Summoner",
    manaCost: "{2}{U}{U}",
    manaValue: 4,
    typeLine: "Legendary Creature - Merfolk Wizard",
    oracleText: "Whenever you cast an instant or sorcery spell, create a Drake.",
    section: "commander",
    categories: ["commander"],
    roleTags: ["commander"],
  });

  return {
    id: "deck-1",
    name: "Talrand Control",
    format: "commander",
    commanderIds: [commander.scryfallId],
    commanderNames: [commander.name],
    colorIdentity: ["U"],
    cards: [commander, card({}), card({ id: "card-island", name: "Island", oracleId: "oracle-island", scryfallId: "scryfall-island", typeLine: "Basic Land - Island", section: "main", quantity: 34 })],
    maybeboard: [card({ id: "card-opt", name: "Opt", oracleId: "oracle-opt", scryfallId: "scryfall-opt", section: "maybeboard", missingQuantity: 1 })],
    cuts: [card({ id: "card-cancel", name: "Cancel", oracleId: "oracle-cancel", scryfallId: "scryfall-cancel", section: "cuts" })],
    goals: [{ id: "goal-1", name: "Spells matter", priority: 1, type: "theme", settings: {} }],
    tags: ["control"],
    style: "control",
    powerTarget: 6,
    bracketLock: { ...defaultBracketLock, enabled: true, bracket: "bracket_3" },
    ownershipPreference: "owned_first",
    categoryStyle: "commander_roles",
    notes: "Local planning notes.",
    status: "draft",
    thumbnailCardId: commander.scryfallId,
    originalImportText: "",
    unresolvedImports: ["Unknown Card"],
    createdFrom: "blank",
    createdAt: now,
    updatedAt: now,
  };
}

function ownedCard(overrides: Partial<OwnedCard> = {}): OwnedCard {
  return {
    id: "owned-counterspell",
    oracleId: "oracle-counterspell",
    scryfallId: "scryfall-counterspell",
    name: "Counterspell",
    manaCost: "{U}{U}",
    manaValue: 2,
    typeLine: "Instant",
    oracleText: "Counter target spell.",
    colorIdentity: ["U"],
    quantityOwned: 1,
    printings: [
      {
        id: "printing-counterspell",
        scryfallId: "scryfall-counterspell",
        oracleId: "oracle-counterspell",
        name: "Counterspell",
        setCode: "lea",
        setName: "Limited Edition Alpha",
        collectorNumber: "55",
        language: "en",
        foil: false,
        condition: "near_mint",
        quantityOwned: 1,
        imageUri: "",
        lastScannedAt: now,
      },
    ],
    tags: ["binder"],
    notes: "Owned locally.",
    favorite: true,
    duplicateFlag: "none",
    deckUsage: { "deck-1": 1 },
    lastScannedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("ecosystem snapshot export foundation", () => {
  it("creates a canonical deck snapshot without gameplay state", () => {
    const snapshot = createDeckSnapshot(deck(), {
      ownedCards: [ownedCard()],
      createdAt: now,
    });

    expect(snapshot.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(snapshot.deckName).toBe("Talrand Control");
    expect(snapshot.commander.primaryCommanders[0]?.name).toBe("Talrand, Sky Summoner");
    expect(snapshot.mainDeck).toHaveLength(3);
    expect(snapshot.maybeboard).toHaveLength(1);
    expect(snapshot.cuts).toHaveLength(1);
    expect(snapshot.boardStateCompatibility.gameplayStateIncluded).toBe(false);
    expect(snapshot.boardStateCompatibility.validationStatus).toBe("not_validated");
    expect(snapshot.hubCompatibility.syncStatus).toBe("not_connected");
  });

  it("generates deterministic checksums and changes them when exported fields change", () => {
    const first = createDeckSnapshot(deck(), { ownedCards: [ownedCard()], createdAt: now });
    const second = createDeckSnapshot(deck(), { ownedCards: [ownedCard()], createdAt: now });
    const changedDeck = { ...deck(), notes: "Changed note." };
    const changed = createDeckSnapshot(changedDeck, {
      ownedCards: [ownedCard()],
      createdAt: now,
    });

    expect(first.checksum).toBe(second.checksum);
    expect(first.snapshotHash).toBe(first.checksum);
    expect(changed.checksum).not.toBe(first.checksum);
  });

  it("exports collection, profile, backup metadata, JSON, compressed JSON, and ZIP package", async () => {
    const collection = createCollectionSnapshot([ownedCard()], { createdAt: now });
    const profile = createProfileSnapshot({ ...defaultAppSettings, updatedAt: now }, now);
    const packageExport = createEcosystemExportPackage({
      deckSnapshot: createDeckSnapshot(deck(), { ownedCards: [ownedCard()], createdAt: now }),
      collectionSnapshot: collection,
      profileSnapshot: profile,
    });
    const zip = createEcosystemZipPackage(packageExport);
    const compressed = await serializeCompressedJson(packageExport);
    const backup = createBackupMetadata({
      id: "backup-1",
      name: "Local backup",
      deckCount: 1,
      ownedCardCount: 1,
      createdAt: now,
    });

    expect(collection.statistics.totalQuantity).toBe(1);
    expect(collection.setSummaries.lea).toBe(1);
    expect(profile.hubIdentity).toBeNull();
    expect(profile.friends).toEqual([]);
    expect(serializePrimaryJson(packageExport)).toContain("deck-snapshot.json");
    expect(serializePrettyJson(packageExport)).toContain("\n  ");
    expect(compressed.byteLength).toBeGreaterThan(0);
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
    expect(backup.checksum).toMatch(/^dnx-/);
  });

  it("generates Arena exports from the canonical snapshot", () => {
    const snapshot = createDeckSnapshot(deck(), {
      ownedCards: [ownedCard(), ownedCard({ id: "owned-island", oracleId: "oracle-island", scryfallId: "scryfall-island", name: "Island", quantityOwned: 34, printings: [] })],
      createdAt: now,
    });
    const all = createArenaDeckExport(snapshot);
    const ownedOnly = createArenaDeckExport(snapshot, "owned_only");
    const optimal = createArenaDeckExport(snapshot, "optimal");

    expect(all).toContain("Commander\n1 Talrand, Sky Summoner");
    expect(all).toContain("34 Island");
    expect(ownedOnly).toContain("34 Island");
    expect(ownedOnly).not.toContain("Opt");
    expect(optimal).toContain("Includes missing cards");
  });

  it("prepares import compatibility without rejecting legacy exports", () => {
    expect(evaluateImportCompatibility(getCurrentSchemaVersions()).migrationStatus)
      .toBe("current");
    expect(
      evaluateImportCompatibility({
        schemaVersion: "deck-nexus.snapshot.schema.v0",
        snapshotVersion: "deck-nexus.snapshot.v0",
        exportVersion: "deck-nexus.export.v0",
      }).migrationStatus,
    ).toBe("older_supported");
    expect(evaluateImportCompatibility({ schemaVersion: "unknown" }).migrationStatus)
      .toBe("unknown");
    expect(
      evaluateImportCompatibility({
        schemaVersion: "deck-nexus.snapshot.schema.v99",
        snapshotVersion: "deck-nexus.snapshot.v99",
        exportVersion: "deck-nexus.export.v99",
      }).migrationStatus,
    ).toBe("future_unsupported");
  });
});
