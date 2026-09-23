import type { FavoriteItemType } from "./domain";

export type AppRouteId =
  | "home"
  | "create-deck"
  | "deck-library"
  | "card-search"
  | "owned-cards"
  | "import-center"
  | "analyzer"
  | "deck-groups"
  | "tags"
  | "test-deck"
  | "export"
  | "settings"
  | "deck-builder";

export type AppIconName =
  | "home"
  | "sparkles"
  | "library"
  | "search"
  | "archive"
  | "import"
  | "analyzer"
  | "groups"
  | "tags"
  | "test"
  | "export"
  | "settings"
  | "builder"
  | "favorite";

export interface AppRouteDefinition {
  id: AppRouteId;
  path: string;
  label: string;
  shortLabel: string;
  icon: AppIconName;
  homeOrbit: boolean;
}

export interface HomeOrbitItem {
  id: string;
  label: string;
  shortLabel: string;
  route: string;
  icon: AppIconName;
  kind: "permanent" | FavoriteItemType;
  subtitle?: string;
}
