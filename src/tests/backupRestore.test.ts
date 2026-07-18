import { beforeEach, describe, expect, it } from "vitest";
import { db, resetDatabaseForTests } from "../db/database";
import {
  createBlankCommanderDeck,
  createFullBackupPackage,
  ensureAppSettings,
  getBoardStateHandoffRecord,
  getLatestBoardStateValidationResult,
  listBackupPackages,
  listDecks,
  listImmutableDeckSnapshotsForDeck,
  listOwnedCards,
  restoreFullBackupPackage,
  saveBoardStateHandoffRecord,
  saveBoardStateValidationResult,
  updateAppSettings,
  updateDeckMetadata,
  upsertOwnedCard,
} from "../db/repositories";
import { createDeckSnapshot } from "../ecosystem/export";
import { createImmutableDeckSnapshot } from "../ecosystem/snapshots";
import type {
  BoardStateHandoffRecord,
  BoardStateValidationResultRecord,
} from "../types/domain";

describe("local backup and restore", () => {
  beforeEach(async () => {
    await resetDatabaseForTests();
  });

  it("round-trips decks, ownership, settings, snapshots, validation, and handoff history without nested backups", async () => {
    await ensureAppSettings();
    await updateAppSettings({ reducedMotion: true, scannerConfirmationSound: false });
    const deck = await createBlankCommanderDeck({
      name: "Backup Ready",
      commanderName: "Alela, Artful Provocateur",
      goals: ["Artifacts"],
    });
    await upsertOwnedCard({
      name: "Sol Ring",
      oracleId: "oracle-sol-ring",
      scryfallId: "scryfall-sol-ring",
      quantityOwned: 2,
      tags: ["mana"],
    });

    const canonicalSnapshot = createDeckSnapshot(deck);
    const validation: BoardStateValidationResultRecord = {
      id: "validation-1",
      deckId: deck.id,
      snapshotId: canonicalSnapshot.snapshotId,
      snapshotVersion: canonicalSnapshot.snapshotVersion,
      snapshotChecksum: canonicalSnapshot.checksum ?? "",
      requestId: "request-1",
      responseId: "response-1",
      boardStateVersion: "boardstate-test",
      rulesVersion: "rules-test",
      status: "valid",
      legalityStatus: "legal",
      issues: [],
      warnings: [],
      informationalFindings: [],
      unsupportedChecks: [],
      validatedAt: "2026-01-01T00:00:00.000Z",
      receivedAt: "2026-01-01T00:00:01.000Z",
      stale: false,
      transportType: "test",
      schemaVersions: {},
      authoritative: true,
      sourceAuthority: "boardstate",
      testOnly: false,
    };
    await saveBoardStateValidationResult(validation);

    const snapshotResult = await createImmutableDeckSnapshot(deck, {
      canonicalSnapshot,
      creationReason: "manual",
      consumerIntent: "archival",
      validationResults: [validation],
    });
    const handoff: BoardStateHandoffRecord = {
      id: "handoff-1",
      launchRequestId: "launch-1",
      deckId: deck.id,
      snapshotId: snapshotResult.record.snapshotId,
      gameplayChecksum: snapshotResult.record.gameplayChecksum,
      consumerIntent: "advanced_gameplay",
      transportType: "file_download",
      createdAt: "2026-01-01T00:00:02.000Z",
      finalStatus: "export_completed",
      payloadSize: 128,
      importedConfirmed: false,
      sessionCreatedConfirmed: false,
    };
    await saveBoardStateHandoffRecord(handoff);

    const backup = await createFullBackupPackage("Round-trip backup");
    expect(backup.contents.tables).toBeDefined();
    expect((backup.contents.tables as Record<string, unknown>).backups).toBeUndefined();

    await resetDatabaseForTests();
    const result = await restoreFullBackupPackage(backup);

    expect(result.conflictRecords).toBe(0);
    expect(result.restoredRecords).toBeGreaterThanOrEqual(6);
    expect(await listBackupPackages()).toEqual([]);
    expect((await ensureAppSettings()).reducedMotion).toBe(true);
    expect((await listDecks()).map((restoredDeck) => restoredDeck.name)).toContain("Backup Ready");
    expect((await listOwnedCards()).map((card) => card.name)).toContain("Sol Ring");
    expect(await listImmutableDeckSnapshotsForDeck(deck.id)).toHaveLength(1);
    expect(await getLatestBoardStateValidationResult(deck.id)).toMatchObject({
      id: "validation-1",
      stale: false,
    });
    expect(await getBoardStateHandoffRecord("handoff-1")).toMatchObject({
      finalStatus: "export_completed",
      importedConfirmed: false,
    });
  });

  it("does not overwrite conflicting records unless explicitly requested", async () => {
    const deck = await createBlankCommanderDeck({ name: "Original Deck" });
    const backup = await createFullBackupPackage("Conflict backup");

    await updateDeckMetadata(deck.id, { name: "Changed Deck" });
    const conflictResult = await restoreFullBackupPackage(backup);
    expect(conflictResult.conflictRecords).toBeGreaterThan(0);
    expect((await db.decks.get(deck.id))?.name).toBe("Changed Deck");

    const overwriteResult = await restoreFullBackupPackage(backup, {
      overwriteConflicts: true,
    });
    expect(overwriteResult.conflictRecords).toBe(0);
    expect((await db.decks.get(deck.id))?.name).toBe("Original Deck");
  });
});
