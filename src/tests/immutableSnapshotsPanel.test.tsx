import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { defaultBracketLock } from "../data/defaults";
import { resetDatabaseForTests } from "../db/database";
import { ImmutableSnapshotsPanel } from "../features/export/ImmutableSnapshotsPanel";
import type { Deck, DeckCard } from "../types/domain";

const now = "2026-01-01T00:00:00.000Z";

function card(overrides: Partial<DeckCard>): DeckCard {
  return {
    id: "card-counterspell",
    deckId: "deck-panel-snapshot",
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
    typeLine: "Legendary Creature - Merfolk Wizard",
    section: "commander",
    categories: ["commander"],
    roleTags: ["commander"],
  });

  return {
    id: "deck-panel-snapshot",
    name: "Snapshot Panel Deck",
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

function renderPanel(sourceDeck: Deck) {
  return render(
    <MemoryRouter initialEntries={["/export"]}>
      <Routes>
        <Route path="/export" element={<ImmutableSnapshotsPanel deck={sourceDeck} />} />
        <Route path="/deck-builder/:deckId" element={<h1>Deck Builder</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("immutable snapshots panel", () => {
  beforeEach(async () => {
    await resetDatabaseForTests();
  });

  it("creates read-only snapshot history and compares live deck changes", async () => {
    const { rerender } = renderPanel(deck());

    await userEvent.click(screen.getByTestId("create-immutable-snapshot"));

    expect(await screen.findByText(/Immutable snapshot #1 created locally/i)).toBeInTheDocument();
    expect(await screen.findByTestId("snapshot-detail")).toHaveTextContent(/Read-Only Snapshot Detail/i);
    expect(screen.queryByRole("button", { name: /Edit Snapshot/i })).not.toBeInTheDocument();

    rerender(
      <MemoryRouter initialEntries={["/export"]}>
        <Routes>
          <Route
            path="/export"
            element={
              <ImmutableSnapshotsPanel
                deck={deck({
                  cards: [...deck().cards, card({ id: "card-opt", name: "Opt", oracleId: "oracle-opt", scryfallId: "scryfall-opt" })],
                })}
              />
            }
          />
        </Routes>
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByTestId("compare-current-deck"));
    expect(await screen.findByText(/Current deck has gameplay changes/i)).toBeInTheDocument();
  });

  it("uses honest Advanced Gameplay and Dry Run wording without launch claims", async () => {
    renderPanel(deck());
    await userEvent.selectOptions(screen.getByLabelText("Snapshot intent"), "advanced_gameplay");
    await userEvent.click(screen.getByTestId("create-immutable-snapshot"));
    await screen.findByTestId("snapshot-detail");

    await userEvent.click(screen.getByTestId("advanced-gameplay-envelope"));
    expect(await screen.findByText(/Advanced Gameplay export package prepared locally/i)).toBeInTheDocument();
    expect(screen.queryByText(/Advanced Gameplay launched/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByTestId("dry-run-envelope"));
    expect(await screen.findByText(/Dry Run export package prepared locally/i)).toBeInTheDocument();
    expect(screen.queryByText(/Dry Run started/i)).not.toBeInTheDocument();
  });

  it("archives and duplicates without exposing snapshot editing", async () => {
    renderPanel(deck());
    await userEvent.click(screen.getByTestId("create-immutable-snapshot"));
    await screen.findByTestId("snapshot-detail");

    await userEvent.click(screen.getByTestId("archive-snapshot"));
    expect(await screen.findByText(/Snapshot archived/i)).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("duplicate-snapshot"));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Deck Builder" })).toBeInTheDocument(),
    );
  });

  it("shows honest BoardState handoff status, manual instructions, and unconfirmed history", async () => {
    renderPanel(deck());
    await userEvent.click(screen.getByTestId("create-immutable-snapshot"));
    await screen.findByTestId("boardstate-handoff-panel");

    expect(screen.getByText(/No real BoardState web import URL is configured/i)).toBeInTheDocument();
    expect(screen.queryByText(/BoardState installed/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("manual-import-steps")).toHaveTextContent(/will not mark the package imported/i);

    await userEvent.click(screen.getByTestId("prepare-boardstate-handoff"));

    expect(await screen.findByText(/BoardState package prepared locally/i)).toBeInTheDocument();
    expect(await screen.findByTestId("handoff-history")).toHaveTextContent(/export completed/i);
    expect(screen.getByTestId("handoff-history")).toHaveTextContent(/Import unconfirmed/i);
    expect(screen.queryByText(/session created/i)).not.toBeInTheDocument();
  });
});
