import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { defaultBracketLock } from "../data/defaults";
import { resetDatabaseForTests } from "../db/database";
import { saveBoardStateValidationResult } from "../db/repositories";
import {
  createBoardStateValidationRequest,
  createDeckSnapshot,
  createBoardStateResultRecordFromResponse,
} from "../ecosystem";
import { createBoardStateTestAdapter } from "../ecosystem/boardstate/adapters/testAdapter";
import { createUnavailableBoardStateAdapter } from "../ecosystem/boardstate/adapters/unavailableAdapter";
import { BoardStateValidationPanel } from "../features/export/BoardStateValidationPanel";
import type { Deck, DeckCard } from "../types/domain";

const now = "2026-01-01T00:00:00.000Z";

function card(overrides: Partial<DeckCard>): DeckCard {
  return {
    id: "card-counterspell",
    deckId: "deck-panel",
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
    id: "deck-panel",
    name: "Panel Test Deck",
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

describe("BoardState validation panel", () => {
  beforeEach(async () => {
    await resetDatabaseForTests();
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
  });

  it("shows unavailable production status without claiming live validation", async () => {
    const snapshot = createDeckSnapshot(deck(), { createdAt: now });
    render(
      <BoardStateValidationPanel
        snapshot={snapshot}
        transport={createUnavailableBoardStateAdapter()}
      />,
    );

    expect(await screen.findByText(/BoardState validation is not connected/i))
      .toBeInTheDocument();
    expect(screen.queryByText(/Validated by BoardState/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Validate with BoardState" }));
    expect(await screen.findByText(/requires a configured bridge/i)).toBeInTheDocument();
  });

  it("renders legal, warning, and issue states from a test adapter without raw HTML", async () => {
    const snapshot = createDeckSnapshot(deck(), { createdAt: now });
    render(
      <BoardStateValidationPanel
        snapshot={snapshot}
        transport={createBoardStateTestAdapter("illegal")}
      />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Validate with BoardState" }));

    expect(await screen.findByText("BoardState test adapter: Issues Found"))
      .toBeInTheDocument();
    expect(await screen.findByText("Singleton issue")).toBeInTheDocument();
    expect(screen.getByText(/Test adapter found a duplicate nonbasic card/))
      .toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });

  it("marks saved validation records stale when the snapshot checksum changes", async () => {
    const originalSnapshot = createDeckSnapshot(deck(), { createdAt: now });
    const request = createBoardStateValidationRequest(originalSnapshot, {
      requestId: "request-stale-panel",
      createdAt: now,
    });
    const response = await createBoardStateTestAdapter("legal")
      .validateDeckSnapshot(request);
    await saveBoardStateValidationResult(
      createBoardStateResultRecordFromResponse(request, response, now),
    );

    const changedSnapshot = createDeckSnapshot(
      deck({ cards: [...deck().cards, card({ id: "card-opt", name: "Opt", oracleId: "oracle-opt", scryfallId: "scryfall-opt" })] }),
      { createdAt: now },
    );
    render(
      <BoardStateValidationPanel
        snapshot={changedSnapshot}
        transport={createBoardStateTestAdapter("legal")}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText(/Deck changed since BoardState validation/i))
        .toBeInTheDocument(),
    );
  });
});
