import type {
  AppSettings,
  Bracket,
  BracketLock,
  CommanderColor,
  Deck,
  DeckAnalysis,
  DeckCardSection,
  DeckGoal,
  DeckRecommendation,
  DeckStyle,
  DeckstateCardImageUris,
  FavoriteItem,
  OwnedCard,
  OwnedDuplicateFlag,
  ScanBatch,
  ScanRecord,
  SmartBuildResult,
} from "../../types/domain";
import type { EcosystemAppId } from "../contracts/ecosystemContracts";

export const DECK_NEXUS_APPLICATION_NAME = "Deck Nexus";
export const DECK_NEXUS_APPLICATION_ID = "deck_nexus" satisfies EcosystemAppId;
export const DECK_NEXUS_APPLICATION_VERSION = "1.0.0";
export const CURRENT_SCHEMA_VERSION = "deck-nexus.snapshot.schema.v1";
export const CURRENT_SNAPSHOT_VERSION = "deck-nexus.snapshot.v1";
export const CURRENT_EXPORT_VERSION = "deck-nexus.export.v1";
export const CURRENT_COMPATIBILITY_VERSION = "boardstate-ecosystem.v1";

export type EcosystemExportFormat =
  | "primary_json"
  | "pretty_json"
  | "compressed_json"
  | "zip_package"
  | "arena";

export type SnapshotKind =
  | "deck"
  | "collection"
  | "profile"
  | "backup"
  | "package";

export interface SchemaVersionMetadata {
  schemaVersion: string;
  snapshotVersion: string;
  exportVersion: string;
  compatibilityVersion: string;
}

export interface MigrationMetadata {
  migrationRequired: boolean;
  migrationStatus: "current" | "older_supported" | "future_unsupported" | "unknown";
  sourceSchemaVersion?: string;
  targetSchemaVersion: string;
  notes: string[];
}

export interface CompatibilityFlags {
  boardState: {
    compatible: boolean;
    bridgeRequired: true;
    gameplayStateIncluded: false;
    validationIncluded: false;
  };
  hub: {
    compatible: boolean;
    adapterRequired: true;
    identityIncluded: false;
    friendsIncluded: false;
    notificationsIncluded: false;
  };
}

export interface ExportCapabilities {
  primaryJson: boolean;
  prettyJson: boolean;
  compressedJson: boolean;
  zipPackage: boolean;
  arenaText: boolean;
  immutableGameplaySnapshot: false;
  boardStateBridge: false;
  hubNetworking: false;
}

export interface ApplicationMetadata extends SchemaVersionMetadata {
  applicationName: typeof DECK_NEXUS_APPLICATION_NAME;
  applicationVersion: string;
  sourceApplication: typeof DECK_NEXUS_APPLICATION_ID;
  currentProducer: typeof DECK_NEXUS_APPLICATION_ID;
  supportedConsumerApplications: EcosystemAppId[];
  createdAt: string;
  updatedAt: string;
  checksum: string | null;
  digitalSignature: null;
  capabilities: ExportCapabilities;
  compatibilityFlags: CompatibilityFlags;
}

export interface ExportMetadata extends SchemaVersionMetadata {
  exportId: string;
  exportFormat: EcosystemExportFormat;
  sourceApplication: typeof DECK_NEXUS_APPLICATION_ID;
  applicationVersion: string;
  createdAt: string;
  updatedAt: string;
  checksum: string | null;
  migration: MigrationMetadata;
}

export interface BackupMetadata extends SchemaVersionMetadata {
  backupId: string;
  name: string;
  sourceApplication: typeof DECK_NEXUS_APPLICATION_ID;
  applicationVersion: string;
  createdAt: string;
  updatedAt: string;
  deckCount: number;
  ownedCardCount: number;
  checksum: string | null;
}

export interface DeckMetadataSnapshot extends SchemaVersionMetadata {
  deckId: string;
  deckName: string;
  format: Deck["format"];
  style: DeckStyle;
  status: Deck["status"];
  createdFrom: Deck["createdFrom"];
  sourceApplication: typeof DECK_NEXUS_APPLICATION_ID;
  applicationVersion: string;
  createdAt: string;
  updatedAt: string;
  originalImportText: string;
  unresolvedImports: string[];
}

export interface CommanderMetadataSnapshot extends SchemaVersionMetadata {
  commanderIds: string[];
  commanderNames: string[];
  primaryCommanders: SnapshotDeckCard[];
  partnerCommanders: SnapshotDeckCard[];
  background?: SnapshotDeckCard;
  companion?: SnapshotDeckCard;
  createdAt: string;
  updatedAt: string;
  sourceApplication: typeof DECK_NEXUS_APPLICATION_ID;
  applicationVersion: string;
}

export interface SnapshotPrintingSelection {
  scryfallId?: string;
  oracleId?: string;
  setCode?: string;
  setName?: string;
  collectorNumber?: string;
  imageUri?: string;
}

