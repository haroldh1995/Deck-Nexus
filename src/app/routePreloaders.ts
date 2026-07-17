const routePreloaders: Record<string, () => Promise<unknown>> = {
  "/": () => import("../features/home/HomeScreen"),
  "/analyzer": () => import("../features/analyzer/AnalyzerScreen"),
  "/collections": () => import("../features/directories/CardDirectoriesScreen"),
  "/create": () => import("../features/decks/CreateDeckScreen"),
  "/deck-builder": () => import("../features/decks/DeckBuilderScreen"),
  "/export": () => import("../features/export/ExportScreen"),
  "/library": () => import("../features/decks/DeckLibraryScreen"),
  "/owned": () => import("../features/owned/OwnedCardsScreen"),
  "/scan": () => import("../features/scanner/ScanCardsScreen"),
  "/search": () => import("../features/cards/CardSearchScreen"),
  "/settings": () => import("../features/settings/SettingsScreen"),
  "/upgrade-lists": () => import("../features/directories/CardDirectoriesScreen"),
  "/wishlist": () => import("../features/directories/CardDirectoriesScreen"),
};

export function preloadAppRoute(path: string): void {
  if (import.meta.env.MODE === "test") {
    return;
  }

  const preload = routePreloaders[path];
  if (preload) {
    void preload();
  }
}
