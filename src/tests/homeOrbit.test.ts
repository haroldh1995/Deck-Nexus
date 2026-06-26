import { describe, expect, it } from "vitest";
import type { FavoriteItem } from "../types/domain";
import {
  buildHomeOrbitItems,
  moveHomeOrbitItem,
  permanentHomeOrbitItems,
  reorderHomeOrbitItems,
} from "../features/home/homeOrbit";

describe("home orbit architecture", () => {
  it("keeps the twelve permanent orbit cards available", () => {
    expect(permanentHomeOrbitItems.map((item) => item.label)).toEqual([
      "Create Deck",
      "Deck Library",
      "Card Search",
      "Scan Cards",
      "Owned Cards",
      "Import Deck",
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
    expect(items).toHaveLength(13);
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
    expect(items).toHaveLength(12);
  });

  it("moves and reorders orbit items without removing locked cards", () => {
    const items = buildHomeOrbitItems([], []);
    const moved = moveHomeOrbitItem(items, "deck-library", -1);

    expect(moved[0].id).toBe("deck-library");
    expect(moved).toHaveLength(12);

    const reordered = reorderHomeOrbitItems(
      moved,
      "settings",
      "create-deck",
    );

    expect(reordered[1].id).toBe("settings");
    expect(reordered.map((item) => item.id)).toContain("create-deck");
  });
});
