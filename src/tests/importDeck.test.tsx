import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsProvider } from "../app/SettingsContext";
import { createZipArchive } from "../ecosystem/export/zip";
import { getDeck, listDecks, listOwnedCards, upsertOwnedCard } from "../db/repositories";
import { resetDatabaseForTests } from "../db/database";
import { ImportDeckScreen } from "../features/import/ImportDeckScreen";
import {
  extractUncompressedZipEntries,
  parseCsvDecklist,
  parseDecklistText,
  parseStructuredDeckImport,
  parseZipDeckImport,
} from "../features/import/importParser";
import {
  classifyImportOwnership,
  resolveImportEntry,
} from "../features/import/importResolution";

vi.mock("../services/scryfall", async () => {
  const makeCard = (name: string, overrides: Record<string, unknown> = {}) => ({
    id: `scryfall-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    oracleId: `oracle-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name,
    lang: "en",
    apiUri: `https://api.scryfall.com/cards/${encodeURIComponent(name)}`,
    layout: "normal",
    manaCost: name.includes("Anim Pakal") ? "{1}{R}{W}" : "{1}",
    manaValue: name.includes("Anim Pakal") ? 3 : 1,
    typeLine: name.includes("Anim Pakal") ? "Legendary Creature - Human Soldier" : "Artifact",
    oracleText: name.includes("Anim Pakal") ? "Whenever you attack with one or more non-Gnome creatures, create tapped Gnome tokens." : "{T}: Add mana.",
    colors: name.includes("Anim Pakal") ? ["R", "W"] : [],
    colorIdentity: name.includes("Anim Pakal") ? ["R", "W"] : [],
    keywords: [],
    legalities: { commander: "legal" },
    games: ["paper"],
    setCode: "cmm",
    setName: "Commander Masters",
    collectorNumber: "396",
    rarity: "uncommon",
    imageUris: { small: "small.jpg", normal: "normal.jpg" },
    cardFaces: [],
    prices: {
      source: "scryfall",
      sourceLabel: "Scryfall",
      currency: "USD",
      nonfoil: 2.5,
      foil: null,
      etched: null,
      market: 2.5,
      low: null,
      mid: 2.5,
      high: null,
      fetchedAt: new Date(0).toISOString(),
      staleAt: new Date(7 * 24 * 60 * 60 * 1000).toISOString(),
      status: "stale",
    },
    lastFetchedAt: new Date(0).toISOString(),
    ...overrides,
  });

  return {
    getNamedScryfallCard: vi.fn(async ({ exact, fuzzy }: { exact?: string; fuzzy?: string }) =>
      makeCard(exact ?? fuzzy ?? "Sol Ring"),
    ),
    resolveScryfallCardName: vi.fn(async (name: string) => ({
      card: makeCard(name === "Sole Ring" ? "Sol Ring" : name),
      fuzzy: name === "Sole Ring",
    })),
    searchScryfallCards: vi.fn(async () => ({
      cards: [makeCard("Sol Ring", { setCode: "cmm", collectorNumber: "396" })],
      query: "set:cmm cn:396",
      page: 1,
      hasMore: false,
      warnings: [],
      source: "live",
    })),
  };
});

function renderImportScreen() {
  return render(
    <SettingsProvider>
      <MemoryRouter initialEntries={["/import"]}>
        <Routes>
          <Route path="/import" element={<ImportDeckScreen />} />
          <Route path="/deck-builder/:deckId" element={<div>Deck builder opened</div>} />
        </Routes>
      </MemoryRouter>
    </SettingsProvider>,
  );
}

