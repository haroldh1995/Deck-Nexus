import type { HomePerformanceMode } from "../../../types/domain";
import type { HomeOrbitItem } from "../../../types/navigation";

export type HologramIntroMode = "full" | "return" | "reduced";

export interface HomeSceneSettings {
  reducedMotion: boolean;
  staticHomeScreen: boolean;
  glowIntensity: number;
  highContrast: boolean;
  textSize: "compact" | "normal" | "large";
  homePerformanceMode: HomePerformanceMode;
  deviceTiltParallax: boolean;
}

export interface HomeSceneDeckState {
  hasDecks: boolean;
  deckCount: number;
  mostRecentDeckName?: string;
}

export interface HomeHologramCard extends HomeOrbitItem {
  subtitle: string;
  actionLabel: string;
  visualGlyph: string;
}

export interface OrbitTransform {
  id: string;
  angle: number;
  normalizedAngle: number;
  x: number;
  y: number;
  z: number;
  scale: number;
  opacity: number;
  blur: number;
  saturation: number;
  glow: number;
  zIndex: number;
  rotationY: number;
  rotationX: number;
  frontness: number;
  rear: boolean;
}

export interface ResponsiveSceneScale {
  sceneScale: number;
  cardWidth: number;
  cardHeight: number;
  radiusX: number;
  radiusZ: number;
  centerY: number;
  upperRingScale: number;
  lowerRingScale: number;
  beamWidth: number;
}

export interface OrbitPhysicsState {
  rotation: number;
  focusedIndex: number;
  focusedId: string;
  dragging: boolean;
  settling: boolean;
  velocity: number;
}
