const routePreloaders: Record<string, () => Promise<unknown>> = {
  "/": () => import("../features/home/HomeScreen"),
  "/analyzer": () => import("../features/analyzer/AnalyzerScreen"),
  "/collections": () => import("../features/directories/CardDirectoriesScreen"),
  "/create": () => import("../features/decks/CreateDeckScreen"),
  "/deck-builder": () => import("../features/decks/DeckBuilderScreen"),
  "/export": () => import("../features/export/ExportScreen"),
  "/import": () => import("../features/import/ImportDeckScreen"),
  "/library": () => import("../features/decks/DeckLibraryScreen"),
  "/owned": () => import("../features/owned/OwnedCardsScreen"),
  "/scan": () => import("../features/scanner/ScanCardsScreen"),
  "/search": () => import("../features/cards/CardSearchScreen"),
  "/settings": () => import("../features/settings/SettingsScreen"),
  "/upgrade-lists": () => import("../features/directories/CardDirectoriesScreen"),
  "/wishlist": () => import("../features/directories/CardDirectoriesScreen"),
};

const routePreloadPromises = new Map<string, Promise<unknown>>();

export function preloadAppRoute(path: string): Promise<unknown> | undefined {
  if (import.meta.env.MODE === "test") {
    return undefined;
  }

  const preload = routePreloaders[path];
  if (!preload) {
    return undefined;
  }

  const existing = routePreloadPromises.get(path);
  if (existing) {
    return existing;
  }

  const promise = preload().catch((error: unknown) => {
    routePreloadPromises.delete(path);
    throw error;
  });
  routePreloadPromises.set(path, promise);
  return promise;
}
