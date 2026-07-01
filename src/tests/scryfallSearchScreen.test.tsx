import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsProvider } from "../app/SettingsContext";
import { resetDatabaseForTests } from "../db/database";
import { listOwnedCards } from "../db/repositories";
import { CardSearchScreen } from "../features/cards/CardSearchScreen";

function renderWithAppProviders(ui: ReactElement, route = "/search") {
  function RouteEcho() {
    const location = useLocation();
    return <span data-testid="route-echo">{location.pathname}{location.search}</span>;
  }

  return render(
    <SettingsProvider>
      <MemoryRouter initialEntries={[route]}>
        <RouteEcho />
        <Routes>
          <Route path="/search" element={ui} />
          <Route path="/card/:id" element={<div>Unexpected card route</div>} />
        </Routes>
      </MemoryRouter>
    </SettingsProvider>,
  );
}

function mockScryfallFetch() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes("/cards/autocomplete")) {
      return new Response(
        JSON.stringify({ object: "catalog", total_values: 2, data: ["Sol Ring", "Sol Grail"] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url.includes("/cards/named")) {
      return new Response(
        JSON.stringify({
          object: "card",
          id: "scryfall-sol-ring",
          oracle_id: "oracle-sol-ring",
          name: "Sol Ring",
          lang: "en",
          uri: "https://api.scryfall.com/cards/scryfall-sol-ring",
          layout: "normal",
          mana_cost: "{1}",
          cmc: 1,
          type_line: "Artifact",
          oracle_text: "{T}: Add {C}{C}.",
          color_identity: [],
          colors: [],
          keywords: [],
          legalities: { commander: "legal" },
          games: ["paper"],
          set: "cmm",
          set_name: "Commander Masters",
          collector_number: "400",
          rarity: "uncommon",
          image_uris: { small: "small.jpg", normal: "normal.jpg" },
          prices: { usd: "9.99" },
          purchase_uris: { tcgplayer: "https://example.invalid" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        object: "list",
        total_cards: 1,
        has_more: false,
        data: [],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  });
}

describe("Scryfall Search screen", () => {
  beforeEach(async () => {
    await resetDatabaseForTests();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("keeps search contained while selecting suggestions and registering owned cards", async () => {
    mockScryfallFetch();
    renderWithAppProviders(<CardSearchScreen />);
    const input = await screen.findByLabelText("Search Scryfall cards");

    await userEvent.type(input, "so");
    expect(input).toHaveFocus();
    expect(await screen.findByRole("option", { name: "Sol Ring" }, { timeout: 2500 })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("option", { name: "Sol Ring" }));
    await screen.findByRole("heading", { name: "Sol Ring" }, { timeout: 2500 });

    expect(screen.queryByText("Unexpected card route")).not.toBeInTheDocument();
    expect(screen.getByTestId("route-echo")).toHaveTextContent("/search");
    expect(input).toHaveFocus();
    expect(screen.queryByText(/USD|TCGplayer|purchase/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Register Owned" }));
    await waitFor(async () => {
      const owned = await listOwnedCards();
      expect(owned).toHaveLength(1);
      expect(owned[0].name).toBe("Sol Ring");
      expect(owned[0].imageUri).toBe("normal.jpg");
    });
    expect(screen.getByTestId("route-echo")).toHaveTextContent("/search");
  });
});
