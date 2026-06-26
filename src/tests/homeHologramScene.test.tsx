import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildHomeOrbitItems, permanentHomeOrbitItems } from "../features/home/homeOrbit";
import { HomeHologramScene } from "../features/home/scene/HomeHologramScene";
import { buildHomeHologramCards } from "../features/home/scene/homeSceneContent";
import type { HomeSceneSettings } from "../features/home/scene/homeSceneTypes";
import type { FavoriteItem } from "../types/domain";

const baseSettings: HomeSceneSettings = {
  deviceTiltParallax: false,
  glowIntensity: 1,
  highContrast: false,
  homePerformanceMode: "balanced",
  reducedMotion: false,
  staticHomeScreen: false,
  textSize: "normal",
};

function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  );
}

function renderScene({
  favorites = [],
  hiddenItemIds = [],
  settings = baseSettings,
}: {
  favorites?: FavoriteItem[];
  hiddenItemIds?: string[];
  settings?: HomeSceneSettings;
} = {}) {
  const menuItems = buildHomeOrbitItems(favorites, []);
  const cards = buildHomeHologramCards(
    buildHomeOrbitItems(favorites, [], hiddenItemIds),
  );
  const movedCards: Array<{ id: string; direction: -1 | 1 }> = [];
  const saveMenuOrder =
    vi.fn<
      (nextOrderIds: string[], nextHiddenIds: string[]) => Promise<void>
    >(async () => {});

  render(
    <MemoryRouter initialEntries={["/"]}>
      <HomeHologramScene
        cards={cards}
        deckState={{
          deckCount: 0,
          hasDecks: false,
        }}
        hiddenItemIds={hiddenItemIds}
        menuItems={menuItems}
        onMoveCard={(id, direction) => movedCards.push({ direction, id })}
        onSaveMenuOrder={saveMenuOrder}
        settings={settings}
      />
      <LocationProbe />
    </MemoryRouter>,
  );

  return { movedCards, saveMenuOrder };
}

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("HomeHologramScene", () => {
  it("renders all permanent command cards with accessible labels", () => {
    renderScene();

    for (const item of permanentHomeOrbitItems) {
      expect(screen.getByTestId(`orbit-card-${item.id}`)).toHaveAccessibleName(
        new RegExp(item.label),
      );
    }

    expect(
      screen.getByRole("heading", { name: "No decks summoned" }),
    ).toBeVisible();
    expect(screen.getByText("Create or import your first Commander deck"))
      .toBeVisible();
  });

  it("opens the focused command card route", async () => {
    const user = userEvent.setup();
    renderScene({
      settings: {
        ...baseSettings,
        reducedMotion: true,
      },
    });

    await user.click(screen.getByTestId("orbit-card-create-deck"));

    expect(screen.getByTestId("location")).toHaveTextContent("/create");
  });

  it("changes focus with keyboard arrows and opens with Enter", async () => {
    renderScene({
      settings: {
        ...baseSettings,
        reducedMotion: true,
      },
    });
    const scene = screen.getByTestId("home-hologram-scene");

    scene.focus();
    fireEvent.keyDown(scene, { key: "ArrowRight" });

    await waitFor(() =>
      expect(screen.getByTestId("orbit-card-deck-library")).toHaveAttribute(
        "aria-current",
        "true",
      ),
    );

    fireEvent.keyDown(scene, { key: "Enter" });
    expect(screen.getByTestId("location")).toHaveTextContent("/library");
  });

  it("keeps every command in the static holographic orbit without rendering the removed dashboard", () => {
    renderScene({
      settings: {
        ...baseSettings,
        staticHomeScreen: true,
      },
    });

    expect(screen.getByTestId("home-hologram-scene")).toHaveClass(
      "nexus-orbit--static",
    );

    for (const item of permanentHomeOrbitItems) {
      expect(screen.getByTestId(`orbit-card-${item.id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`screen-reader-card-${item.id}`))
        .toHaveAttribute("href", item.route);
    }

    expect(screen.queryByText(/Orbit order/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("fallback-card-create-deck"))
      .not.toBeInTheDocument();
  });

  it("marks reduced motion and disables the moving orbit presentation", () => {
    renderScene({
      settings: {
        ...baseSettings,
        reducedMotion: true,
      },
    });

    const scene = screen.getByTestId("home-hologram-scene");
    expect(scene).toHaveAttribute("data-reduced-motion", "true");
    expect(scene).toHaveClass("home-hologram-scene--reduced");
    expect(scene).toHaveClass("nexus-orbit--static");
  });

  it("includes dynamic favorite cards in the same command system", () => {
    const favorite: FavoriteItem = {
      id: "favorite-deck",
      type: "deck",
      targetId: "deck-one",
      title: "Favorite Deck",
      subtitle: "Atraxa local favorite",
      route: "/deck-builder/deck-one",
      order: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    renderScene({ favorites: [favorite] });

    expect(screen.getByTestId("orbit-card-favorite:favorite-deck"))
      .toHaveAccessibleName(/Favorite Deck/);
    expect(screen.getByTestId("screen-reader-card-favorite:favorite-deck"))
      .toHaveAccessibleName(/Favorite Deck/);
  });

  it("renders one unlabeled gear that opens and closes Home menu customization", async () => {
    const user = userEvent.setup();
    renderScene();

    const gear = screen.getByRole("button", { name: "Customize Home menu" });
    expect(gear).toBeVisible();
    expect(gear).not.toHaveTextContent(/Customize|Settings|Orbit Order/i);

    await user.click(gear);
    expect(
      screen.getByRole("dialog", { name: "Customize Home Menu" }),
    ).toBeVisible();

    await user.click(
      screen.getByRole("button", {
        name: "Close Home menu customization",
      }),
    );

    await waitFor(() => expect(gear).toHaveFocus());
  });

  it("saves reordered Home menu items from the customization overlay", async () => {
    const user = userEvent.setup();
    const { saveMenuOrder } = renderScene();

    await user.click(
      screen.getByRole("button", { name: "Customize Home menu" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Move Deck Library earlier" }),
    );
    await user.click(screen.getByRole("button", { name: "Save Order" }));

    await waitFor(() => expect(saveMenuOrder).toHaveBeenCalledTimes(1));
    expect(saveMenuOrder.mock.calls[0][0].slice(0, 2)).toEqual([
      "deck-library",
      "create-deck",
    ]);
    expect(saveMenuOrder.mock.calls[0][1]).toEqual([]);
  });

  it("cancels Home menu customization without saving", async () => {
    const user = userEvent.setup();
    const { saveMenuOrder } = renderScene();

    await user.click(
      screen.getByRole("button", { name: "Customize Home menu" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Move Deck Library earlier" }),
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(saveMenuOrder).not.toHaveBeenCalled();
  });

  it("keeps permanent cards required and lets dynamic favorite cards hide from Home", async () => {
    const user = userEvent.setup();
    const favorite: FavoriteItem = {
      id: "favorite-deck",
      type: "deck",
      targetId: "deck-one",
      title: "Favorite Deck",
      subtitle: "Atraxa local favorite",
      route: "/deck-builder/deck-one",
      order: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const { saveMenuOrder } = renderScene({ favorites: [favorite] });

    await user.click(
      screen.getByRole("button", { name: "Customize Home menu" }),
    );
    expect(
      screen.getByRole("button", { name: "Create Deck is required" }),
    ).toBeDisabled();

    while (
      !screen.queryByRole("button", {
        name: "Hide Favorite Deck from Home",
      })
    ) {
      await user.click(screen.getByRole("button", { name: "Next" }));
    }

    await user.click(
      screen.getByRole("button", { name: "Hide Favorite Deck from Home" }),
    );
    await user.click(screen.getByRole("button", { name: "Save Order" }));

    await waitFor(() => expect(saveMenuOrder).toHaveBeenCalledTimes(1));
    expect(saveMenuOrder.mock.calls[0][1]).toContain(
      "favorite:favorite-deck",
    );
  });

  it("does not open long-press actions after drag intent is detected", () => {
    vi.useFakeTimers();
    renderScene();

    const card = screen.getByTestId("orbit-card-create-deck");
    fireEvent.pointerDown(card, {
      clientX: 120,
      clientY: 220,
      pointerId: 1,
    });
    fireEvent.pointerMove(card, {
      clientX: 170,
      clientY: 224,
      pointerId: 1,
    });

    act(() => {
      vi.advanceTimersByTime(620);
    });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
