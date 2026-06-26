import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  settings = baseSettings,
}: {
  favorites?: FavoriteItem[];
  settings?: HomeSceneSettings;
} = {}) {
  const cards = buildHomeHologramCards(buildHomeOrbitItems(favorites, []));
  const movedCards: Array<{ id: string; direction: -1 | 1 }> = [];

  render(
    <MemoryRouter initialEntries={["/"]}>
      <HomeHologramScene
        cards={cards}
        deckState={{
          deckCount: 0,
          hasDecks: false,
        }}
        onMoveCard={(id, direction) => movedCards.push({ direction, id })}
        settings={settings}
      />
      <LocationProbe />
    </MemoryRouter>,
  );

  return { movedCards };
}

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
    renderScene();

    await user.click(screen.getByTestId("orbit-card-create-deck"));

    expect(screen.getByTestId("location")).toHaveTextContent("/create");
  });

  it("changes focus with keyboard arrows and opens with Enter", async () => {
    renderScene();
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

  it("shows every command in static home fallback navigation", async () => {
    const user = userEvent.setup();
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
      expect(screen.getByTestId(`fallback-card-${item.id}`)).toBeVisible();
    }

    await user.click(screen.getByTestId("fallback-card-deck-library"));
    expect(screen.getByTestId("location")).toHaveTextContent("/library");
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
    expect(screen.getByTestId("fallback-card-favorite:favorite-deck"))
      .toHaveAccessibleName(/Favorite Deck/);
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