export interface SnapshotDeckCard extends SchemaVersionMetadata {
  id: string;
  deckId: string;
  oracleId: string;
  scryfallId: string;
  name: string;
  quantity: number;
  section: DeckCardSection;
  commander: boolean;
  printingSelection: SnapshotPrintingSelection;
  manaCost?: string;
  manaValue?: number;
  typeLine?: string;
  oracleText?: string;
  colorIdentity: CommanderColor[];
  imageUris?: DeckstateCardImageUris | { normal?: string };
  customNotes: string;
  ownershipState: "owned" | "partial" | "missing" | "unknown";
  missingQuantity: number;
  ownedQuantityAtAdd: number;
  customTags: string[];
  roleTags: string[];
  categories: string[];
  recommendationMetadata: {
    goalMatches: string[];
    source?: string;
    reason?: string;
    replacementCardId?: string;
  };
  analyticsMetadata: {
    bracketImpact?: number;
    protected: boolean;
    legalities?: Record<string, string>;
  };
  sorting: {
    name: string;
    section: DeckCardSection;
    sortKey: string;
  };
  customCategory?: string;
  createdAt: string;
  updatedAt: string;
  sourceApplication: typeof DECK_NEXUS_APPLICATION_ID;
  applicationVersion: string;
}

export interface SnapshotOwnedPrinting extends SchemaVersionMetadata {
  id: string;
  scryfallId: string;
  oracleId: string;
  name: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  language: string;
  foil: boolean;
  condition: string;
  quantityOwned: number;
  imageUri: string;
  purchaseMetadata: null;
  lastScannedAt?: string;
  createdAt: string;
  updatedAt: string;
  sourceApplication: typeof DECK_NEXUS_APPLICATION_ID;
  applicationVersion: string;
}

export interface SnapshotOwnedCard extends SchemaVersionMetadata {
  id: string;
  oracleId: string;
  scryfallId: string;
  name: string;
  quantityOwned: number;
  printings: SnapshotOwnedPrinting[];
  manaCost?: string;
  manaValue?: number;
  typeLine?: string;
  oracleText?: string;
  colorIdentity: CommanderColor[];
  imageUri?: string;
  legalities?: Record<string, string>;
  tags: string[];
  notes: string;
  favorite: boolean;
  duplicateFlag: OwnedDuplicateFlag;
  deckUsage: Record<string, number>;
  lastScannedAt?: string;
  createdAt: string;
  updatedAt: string;
  sourceApplication: typeof DECK_NEXUS_APPLICATION_ID;
  applicationVersion: string;
}

export interface DeckOwnershipSummary {
  totalCards: number;
  totalQuantity: number;
  ownedQuantity: number;
  missingQuantity: number;
  missingCards: SnapshotDeckCard[];
}

export interface DeckSnapshot extends SchemaVersionMetadata {
  snapshotId: string;
  deckId: string;
  deckName: string;
  format: Deck["format"];
  metadata: DeckMetadataSnapshot;
  commander: CommanderMetadataSnapshot;
  colorIdentity: CommanderColor[];
  mainDeck: SnapshotDeckCard[];
  maybeboard: SnapshotDeckCard[];
  cuts: SnapshotDeckCard[];
  customCategories: string[];
  deckGoals: DeckGoal[];
  bracketLock: BracketLock;
  estimatedBracket?: Bracket;
  recommendationMetadata: {
    recommendations: DeckRecommendation[];
    smartBuilds: SmartBuildResult[];
  };
  analyticsMetadata: {
    latestAnalysis?: DeckAnalysis;
    analysisNotes: string[];
  };
  deckNotes: string;
  customTags: string[];
  groups: string[];
  favorite: boolean;
  ownershipSummary: DeckOwnershipSummary;
  missingCards: SnapshotDeckCard[];
  deckImage?: string;
  timestamps: {
    createdAt: string;
    updatedAt: string;
  };
  boardStateCompatibility: {
    bridgeRequired: true;
    validationStatus: "not_validated";
    gameplayStateIncluded: false;
  };
  hubCompatibility: {
    adapterRequired: true;
    profileLinked: false;
    syncStatus: "not_connected";
  };
  sourceApplication: typeof DECK_NEXUS_APPLICATION_ID;
  applicationVersion: string;
  exportVersion: string;
  exportFormat: EcosystemExportFormat;
  createdAt: string;
  updatedAt: string;
  snapshotHash: string;
  checksum: string | null;
  applicationMetadata: ApplicationMetadata;
  exportMetadata: ExportMetadata;
  migration: MigrationMetadata;
}

