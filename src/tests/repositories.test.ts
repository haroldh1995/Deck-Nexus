import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabaseForTests } from "../db/database";
import {
  addScanRecord,
  applyScanBatchToOwned,
  createBlankCommanderDeck,
  deleteDeck,
  ensureAppSettings,
  listOwnedCards,
  listScanRecords,
  listDecks,
  saveScanBatch,
  updateAppSettings,
} from "../db/repositories";
import { createScannerBatch } from "../features/scanner/scannerEngine";
import type { ScanRecord } from "../types/domain";

describe("local IndexedDB repositories", () => {
  beforeEach(async () => {
    await resetDatabaseForTests();
  });

  it("creates default app settings locally and keeps local-first mode enabled", async () => {
    const settings = await ensureAppSettings();

    expect(settings.id).toBe("app");
    expect(settings.localFirstMode).toBe(true);
    expect(settings.scannerBatchPersistence).toBe(true);
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

  it("makes capture insertion and collection commit idempotent while preserving duplicate quantity", async () => {
    const batch = await saveScanBatch(createScannerBatch({
      mode: "batch",
      destination: "owned_cards",
    }));
    const base: Omit<ScanRecord, "id" | "createdAt" | "updatedAt"> = {
      batchId: batch.id,
      captureId: "capture-a",
      scanSessionId: "session",
      targetId: "target-a",
      captureGeneration: 1,
      rawText: "Fodder Cannon",
      scryfallId: "printing-fodder",
      oracleId: "oracle-fodder",
      name: "Fodder Cannon",
      quantity: 1,
      status: "confirmed",
      identityStatus: "verified",
      printingStatus: "verified",
      printingConfidence: 0.96,
      printingId: "printing-fodder",
      typeLine: "Artifact",
      setCode: "8ed",
      setName: "Eighth Edition",
      collectorNumber: "302",
      language: "en",
      finish: "nonfoil",
      matchSource: "scryfall_exact",
    };
    const first: ScanRecord = { ...base, id: "record-a", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" };
    const second: ScanRecord = { ...base, id: "record-b", captureId: "capture-b", targetId: "target-b", captureGeneration: 2, createdAt: "2026-01-01T00:00:01.000Z", updatedAt: "2026-01-01T00:00:01.000Z" };
    await addScanRecord(first);
    await addScanRecord(first);
    await addScanRecord(second);

    expect(await listScanRecords(batch.id)).toHaveLength(2);
    expect((await applyScanBatchToOwned(batch.id))).toBe(2);
    expect((await applyScanBatchToOwned(batch.id))).toBe(0);
    const owned = await listOwnedCards();
    expect(owned[0]?.quantityOwned).toBe(2);
    expect(owned[0]?.printings[0]?.quantityOwned).toBe(2);
  });
});
