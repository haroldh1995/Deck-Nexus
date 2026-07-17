import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultBracketLock } from "../data/defaults";
import { resetDatabaseForTests } from "../db/database";
import { listBoardStateHandoffsForSnapshot } from "../db/repositories";
import {
  BOARDSTATE_ACKNOWLEDGMENT_SCHEMA_VERSION,
  BOARDSTATE_RETURN_SCHEMA_VERSION,
  boardStateManualImportInstructions,
  createBoardStateLaunchRequest,
  getBoardStateTransportCapabilities,
  parseBoardStateAcknowledgment,
  parseBoardStateReturnEnvelope,
  previewImmutableDeckSnapshot,
  runBoardStateHandoff,
  serializeBoardStateLaunchPackage,
} from "../ecosystem";
import type { Deck, DeckCard } from "../types/domain";

const now = "2026-01-01T00:00:00.000Z";

function card(overrides: Partial<DeckCard>): DeckCard {
  return {
    id: "card-counterspell",
    deckId: "deck-handoff",
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
    notes: "private note must not enter gameplay handoff",
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
    typeLine: "Legendary Creature - Merfolk Wizard",
    section: "commander",
    categories: ["commander"],
    roleTags: ["commander"],
  });

  return {
    id: "deck-handoff",
    name: "Handoff Test Deck",
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
    notes: "private deck note",
    status: "draft",
    originalImportText: "",
    unresolvedImports: [],
    createdFrom: "blank",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("BoardState cross-app handoff", () => {
  beforeEach(async () => {
    await resetDatabaseForTests();
    vi.restoreAllMocks();
  });

  it("builds versioned launch requests from immutable snapshots without gameplay state or private metadata", () => {
    const snapshot = previewImmutableDeckSnapshot(deck(), {
      sequenceNumber: 1,
      createdAt: now,
      consumerIntent: "advanced_gameplay",
    }).record;
    const request = createBoardStateLaunchRequest(snapshot, {
      intent: "advanced_gameplay",
      transportType: "file_export",
      createdAt: now,
    });
    const payload = serializeBoardStateLaunchPackage(request);

    expect(request.sourceApplication).toBe("deck_nexus");
    expect(request.targetApplication).toBe("boardstate");
    expect(request.snapshotId).toBe(snapshot.snapshotId);
    expect(request.gameplayChecksum).toBe(snapshot.gameplayChecksum);
    expect(request.privacy.privateNotesIncluded).toBe(false);
    expect(payload).not.toContain("private deck note");
    expect(payload).not.toContain("battlefield");
    expect(payload).not.toContain("lifeTotals");
    expect(request.nonce).toMatch(/^nonce_/);
    expect(request.correlationId).toMatch(/^boardstate-correlation_/);
  });

  it("detects transport capabilities honestly and rejects oversized compact methods", () => {
    const capabilities = getBoardStateTransportCapabilities(300_000, {
      clipboardAvailable: true,
      webShareAvailable: true,
      webShareFilesAvailable: true,
      fileDownloadAvailable: true,
      online: true,
    });

    expect(capabilities.find((capability) => capability.type === "file_export")?.status).toBe("available");
    expect(capabilities.find((capability) => capability.type === "clipboard")?.status).toBe("incompatible");
    expect(capabilities.find((capability) => capability.type === "direct_web")?.status).not.toBe("available");
    expect(capabilities.find((capability) => capability.type === "custom_uri")?.status).toBe("unavailable");
  });

  it("records file fallback as export-only and never as imported", async () => {
    const snapshot = previewImmutableDeckSnapshot(deck(), {
      sequenceNumber: 1,
      createdAt: now,
    }).record;

    const result = await runBoardStateHandoff(snapshot, {
      intent: "dry_run",
      transportType: "file_export",
      createdAt: now,
      runtime: { fileDownloadAvailable: true },
    });
    const history = await listBoardStateHandoffsForSnapshot(snapshot.snapshotId);

    expect(result.status).toBe("export_completed");
    expect(result.handoff.importedConfirmed).toBe(false);
    expect(result.handoff.sessionCreatedConfirmed).toBe(false);
    expect(history).toHaveLength(1);
    expect(boardStateManualImportInstructions(result.request).join(" ")).toMatch(/not mark the package imported/i);
  });

  it("supports clipboard fallback only when safe and available", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const snapshot = previewImmutableDeckSnapshot(deck(), {
      sequenceNumber: 1,
      createdAt: now,
    }).record;

    const result = await runBoardStateHandoff(snapshot, {
      intent: "import_only",
      transportType: "clipboard",
      createdAt: now,
      runtime: { clipboardAvailable: true },
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("export_completed");
    expect(result.handoff.importedConfirmed).toBe(false);
  });

  it("validates acknowledgments and rejects wrong request, correlation, snapshot, or checksum", () => {
    const snapshot = previewImmutableDeckSnapshot(deck(), {
      sequenceNumber: 1,
      createdAt: now,
    }).record;
    const request = createBoardStateLaunchRequest(snapshot, {
      intent: "advanced_gameplay",
      transportType: "post_message",
      createdAt: now,
    });
    const acknowledgment = {
      acknowledgmentId: "ack-1",
      acknowledgmentSchemaVersion: BOARDSTATE_ACKNOWLEDGMENT_SCHEMA_VERSION,
      launchRequestId: request.launchRequestId,
      correlationId: request.correlationId,
      targetApplication: "boardstate",
      receivedAt: now,
      acknowledgmentStatus: "imported",
      snapshotId: request.snapshotId,
      gameplayChecksum: request.gameplayChecksum,
      acceptedIntent: request.consumerIntent,
      unsupportedCapabilities: [],
      returnCapability: "none",
      transportMetadata: {},
    };

    expect(parseBoardStateAcknowledgment(acknowledgment, request).acknowledgmentStatus).toBe("imported");
    expect(() =>
      parseBoardStateAcknowledgment({ ...acknowledgment, launchRequestId: "wrong" }, request),
    ).toThrow(/request/i);
    expect(() =>
      parseBoardStateAcknowledgment({ ...acknowledgment, correlationId: "wrong" }, request),
    ).toThrow(/correlation/i);
    expect(() =>
      parseBoardStateAcknowledgment({ ...acknowledgment, snapshotId: "wrong" }, request),
    ).toThrow(/snapshot/i);
    expect(() =>
      parseBoardStateAcknowledgment({ ...acknowledgment, gameplayChecksum: "wrong" }, request),
    ).toThrow(/checksum/i);
  });

  it("validates return envelopes and does not treat proposals as automatic deck changes", () => {
    const snapshot = previewImmutableDeckSnapshot(deck(), {
      sequenceNumber: 1,
      createdAt: now,
    }).record;
    const request = createBoardStateLaunchRequest(snapshot, {
      intent: "dry_run",
      transportType: "post_message",
      createdAt: now,
    });
    const returned = parseBoardStateReturnEnvelope(
      {
        returnSchemaVersion: BOARDSTATE_RETURN_SCHEMA_VERSION,
        sourceApplication: "boardstate",
        targetApplication: "deck_nexus",
        launchRequestId: request.launchRequestId,
        correlationId: request.correlationId,
        snapshotId: request.snapshotId,
        gameplayChecksum: request.gameplayChecksum,
        returnType: "deck_change_proposal",
        returnedAt: now,
        payload: { proposedChanges: [{ add: "Island" }] },
        status: "accepted",
        integrity: { signed: false },
      },
      request,
    );

    expect(returned.returnType).toBe("deck_change_proposal");
    expect(returned.payload).toEqual({ proposedChanges: [{ add: "Island" }] });
    expect(() =>
      parseBoardStateReturnEnvelope({ ...returned, sourceApplication: "unknown" }, request),
    ).toThrow(/application/i);
  });
});
