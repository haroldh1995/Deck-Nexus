import { defaultAppSettings } from "../../data/defaults";
import type { AppSettings } from "../../types/domain";
import { createProfileSnapshot, serializePrettyJson } from "../export";
import { createHubCompatibilityMetadata, createHubVersionMetadata } from "./metadata";
import type { HubProfileContract } from "./contracts";

export interface HubProfileComparison {
  matches: boolean;
  differences: string[];
  requiresReview: boolean;
}

export interface HubProfileMergeResult {
  profile: HubProfileContract;
  merged: false;
  requiresReview: boolean;
  reason: string;
}

export function loadLocalProfile(
  settings: AppSettings = defaultAppSettings,
  createdAt = settings.updatedAt,
): HubProfileContract {
  return {
    ...createHubVersionMetadata(createdAt),
    updatedAt: settings.updatedAt,
    profileId: "local-profile",
    preferredCommanderColors: [],
    favoriteCommanders: [],
    deckBuildingPreferences: {
      defaultExportFormat: settings.defaultExportFormat,
      defaultBracketLock: settings.defaultBracketLock,
      defaultOwnershipPreference: settings.defaultOwnershipPreference,
    },
    accessibilitySettings: {
      reducedMotion: settings.reducedMotion,
      highContrast: settings.highContrast,
      textSize: settings.textSize,
    },
    appearanceSettings: {
      staticHomeScreen: settings.staticHomeScreen,
      homePerformanceMode: settings.homePerformanceMode,
      deviceTiltParallax: settings.deviceTiltParallax,
      glowIntensity: settings.glowIntensity,
    },
    scannerPreferences: {
      scannerBatchPersistence: settings.scannerBatchPersistence,
      scannerConfirmationSound: settings.scannerConfirmationSound,
      scannerConfirmationVolume: settings.scannerConfirmationVolume,
      scannerHapticConfirmation: settings.scannerHapticConfirmation,
      scannerDefaultMode: settings.scannerDefaultMode,
      scannerPreferredDestination: settings.scannerPreferredDestination,
      scannerPreviewQuality: settings.scannerPreviewQuality,
      scannerPerformanceMode: settings.scannerPerformanceMode,
    },
    backupPreferences: {
      localFirstMode: true,
      scryfallBulkDownloadWifiOnly: settings.scryfallBulkDownloadWifiOnly,
      scryfallOfflineDatabaseDownloaded: settings.scryfallOfflineDatabaseDownloaded,
    },
    localIdentifiers: {
      settingsId: settings.id,
    },
    hubIdentity: null,
    authentication: null,
    friends: [],
    notifications: [],
    compatibility: createHubCompatibilityMetadata(),
  };
}

export function prepareHubProfile(profile: HubProfileContract): HubProfileContract {
  return {
    ...profile,
    hubIdentity: null,
    authentication: null,
    friends: [],
    notifications: [],
    compatibility: createHubCompatibilityMetadata(),
  };
}

export function compareProfiles(
  localProfile: HubProfileContract,
  incomingProfile?: HubProfileContract,
): HubProfileComparison {
  if (!incomingProfile) {
    return {
      matches: false,
      differences: ["No Hub profile is available to compare."],
      requiresReview: false,
    };
  }

  const differences = [
    localProfile.profileId !== incomingProfile.profileId ? "profileId" : "",
    localProfile.updatedAt !== incomingProfile.updatedAt ? "updatedAt" : "",
    JSON.stringify(localProfile.accessibilitySettings) !==
    JSON.stringify(incomingProfile.accessibilitySettings)
      ? "accessibilitySettings"
      : "",
    JSON.stringify(localProfile.scannerPreferences) !==
    JSON.stringify(incomingProfile.scannerPreferences)
      ? "scannerPreferences"
      : "",
  ].filter(Boolean);

  return {
    matches: differences.length === 0,
    differences,
    requiresReview: differences.length > 0,
  };
}

export function exportProfile(
  settings: AppSettings = defaultAppSettings,
): { hubProfile: HubProfileContract; profileSnapshotJson: string } {
  const hubProfile = loadLocalProfile(settings);
  return {
    hubProfile,
    profileSnapshotJson: serializePrettyJson(createProfileSnapshot(settings)),
  };
}

export function importProfile(value: unknown): HubProfileContract {
  const record = value as Partial<HubProfileContract>;
  if (!record || typeof record !== "object") {
    throw new Error("Profile import payload is unreadable.");
  }
  if (record.sourceApplication !== "deck_nexus" || record.profileId !== "local-profile") {
    throw new Error("Only Deck Nexus local profile payloads are supported.");
  }
  if (record.hubIdentity !== null || record.authentication !== null) {
    throw new Error("Hub identity and authentication are not accepted in Deck Nexus local profile imports.");
  }
  return record as HubProfileContract;
}

export function mergeProfiles(
  localProfile: HubProfileContract,
  incomingProfile?: HubProfileContract,
): HubProfileMergeResult {
  return {
    profile: localProfile,
    merged: false,
    requiresReview: Boolean(incomingProfile),
    reason:
      "Deck Nexus does not merge Hub profiles automatically. Local profile data remains authoritative until Hub exists.",
  };
}

export function getProfileAdapterStatus(): string {
  return "Local profile only. Hub profile is unavailable.";
}
