import { describe, expect, it } from "vitest";
import { homeSceneRouteOrder } from "../features/home/scene/homeSceneConstants";
import {
  calculateOrbitTransforms,
  calculateResponsiveSceneScale,
  getDepthSortedOrbitTransforms,
  getNearestOrbitIndex,
  getRotationForIndex,
  normalizeAngle,
  shortestAngleDistance,
} from "../features/home/scene/orbitMath";
import {
  buildHomeHologramCards,
  favoriteToOrbitPreview,
  getHomeStatusCopy,
} from "../features/home/scene/homeSceneContent";
import { getHomeIntroMode } from "../features/home/scene/useHomeIntro";
import { permanentHomeOrbitItems } from "../features/home/homeOrbit";
import type { FavoriteItem } from "../types/domain";

describe("home hologram scene math", () => {
  it("normalizes rotation and snaps to a valid nearest card index", () => {
    expect(normalizeAngle(-30)).toBe(330);
    expect(shortestAngleDistance(350, 10)).toBe(20);
    expect(getNearestOrbitIndex(360, 12)).toBe(0);
    expect(getNearestOrbitIndex(getRotationForIndex(3, 12), 12)).toBe(3);
  });

  it("calculates card transforms with front, side, and rear depth states", () => {
    const cards = buildHomeHologramCards(permanentHomeOrbitItems);
    const scale = calculateResponsiveSceneScale({ width: 390, height: 844 });
    const transforms = calculateOrbitTransforms({
      cards,
      rotation: 0,
      scale,
    });

    expect(transforms).toHaveLength(12);
    expect(transforms[0].frontness).toBeCloseTo(1);
    expect(transforms[6].rear).toBe(true);
    expect(transforms[3].rotationY).toBeLessThan(0);
    expect(transforms[9].rotationY).toBeGreaterThan(0);
  });

  it("sorts depth from rear to foreground for dynamic z ordering", () => {
    const cards = buildHomeHologramCards(permanentHomeOrbitItems);
    const scale = calculateResponsiveSceneScale({ width: 430, height: 932 });
    const sorted = getDepthSortedOrbitTransforms(
      calculateOrbitTransforms({ cards, rotation: 0, scale }),
    );

    expect(sorted[0].frontness).toBeLessThan(sorted.at(-1)?.frontness ?? 0);
  });

  it("keeps responsive scene scale inside mobile and desktop bounds", () => {
    const smallPhone = calculateResponsiveSceneScale({
      width: 320,
      height: 568,
    });
    const desktop = calculateResponsiveSceneScale({
      width: 1280,
      height: 900,
    });

    expect(smallPhone.cardWidth).toBeGreaterThanOrEqual(96);
    expect(desktop.radiusX).toBeLessThanOrEqual(410);
    expect(desktop.cardHeight).toBeGreaterThan(desktop.cardWidth);
  });

  it("keeps permanent route order and favorite preview data stable", () => {
    expect(homeSceneRouteOrder).toEqual([
      "create-deck",
      "deck-library",
      "card-search",
      "scan-cards",
      "owned-cards",
      "import-deck",
      "analyzer",
      "deck-groups",
      "tags",
      "test-deck",
      "export",
      "settings",
    ]);

    const favorite: FavoriteItem = {
      id: "fav",
      type: "deck",
      targetId: "deck-one",
      title: "Favorite Deck",
      route: "/deck-builder/deck-one",
      order: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    expect(favoriteToOrbitPreview(favorite)).toEqual({
      id: "favorite:fav",
      label: "Favorite Deck",
      route: "/deck-builder/deck-one",
    });
  });

  it("derives empty, active, and intro session states", () => {
    expect(
      getHomeStatusCopy({
        deckCount: 0,
        hasDecks: false,
      }).title,
    ).toBe("No decks summoned");

    expect(
      getHomeStatusCopy({
        deckCount: 2,
        hasDecks: true,
        mostRecentDeckName: "Starlit Command",
      }).status,
    ).toContain("Starlit Command");

    expect(
      getHomeIntroMode({ reducedMotion: false, sessionPlayed: false }),
    ).toBe("full");
    expect(
      getHomeIntroMode({ reducedMotion: false, sessionPlayed: true }),
    ).toBe("return");
    expect(
      getHomeIntroMode({ reducedMotion: true, sessionPlayed: false }),
    ).toBe("reduced");
  });
});