describe("deck import parsing and review", () => {
  beforeEach(async () => {
    await resetDatabaseForTests();
    vi.clearAllMocks();
  });

  it("parses common Commander and Arena decklist text with sections, quantities, and exact printings", () => {
    const parsed = parseDecklistText(
      "Commander\r\n1 Anim Pakal, Thousandth Moon\r\n\r\nDeck\r\n1x Sol Ring\r\n1 Sol Ring (CMM) 396\r\n4 Lightning Bolt\r\nMaybeboard\r\n1 Swords to Plowshares",
    );

    expect(parsed.format).toBe("mtg_arena");
    expect(parsed.entries.find((entry) => entry.name === "Anim Pakal, Thousandth Moon")?.section).toBe("commander");
    expect(parsed.entries.find((entry) => entry.collectorNumber === "396")?.setCode).toBe("cmm");
    expect(parsed.entries.find((entry) => entry.name === "Lightning Bolt")?.quantity).toBe(4);
    expect(parsed.entries.find((entry) => entry.name === "Swords to Plowshares")?.section).toBe("maybeboard");
  });

  it("parses CSV, Deck Nexus JSON, legacy deck JSON, backup JSON, and uncompressed ZIP packages", () => {
    const csv = parseCsvDecklist("quantity,name,set,collector number,section\n1,Sol Ring,CMM,396,Deck");
    expect(csv.entries[0]).toMatchObject({ name: "Sol Ring", quantity: 1, setCode: "cmm" });

    const snapshotJson = parseStructuredDeckImport(
      JSON.stringify({
        sourceApplication: "deck_nexus",
        deckSnapshot: {
          deckName: "Snapshot Import",
          mainDeck: [{ name: "Sol Ring", quantity: 1, section: "main" }],
          maybeboard: [{ name: "Arcane Signet", quantity: 1, section: "maybeboard" }],
        },
      }),
    );
    expect(snapshotJson.deckName).toBe("Snapshot Import");
    expect(snapshotJson.entries).toHaveLength(2);

    const legacy = parseStructuredDeckImport(
      JSON.stringify({
        name: "Legacy Export",
        cards: [{ name: "Command Tower", quantity: 1, section: "main" }],
        maybeboard: [{ name: "Counterspell", quantity: 1, section: "maybeboard" }],
      }),
    );
    expect(legacy.entries.map((entry) => entry.name)).toEqual(["Command Tower", "Counterspell"]);

    const backup = parseStructuredDeckImport(
      JSON.stringify({
        contents: {
          packageKind: "deck-nexus-full-backup",
          tables: {
            decks: [{ id: "deck-1", name: "Backup Deck" }],
            deckCards: [{ id: "card-1", deckId: "deck-1", name: "Sol Ring", quantity: 1, section: "main" }],
          },
        },
      }),
    );
    expect(backup.format).toBe("deck_nexus_backup");
    expect(backup.entries[0].name).toBe("Sol Ring");

    const zipBytes = createZipArchive([
      {
        path: "deck-snapshot.json",
        content: JSON.stringify({
          deckName: "ZIP Deck",
          mainDeck: [{ name: "Sol Ring", quantity: 1, section: "main" }],
        }),
      },
    ]);
    expect(Object.keys(extractUncompressedZipEntries(zipBytes))).toContain("deck-snapshot.json");
    expect(parseZipDeckImport(zipBytes).deckName).toBe("ZIP Deck");
  });

  it("rejects malformed structured imports and never treats unresolved cards as zero-value success", async () => {
    expect(parseStructuredDeckImport("{bad").errors[0]).toMatch(/JSON/i);

    const entry = parseDecklistText("1 Totally Unknown Custom Card").entries[0];
    const resolved = await resolveImportEntry(entry, []);
    expect(resolved.status).toBe("resolved");

    const unsafe = parseStructuredDeckImport('{"__proto__":{"polluted":true}}');
    expect(unsafe.errors[0]).toMatch(/unsafe keys/i);
  });

  it("classifies imported-card ownership without assuming import means owned", async () => {
    const entry = parseDecklistText("2 Sol Ring").entries[0];
    expect(classifyImportOwnership(entry, [])).toBe("not_owned");

    await upsertOwnedCard({ name: "Sol Ring", quantityOwned: 1, oracleId: "oracle-sol-ring" });
    const owned = await listOwnedCards();
    expect(classifyImportOwnership(entry, owned)).toBe("partially_owned");

    await upsertOwnedCard({ name: "Sol Ring", quantityOwned: 2, oracleId: "oracle-sol-ring", duplicateFlag: "multiple_owned" });
    expect(classifyImportOwnership(entry, await listOwnedCards())).toBe("multiple_owned");
  });

  it("requires review, commits only after confirmation, preserves unresolved imports, and opens a normal deck", async () => {
    renderImportScreen();
    expect(await screen.findByRole("heading", { name: "Import Deck" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Decklist source"), {
      target: {
        value: `Commander
1 Anim Pakal, Thousandth Moon

Deck
1 Sol Ring
1 Arcane Signet

Maybeboard
1 Swords to Plowshares`,
      },
    });
    await userEvent.click(screen.getByRole("button", { name: /Parse and Review/i }));
    await screen.findByTestId("import-review");
    await screen.findByText(/Import review is ready/i, {}, { timeout: 10_000 });

    expect(await listDecks()).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: /^Import Deck$/i }));

    await screen.findByText("Deck builder opened", {}, { timeout: 10_000 });
    const [deck] = await listDecks();
    expect(deck.createdFrom).toBe("deck_import");
    expect(deck.originalImportText).toContain("Commander");
    expect(deck.commanderNames).toContain("Anim Pakal, Thousandth Moon");
    expect([...deck.cards, ...deck.maybeboard]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Sol Ring" }),
        expect.objectContaining({ name: "Swords to Plowshares", section: "maybeboard" }),
      ]),
    );
    expect(await getDeck(deck.id)).toBeDefined();
  });
});
