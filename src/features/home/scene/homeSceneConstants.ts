import type { HomePerformanceMode } from "../../../types/domain";

export const homeReferenceImage = "/assets/deck-nexus-home-reference.jpg";

export const homeIntroSessionKey = "deck-nexus-home-intro-played";

export const orbitSnapStrength = 0.12;

export const performanceModeParticleCounts: Record<HomePerformanceMode, number> =
  {
    full: 94,
    balanced: 58,
    performance: 24,
  };

export const homeSceneRouteOrder = [
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
];
