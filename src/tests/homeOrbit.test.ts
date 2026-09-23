import { describe, expect, it } from "vitest";
import type { FavoriteItem } from "../types/domain";
import {
  buildHomeOrbitItems,
  moveHomeOrbitItem,
  permanentHomeOrbitItems,
  reorderHomeOrbitItems,
} from "../features/home/homeOrbit";
import { buildHomeHologramCards } from "../features/home/scene/homeSceneContent";
import {
  calculateOrbitTransforms,
  calculateOrbitTransformsInto,
} from "../features/home/scene/orbitMath";
import type { ResponsiveSceneScale } from "../features/home/scene/homeSceneTypes";

describe("home orbit architecture", () => {
  it("keeps the permanent orbit cards available", () => {
    expect(permanentHomeOrbitItems.map((item) => item.label)).toEqual([
      "Create Deck",
      "Deck Library",
      "Card Search",
      "Owned Cards",
      "Import Center",
      "Analyzer",
      "Deck Groups",
      "Tags",
      "Test Deck",
      "Export",
      "Settings",
    ]);
  });

  it("merges future favorite orbit cards into the same data flow", () => {
    const favorite: FavoriteItem = {
      id: "fav-one",
      type: "commander",
      targetId: "oracle-one",
      title: "Favorite Commander",
      route: "/search?commander=oracle-one",
      order: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const items = buildHomeOrbitItems([favorite], ["favorite:fav-one"]);

    expect(items[0]).toMatchObject({
      id: "favorite:fav-one",
      label: "Favorite Commander",
      kind: "commander",
    });
    expect(items).toHaveLength(12);
  });

  it("hides dynamic favorite cards without removing permanent destinations", () => {
    const favorite: FavoriteItem = {
      id: "fav-one",
      type: "saved_search",
      targetId: "search-one",
      title: "Hidden Favorite",
      route: "/search?saved=search-one",
      order: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const items = buildHomeOrbitItems(
      [favorite],
      ["favorite:fav-one", "create-deck"],
      ["favorite:fav-one", "create-deck"],
    );

    expect(items.map((item) => item.id)).not.toContain("favorite:fav-one");
    expect(items.map((item) => item.id)).toContain("create-deck");
    expect(items).toHaveLength(11);
  });

  it("moves and reorders orbit items without removing locked cards", () => {
    const items = buildHomeOrbitItems([], []);
    const moved = moveHomeOrbitItem(items, "deck-library", -1);

    expect(moved[0].id).toBe("deck-library");
    expect(moved).toHaveLength(11);

    const reordered = reorderHomeOrbitItems(
      moved,
      "settings",
      "create-deck",
    );

    expect(reordered[1].id).toBe("settings");
    expect(reordered.map((item) => item.id)).toContain("create-deck");
  });

  it("reuses unchanged Home card identities across equivalent rebuild requests", () => {
    const firstItems = buildHomeOrbitItems([], []);
    const secondItems = buildHomeOrbitItems([], []);
    const firstCards = buildHomeHologramCards(firstItems);
    const secondCards = buildHomeHologramCards([...secondItems]);

    expect(secondItems).toBe(firstItems);
    expect(secondCards).toBe(firstCards);
    expect(secondCards[0]).toBe(firstCards[0]);
  });

  it("reuses the transform buffer without changing calculated positions", () => {
    const cards = buildHomeHologramCards(permanentHomeOrbitItems);
    const scale: ResponsiveSceneScale = {
      sceneScale: 1,
      cardWidth: 148,
      cardHeight: 208,
      radiusX: 280,
      radiusZ: 190,
      centerY: 360,
      upperRingScale: 1,
      lowerRingScale: 1,
      beamWidth: 60,
    };
    const buffer = calculateOrbitTransformsInto({
      cards,
      rotation: 14,
      scale,
      transforms: [],
    });
    const firstTransform = buffer[0];

    calculateOrbitTransformsInto({
      cards,
      rotation: 27,
      scale,
      transforms: buffer,
    });

    expect(buffer[0]).toBe(firstTransform);
    expect(buffer).toEqual(calculateOrbitTransforms({
      cards,
      rotation: 27,
      scale,
    }));
  });
});
