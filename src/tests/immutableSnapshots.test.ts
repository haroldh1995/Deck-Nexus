import { beforeEach, describe, expect, it } from "vitest";
import { defaultBracketLock } from "../data/defaults";
import { resetDatabaseForTests } from "../db/database";
import {
  archiveImmutableDeckSnapshotRecord,
  getImmutableDeckSnapshotRecord,
  listImmutableDeckSnapshotsForDeck,
  saveImmutableDeckSnapshotRecord,
} from "../db/repositories";
import {
  compareDeckToSnapshot,
  createAdvancedGameplaySnapshotEnvelope,
  createDeckSnapshot,
  createDryRunSnapshotEnvelope,
  duplicateImmutableSnapshotToDeck,
  previewImmutableDeckSnapshot,
  verifyImmutableDeckSnapshot,
} from "../ecosystem";
import type {
  BoardStateValidationResultRecord,
  Deck,
  DeckCard,
} from "../types/domain";

const now = "2026-01-01T00:00:00.000Z";

function card(overrides: Partial<DeckCard>): DeckCard {
  return {
    id: "card-counterspell",
    deckId: "deck-snapshot",
    scryfallId: "scryfall-counterspell",
    oracleId: "oracle-counterspell",
    name: "Counterspell",
    manaCost: "{U}{U}",
    manaValue: 2,
    typeLine: "Instant",
    oracleText: "Counter target spell.",
    colorIdentity: ["U"],
    quantity: 1,
    section: "main",
    categories: ["interaction"],
    roleTags: ["countermagic"],
    customTags: [],
    notes: "",
    protected: false,
    ownedQuantityAtAdd: 0,
    missingQuantity: 1,
    addedAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function deck(overrides: Partial<Deck> = {}): Deck {
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
    id: "deck-snapshot",
    name: "Snapshot Test Deck",
    format: "commander",
    commanderIds: [commander.scryfallId],
    commanderNames: [commander.name],
    colorIdentity: ["U"],
    cards: [commander, card({})],
    maybeboard: [],
    cuts: [],
    goals: [],
    tags: [],
    style: "control",
    powerTarget: 6,
    bracketLock: defaultBracketLock,
    ownershipPreference: "allow_missing",
    categoryStyle: "commander_roles",
    notes: "",
    status: "draft",
    originalImportText: "",
    unresolvedImports: [],
    createdFrom: "blank",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function authoritativeResult(
  snapshotChecksum: string,
  overrides: Partial<BoardStateValidationResultRecord> = {},
): BoardStateValidationResultRecord {
  return {
    id: "validation-1",
    deckId: "deck-snapshot",
    snapshotId: "deck-snapshot:deck-snapshot:2026",
    snapshotVersion: "deck-nexus.snapshot.v1",
    snapshotChecksum,
    requestId: "request-1",
    responseId: "response-1",
    boardStateVersion: "1.2.3",
    rulesVersion: "rules-2026",
    status: "valid",
    legalityStatus: "legal",
    issues: [],
    warnings: [],
    informationalFindings: [],
    unsupportedChecks: [],
    validatedAt: now,
    receivedAt: now,
    stale: false,
    transportType: "http",
    schemaVersions: {},
    authoritative: true,
    sourceAuthority: "boardstate",
    testOnly: false,
    ...overrides,
  };
}

describe("immutable deck snapshots", () => {
  beforeEach(async () => {
    await resetDatabaseForTests();
  });

  it("creates deterministic immutable snapshots without mutating the source deck", () => {
    const source = deck();
    const snapshot = previewImmutableDeckSnapshot(source, {
      sequenceNumber: 1,
      createdAt: now,
      consumerIntent: "archival",
    });
    const later = previewImmutableDeckSnapshot(
      deck({ cards: source.cards.map((entry) => ({ ...entry, updatedAt: "2026-02-01T00:00:00.000Z" })) }),
      {
        sequenceNumber: 2,
        createdAt: "2026-02-01T00:00:00.000Z",
        consumerIntent: "archival",
      },
    );

    expect(source.cards[0].deckId).toBe("deck-snapshot");
    expect(snapshot.record.gameplayChecksum).toBe(later.record.gameplayChecksum);
    expect(Object.is(snapshot.snapshot.gameplay.mainDeck, source.cards)).toBe(false);
  });

  it("separates gameplay checksum from full archival metadata", () => {
    const base = previewImmutableDeckSnapshot(deck(), {
      sequenceNumber: 1,
      createdAt: now,
    });
    const notesChanged = previewImmutableDeckSnapshot(deck({ notes: "Private note" }), {
      sequenceNumber: 1,
      createdAt: now,
    });
    const gameplayChanged = previewImmutableDeckSnapshot(
      deck({ cards: [...deck().cards, card({ id: "card-opt", name: "Opt", oracleId: "oracle-opt", scryfallId: "scryfall-opt" })] }),
      { sequenceNumber: 1, createdAt: now },
    );

    expect(notesChanged.record.gameplayChecksum).toBe(base.record.gameplayChecksum);
    expect(notesChanged.record.fullChecksum).not.toBe(base.record.fullChecksum);
    expect(gameplayChanged.record.gameplayChecksum).not.toBe(base.record.gameplayChecksum);
  });

  it("handles unresolved identifiers and associates only exact real BoardState results", () => {
    const canonical = createDeckSnapshot(deck(), { createdAt: now });
    const valid = previewImmutableDeckSnapshot(deck(), {
      sequenceNumber: 1,
      createdAt: now,
      canonicalSnapshot: canonical,
      validationResults: [authoritativeResult(canonical.checksum ?? "")],
    });
    const testOnly = previewImmutableDeckSnapshot(deck(), {
      sequenceNumber: 1,
      createdAt: now,
      canonicalSnapshot: canonical,
      validationResults: [
        authoritativeResult(canonical.checksum ?? "", {
          id: "validation-test",
          sourceAuthority: "boardstate_test_adapter",
          authoritative: false,
          testOnly: true,
        }),
      ],
    });
    const unresolved = previewImmutableDeckSnapshot(
      deck({ cards: [...deck().cards, card({ id: "card-local", oracleId: "local-oracle-x", scryfallId: "local-scryfall-x", name: "Mystery Card" })] }),
      { sequenceNumber: 1, createdAt: now },
    );

    expect(valid.record.matchingValidationResultId).toBe("validation-1");
    expect(valid.record.status).toBe("validated");
    expect(testOnly.record.matchingValidationResultId).toBeUndefined();
    expect(unresolved.record.status).toBe("unresolved");
  });

  it("persists snapshots append-only, detects corruption, archives outside protected payload, and compares deck changes", async () => {
    const result = previewImmutableDeckSnapshot(deck(), {
      sequenceNumber: 1,
      createdAt: now,
    });
    await saveImmutableDeckSnapshotRecord(result.record);

    await expect(saveImmutableDeckSnapshotRecord(result.record)).rejects.toThrow(/cannot be overwritten/i);
    expect(await listImmutableDeckSnapshotsForDeck("deck-snapshot")).toHaveLength(1);
    expect(verifyImmutableDeckSnapshot(result.record).verified).toBe(true);

    const archived = await archiveImmutableDeckSnapshotRecord(result.record.snapshotId);
    expect(archived.archivalState).toBe("archived");
    expect(verifyImmutableDeckSnapshot(archived).verified).toBe(true);

    const corrupted = {
      ...result.record,
      immutablePayload: {
        ...result.record.immutablePayload,
        deckIdentity: { deckName: "Tampered" },
      },
    };
    expect(verifyImmutableDeckSnapshot(corrupted).status).toBe("full_snapshot_mismatch");

    const changedDeck = deck({
      cards: [...deck().cards, card({ id: "card-opt", name: "Opt", oracleId: "oracle-opt", scryfallId: "scryfall-opt" })],
    });
    expect(compareDeckToSnapshot(changedDeck, result.record).status).toBe("gameplay_changed");
  });

  it("duplicates a snapshot into a new mutable deck and creates future envelopes without runtime gameplay state", async () => {
    const result = previewImmutableDeckSnapshot(deck(), {
      sequenceNumber: 1,
      createdAt: now,
      consumerIntent: "advanced_gameplay",
    });
    await saveImmutableDeckSnapshotRecord(result.record);

    const duplicate = await duplicateImmutableSnapshotToDeck(result.record);
    const advanced = createAdvancedGameplaySnapshotEnvelope(result.record, now);
    const dryRun = createDryRunSnapshotEnvelope(result.record, now);

    expect(duplicate.id).not.toBe(result.record.deckId);
    expect(duplicate.createdFrom).toBe("snapshot_duplicate");
    expect(duplicate.createdFromSnapshotId).toBe(result.record.snapshotId);
    expect((await getImmutableDeckSnapshotRecord(result.record.snapshotId))?.fullChecksum).toBe(result.record.fullChecksum);
    expect(JSON.stringify(advanced)).not.toMatch(/battlefield|graveyard|openingHand|lifeTotals/);
    expect(JSON.stringify(dryRun)).not.toMatch(/battlefield|graveyard|openingHand|lifeTotals/);
  });
});