export interface CollectionSnapshot extends SchemaVersionMetadata {
  snapshotId: string;
  collectionId: string;
  collectionName: string;
  metadata: {
    createdAt: string;
    updatedAt: string;
    sourceApplication: typeof DECK_NEXUS_APPLICATION_ID;
    applicationVersion: string;
  };
  ownedCards: SnapshotOwnedCard[];
  statistics: {
    uniqueCards: number;
    totalQuantity: number;
    totalPrintings: number;
  };
  setSummaries: Record<string, number>;
  colorSummaries: Record<string, number>;
  typeSummaries: Record<string, number>;
  raritySummaries: Record<string, number>;
  favorites: string[];
  scannerMetadata: {
    batchCount: number;
    recordCount: number;
    lastScannedAt?: string;
  };
  sourceApplication: typeof DECK_NEXUS_APPLICATION_ID;
  applicationVersion: string;
  exportVersion: string;
  exportFormat: EcosystemExportFormat;
  compatibilityVersion: string;
  createdAt: string;
  updatedAt: string;
  checksum: string | null;
  applicationMetadata: ApplicationMetadata;
  exportMetadata: ExportMetadata;
}

export interface ProfileSnapshot extends SchemaVersionMetadata {
  snapshotId: string;
  profileId: "local-profile";
  displayName?: string;
  avatar?: string;
  appearanceSettings: Pick<
    AppSettings,
    | "reducedMotion"
    | "staticHomeScreen"
    | "homePerformanceMode"
    | "deviceTiltParallax"
    | "glowIntensity"
    | "highContrast"
    | "textSize"
  >;
  scannerSettings: Pick<
    AppSettings,
    | "scannerBatchPersistence"
    | "scannerConfirmationSound"
    | "scannerConfirmationVolume"
    | "scannerHapticConfirmation"
    | "scannerDefaultCameraId"
    | "scannerTorchDefault"
    | "scannerDefaultMode"
    | "scannerStableFrameDurationMs"
    | "scannerAutoConfirmHighConfidence"
    | "scannerRequireReviewAssumed"
    | "scannerRequireReviewLowConfidence"
    | "scannerSaveUnresolved"
    | "scannerPreferredDestination"
    | "scannerTrayFullTimeoutMs"
    | "scannerPreviewQuality"
    | "scannerPerformanceMode"
    | "scannerStoreCorrectionThumbnails"
  >;
  accessibilitySettings: Pick<AppSettings, "reducedMotion" | "highContrast" | "textSize">;
  backupPreferences: {
    localFirstMode: true;
    scryfallBulkDownloadWifiOnly: boolean;
    scryfallOfflineDatabaseDownloaded: boolean;
  };
  applicationPreferences: Pick<
    AppSettings,
    | "defaultExportFormat"
    | "defaultBracketLock"
    | "defaultOwnershipPreference"
    | "homeOrbitOrder"
    | "homeOrbitHiddenIds"
  >;
  favoriteCommanders: string[];
  favoriteColors: CommanderColor[];
  favoriteArchetypes: string[];
  hubIdentity: null;
  friends: [];
  multiplayerPresence: null;
  sourceApplication: typeof DECK_NEXUS_APPLICATION_ID;
  applicationVersion: string;
  exportVersion: string;
  exportFormat: EcosystemExportFormat;
  compatibilityVersion: string;
  createdAt: string;
  updatedAt: string;
  checksum: string | null;
  applicationMetadata: ApplicationMetadata;
  exportMetadata: ExportMetadata;
}

export interface EcosystemManifest extends SchemaVersionMetadata {
  manifestId: string;
  sourceApplication: typeof DECK_NEXUS_APPLICATION_ID;
  applicationVersion: string;
  exportVersion: string;
  exportFormat: "zip_package";
  createdAt: string;
  updatedAt: string;
  files: {
    path: string;
    kind: SnapshotKind;
    checksum: string | null;
  }[];
  checksum: string | null;
}

export interface EcosystemExportPackage extends SchemaVersionMetadata {
  packageId: string;
  sourceApplication: typeof DECK_NEXUS_APPLICATION_ID;
  applicationVersion: string;
  exportVersion: string;
  exportFormat: "zip_package";
  compatibilityVersion: string;
  createdAt: string;
  updatedAt: string;
  manifest: EcosystemManifest;
  deckSnapshot?: DeckSnapshot;
  collectionSnapshot: CollectionSnapshot;
  profileSnapshot: ProfileSnapshot;
  metadata: ApplicationMetadata;
  checksum: string | null;
}

export interface SnapshotExportContext {
  ownedCards?: readonly OwnedCard[];
  favorites?: readonly FavoriteItem[];
  groups?: readonly { id: string; deckIds: readonly string[] }[];
  analysis?: DeckAnalysis;
  recommendations?: readonly DeckRecommendation[];
  smartBuilds?: readonly SmartBuildResult[];
  createdAt?: string;
  exportFormat?: EcosystemExportFormat;
}

export interface CollectionExportContext {
  scanBatches?: readonly ScanBatch[];
  scanRecords?: readonly ScanRecord[];
  createdAt?: string;
  exportFormat?: EcosystemExportFormat;
}
