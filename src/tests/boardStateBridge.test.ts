import { beforeEach, describe, expect, it } from "vitest";
import { defaultBracketLock } from "../data/defaults";
import { resetDatabaseForTests } from "../db/database";
import {
  getLatestBoardStateValidationResult,
  getLatestSuccessfulBoardStateValidationResult,
  listBoardStateValidationResults,
  saveBoardStateValidationResult,
} from "../db/repositories";
import {
  compareBoardStateCapabilities,
  createBoardStateValidationRequest,
  createConfiguredBoardStateTransport,
  createDeckSnapshot,
  isBoardStateResultStale,
  parseBoardStateValidationResponse,
  validateDeckSnapshotWithBoardState,
} from "../ecosystem";
import { createBoardStateTestAdapter } from "../ecosystem/boardstate/adapters/testAdapter";
import type { Deck, DeckCard } from "../types/domain";

const now = "2026-01-01T00:00:00.000Z";

function card(overrides: Partial<DeckCard>): DeckCard {
  return {
    id: "card-counterspell",
    deckId: "deck-bridge",
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
    id: "deck-bridge",
    name: "Bridge Test Deck",
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

describe("BoardState validation bridge", () => {
  beforeEach(async () => {
    await resetDatabaseForTests();
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  it("builds a versioned validation request from a canonical deck snapshot", () => {
    const snapshot = createDeckSnapshot(deck(), { createdAt: now });
    const request = createBoardStateValidationRequest(snapshot, {
      requestId: "request-1",
      createdAt: now,
    });

    expect(request.requestedAuthority).toBe("boardstate");
    expect(request.deckSnapshotId).toBe(snapshot.snapshotId);
    expect(request.deckSnapshotChecksum).toBe(snapshot.checksum);
    expect(request.privacy.gameplayStateIncluded).toBe(false);
    expect(request.privacy.collectionSnapshotIncluded).toBe(false);
    expect(request.privacy.profileDataIncluded).toBe(false);
    expect(request.requestedValidationModes).toContain("commander_legality");
    expect(request).not.toHaveProperty("profileSnapshot");
  });

  it("does not activate the test adapter from production configuration", async () => {
    const transport = createConfiguredBoardStateTransport();
    const status = await transport.getStatus();

    expect(transport.transportType).not.toBe("test_adapter");
    expect(status.testOnly).toBe(false);
    expect(status.authoritativeAvailable).toBe(false);
  });

  it("negotiates capabilities and stores non-destructive test-adapter results", async () => {
    const snapshot = createDeckSnapshot(deck(), { createdAt: now });
    const adapter = createBoardStateTestAdapter("legal");
    const request = createBoardStateValidationRequest(snapshot, {
      requestId: "request-capability",
      createdAt: now,
    });
    const match = compareBoardStateCapabilities(await adapter.getCapabilities(), request);

    expect(match.compatible).toBe(true);

    const run = await validateDeckSnapshotWithBoardState({
      snapshot,
      transport: adapter,
      request,
    });
    await saveBoardStateValidationResult(run.record);

    expect(run.record.legalityStatus).toBe("legal");
    expect(run.record.authoritative).toBe(false);
    expect(run.record.testOnly).toBe(true);
    expect(await listBoardStateValidationResults(snapshot.deckId)).toHaveLength(1);
  });

  it("rejects checksum mismatch and does not mark network failures as illegal", async () => {
    const snapshot = createDeckSnapshot(deck(), { createdAt: now });
    const mismatch = await validateDeckSnapshotWithBoardState({
      snapshot,
      transport: createBoardStateTestAdapter("checksum_mismatch"),
    });
    const timeout = await validateDeckSnapshotWithBoardState({
      snapshot,
      transport: createBoardStateTestAdapter("timeout"),
    });

    expect(mismatch.record.status).toBe("malformed_response");
    expect(mismatch.record.legalityStatus).toBe("not_validated");
    expect(timeout.record.status).toBe("timeout");
    expect(timeout.record.legalityStatus).not.toBe("illegal");
  });

  it("parses defensively and rejects malformed or incompatible responses", () => {
    const snapshot = createDeckSnapshot(deck(), { createdAt: now });
    const request = createBoardStateValidationRequest(snapshot, {
      requestId: "request-parse",
      createdAt: now,
    });

    expect(() => parseBoardStateValidationResponse({ invalid: true }, request))
      .toThrow(/schema/i);
    expect(() =>
      parseBoardStateValidationResponse(
        {
          responseSchemaVersion: "boardstate.validation.response.v1",
          requestId: "other",
          authorityApplication: "boardstate",
        },
        request,
      ),
    ).toThrow(/request/i);
  });

  it("detects stale results by snapshot checksum and preserves validation history", async () => {
    const snapshot = createDeckSnapshot(deck(), { createdAt: now });
    const legal = await validateDeckSnapshotWithBoardState({
      snapshot,
      transport: createBoardStateTestAdapter("legal"),
    });
    await saveBoardStateValidationResult(legal.record);

    const timeout = await validateDeckSnapshotWithBoardState({
      snapshot,
      transport: createBoardStateTestAdapter("timeout"),
    });
    await saveBoardStateValidationResult(timeout.record);

    const changedSnapshot = createDeckSnapshot(
      deck({ cards: [...deck().cards, card({ id: "card-opt", name: "Opt", oracleId: "oracle-opt", scryfallId: "scryfall-opt" })] }),
      { createdAt: now },
    );

    expect(isBoardStateResultStale(legal.record, changedSnapshot)).toBe(true);
    expect(await listBoardStateValidationResults(snapshot.deckId)).toHaveLength(2);
    expect((await getLatestBoardStateValidationResult(snapshot.deckId))?.status).toBe("timeout");
    expect((await getLatestSuccessfulBoardStateValidationResult(snapshot.deckId))?.legalityStatus)
      .toBe("legal");
  });
});
