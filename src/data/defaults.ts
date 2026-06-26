import type { AppSettings, BracketLock } from "../types/domain";

export const defaultBracketLock: BracketLock = {
  enabled: false,
  bracket: "bracket_3",
  allowCombos: true,
  allowTutors: true,
  allowFastMana: false,
  allowStax: false,
  allowMassLandDestruction: false,
  allowExtraTurns: true,
};

export const defaultAppSettings: AppSettings = {
  id: "app",
  reducedMotion: false,
  staticHomeScreen: false,
  homePerformanceMode: "balanced",
  deviceTiltParallax: false,
  glowIntensity: 1,
  highContrast: false,
  textSize: "normal",
  localFirstMode: true,
  defaultExportFormat: "plain_text",
  defaultBracketLock,
  defaultOwnershipPreference: "owned_first",
  scannerBatchPersistence: true,
  homeOrbitOrder: [],
  homeOrbitHiddenIds: [],
  updatedAt: new Date(0).toISOString(),
};
