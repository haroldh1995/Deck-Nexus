import type { AppSettings, CommanderColor } from "../../types/domain";
import type { EcosystemAppId } from "../contracts/ecosystemContracts";
import {
  CURRENT_COMPATIBILITY_VERSION,
  CURRENT_EXPORT_VERSION,
  CURRENT_SCHEMA_VERSION,
} from "../export";

export const HUB_CONTRACT_VERSION = "deck-nexus.hub-adapter.v1";
export const HUB_MIGRATION_VERSION = "deck-nexus.hub-migration.v1";

export type HubSurfaceId =
  | "deck_nexus"
  | "boardstate"
  | "hub"
  | "profile"
  | "friends"
  | "notifications"
  | "backup"
  | "app_links";

export type HubCapabilityId =
  | "profile"
  | "friends"
  | "notifications"
  | "boardstate"
  | "advanced_gameplay"
  | "dry_run"
  | "backup"
  | "scanner"
  | "export"
  | "import"
  | "cloud_sync"
  | "app_launch"
  | "return_callbacks"
  | "deck_building"
  | "collection";

export type CapabilityOwner = "deck_nexus" | "boardstate" | "hub";

export interface HubVersionMetadata {
  contractVersion: typeof HUB_CONTRACT_VERSION;
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  exportVersion: typeof CURRENT_EXPORT_VERSION;
  compatibilityVersion: typeof CURRENT_COMPATIBILITY_VERSION;
  migrationVersion: typeof HUB_MIGRATION_VERSION;
  sourceApplication: "deck_nexus";
  sourceApplicationVersion: string;
  createdAt: string;
  updatedAt: string;
}

export interface HubMigrationMetadata {
  migrationRequired: boolean;
  migrationStatus: "current" | "future_required" | "unsupported" | "unknown";
  sourceVersion?: string;
  targetVersion: typeof HUB_CONTRACT_VERSION;
  notes: string[];
}

export interface HubCompatibilityMetadata {
  hubAvailable: false;
  hubIdentityLinked: false;
  friendsLinked: false;
  notificationsLinked: false;
  centralBackupLinked: false;
  appRoutingLinked: false;
  migration: HubMigrationMetadata;
}

export interface HubCapabilityContract extends HubVersionMetadata {
  capabilityId: HubCapabilityId;
  label: string;
  supported: boolean;
  configured: boolean;
  verified: boolean;
  available: boolean;
  localOnly: boolean;
  planned: boolean;
  disabled: boolean;
  error?: string;
  currentOwner: CapabilityOwner;
  futureOwner: CapabilityOwner;
  status: "active" | "local_only" | "planned" | "unavailable" | "requires_setup";
  summary: string;
}

export interface HubProfileContract extends HubVersionMetadata {
  profileId: "local-profile";
  displayName?: string;
  avatar?: string;
  preferredCommanderColors: CommanderColor[];
  favoriteCommanders: string[];
  deckBuildingPreferences: Pick<
    AppSettings,
    "defaultExportFormat" | "defaultBracketLock" | "defaultOwnershipPreference"
  >;
  accessibilitySettings: Pick<AppSettings, "reducedMotion" | "highContrast" | "textSize">;
  appearanceSettings: Pick<
    AppSettings,
    | "staticHomeScreen"
    | "homePerformanceMode"
    | "deviceTiltParallax"
    | "glowIntensity"
  >;
  scannerPreferences: Pick<
    AppSettings,
    | "scannerBatchPersistence"
    | "scannerConfirmationSound"
    | "scannerConfirmationVolume"
    | "scannerHapticConfirmation"
    | "scannerDefaultMode"
    | "scannerPreferredDestination"
    | "scannerPreviewQuality"
    | "scannerPerformanceMode"
  >;
  backupPreferences: Pick<
    AppSettings,
    | "localFirstMode"
    | "scryfallBulkDownloadWifiOnly"
    | "scryfallOfflineDatabaseDownloaded"
  >;
  localIdentifiers: {
    settingsId: AppSettings["id"];
  };
  hubIdentity: null;
  authentication: null;
  friends: [];
  notifications: [];
  compatibility: HubCompatibilityMetadata;
}

export type FriendStatus = "unavailable" | "not_connected" | "local_only";

export interface HubFriendContract extends HubVersionMetadata {
  status: FriendStatus;
  friendRequests: [];
  friends: [];
  blocked: [];
  favorites: [];
  onlineStatuses: [];
  sharedDeckPermissions: [];
  reason: string;
  compatibility: HubCompatibilityMetadata;
}

export interface HubNotificationContract extends HubVersionMetadata {
  status: "unavailable" | "local_only";
  remoteNotificationsAvailable: false;
  localInAppStatusOnly: boolean;
  notifications: [];
  possibleFutureTypes: string[];
  reason: string;
  compatibility: HubCompatibilityMetadata;
}

export type HubBackupProviderId =
  | "local_file"
  | "json"
  | "zip"
  | "google_drive"
  | "icloud"
  | "dropbox"
  | "onedrive"
  | "github";

export interface HubBackupProviderStatus {
  providerId: HubBackupProviderId;
  label: string;
  configured: boolean;
  verified: boolean;
  available: boolean;
  localOnly: boolean;
  status: "active" | "requires_setup" | "not_connected" | "unavailable";
  reason: string;
}

export interface HubBackupContract extends HubVersionMetadata {
  providers: HubBackupProviderStatus[];
  centralBackupAvailable: false;
  activeLocalProviders: HubBackupProviderId[];
  compatibility: HubCompatibilityMetadata;
}

export interface HubAppLinkContract extends HubVersionMetadata {
  appId: EcosystemAppId;
  label: string;
  launchAvailable: boolean;
  returnAvailable: boolean;
  configured: boolean;
  verified: boolean;
  status: "available" | "local_only" | "planned" | "unavailable" | "requires_setup";
  reason: string;
}

export interface HubStatusSection {
  id: HubSurfaceId;
  label: string;
  status: string;
  capability: string;
  availability: string;
  verification: string;
  currentOwner: string;
  futureOwner: string;
}
