import type {
  BoardStateValidationResultRecord,
  Bracket,
  BracketLock,
  CommanderColor,
  Deck,
  DeckCardSection,
  DeckGoal,
  ImmutableDeckSnapshotRecord,
} from "../../types/domain";
import type { DeckSnapshot } from "../export/schemas";

export const IMMUTABLE_DECK_SNAPSHOT_SCHEMA_VERSION =
  "deck-nexus.immutable-deck-snapshot.schema.v1";
export const IMMUTABLE_DECK_SNAPSHOT_FORMAT_VERSION =
  "deck-nexus.immutable-deck-snapshot.v1";
export const IMMUTABLE_DECK_SNAPSHOT_COMPATIBILITY_VERSION =
  "boardstate-immutable-deck-snapshot.v1";
export const ADVANCED_GAMEPLAY_ENVELOPE_SCHEMA_VERSION =
  "boardstate.advanced-gameplay-snapshot-envelope.v1";
export const DRY_RUN_ENVELOPE_SCHEMA_VERSION =
  "boardstate.dry-run-snapshot-envelope.v1";
export const GAMEPLAY_IDENTITY_VERSION = "mtg-card-gameplay-identity.v1";

export type SnapshotCreationReason =
  | "manual"
  | "archive_checkpoint"
  | "boardstate_validation"
  | "advanced_gameplay_preparation"
  | "dry_run_preparation"
  | "tutorial_preparation"
  | "shared_session_preparation"
  | "export"
  | "backup";

export type SnapshotConsumerIntent =
  | "archival"
  | "boardstate_validation"
  | "advanced_gameplay"
  | "dry_run"
  | "tutorial"
  | "shared_session"
  | "export"
  | "backup"
  | "manual_checkpoint";

export type SnapshotStatus =
  | "creating"
  | "ready"
  | "ready_with_warnings"
  | "unresolved"
  | "validation_required"
  | "validated"
  | "validation_stale"
  | "incompatible"
  | "corrupted"
  | "archived"
  | "superseded"
  | "export_failed";

export type SnapshotArchivalState = "active" | "archived" | "superseded";

export type SnapshotComparisonStatus =
  | "matches"
  | "gameplay_changed"
  | "metadata_only_changed"
  | "unresolved"
  | "corrupted";

export interface SnapshotCardEntry {
  readonly snapshotCardEntryId: string;
  readonly sourceDeckCardId: string;
  readonly oracleId: string;
  readonly scryfallId: string;
  readonly name: string;
  readonly normalizedName: string;
  readonly quantity: number;
  readonly section: DeckCardSection;
  readonly commander: boolean;
  readonly companion: boolean;
  readonly printingId?: string;
  readonly setCode?: string;
  readonly collectorNumber?: string;
  readonly language?: string;
  readonly foil?: boolean;
  readonly manaCost?: string;
  readonly manaValue?: number;
  readonly typeLine?: string;
  readonly oracleText?: string;
  readonly colorIdentity: readonly CommanderColor[];
  readonly imageUri?: string;
  readonly gameplayIdentityVersion: typeof GAMEPLAY_IDENTITY_VERSION;
  readonly unresolved: boolean;
  readonly resolutionStatus: "resolved" | "partially_resolved" | "unresolved";
  readonly specialExceptionMetadata: Record<string, unknown>;
  readonly sourceDeckCardCreatedAt: string;
  readonly sourceDeckCardUpdatedAt: string;
}

export interface SnapshotCommanderConfiguration {
  readonly primaryCommander?: SnapshotCardEntry;
  readonly secondaryCommander?: SnapshotCardEntry;
  readonly partnerCommanders: readonly SnapshotCardEntry[];
  readonly background?: SnapshotCardEntry;
  readonly companion?: SnapshotCardEntry;
  readonly commanderOracleIds: readonly string[];
  readonly commanderScryfallIds: readonly string[];
  readonly commanderNames: readonly string[];
  readonly combinedColorIdentity: readonly CommanderColor[];
}

export interface SnapshotGameplayConfiguration {
  readonly format: Deck["format"];
  readonly formatVersion?: string;
  readonly commanderFormat: boolean;
  readonly commander: SnapshotCommanderConfiguration;
  readonly commanderZone: readonly SnapshotCardEntry[];
  readonly mainDeck: readonly SnapshotCardEntry[];
  readonly gameplayIncludedCards: readonly SnapshotCardEntry[];
  readonly unresolvedGameplayCards: readonly SnapshotCardEntry[];
}

export interface SnapshotSourceMetadata {
  readonly sourceDeckId: string;
  readonly sourceDeckUpdatedAt: string;
  readonly sourceCanonicalSnapshotId: string;
  readonly sourceCanonicalSnapshotChecksum: string;
  readonly sourceImportReference?: string;
}

export interface SnapshotCompatibilityMetadata {
  readonly boardState: {
    readonly preparedForExport: true;
    readonly launchBridgeConnected: false;
    readonly validationRequired: boolean;
  };
  readonly hub: {
    readonly adapterConnected: false;
  };
}

export interface SnapshotValidationMetadata {
  readonly localGuidanceStatus: "available" | "unavailable";
  readonly boardStateValidationStatus:
    | "not_validated"
    | "validated"
    | "stale"
    | "unavailable"
    | "test_result_ignored";
  readonly validationResultId?: string;
  readonly validatedSnapshotChecksum?: string;
  readonly validatedAt?: string;
  readonly boardStateApplicationVersion?: string;
  readonly boardStateRulesVersion?: string;
  readonly authoritativeValidationStatus?: string;
  readonly unsupportedChecks: readonly string[];
}

export interface ImmutableDeckSnapshotMetadata {
  readonly snapshotId: string;
  readonly deckId: string;
  readonly deckVersionId?: string;
  readonly snapshotSequenceNumber: number;
  readonly snapshotSchemaVersion: typeof IMMUTABLE_DECK_SNAPSHOT_SCHEMA_VERSION;
  readonly snapshotFormatVersion: typeof IMMUTABLE_DECK_SNAPSHOT_FORMAT_VERSION;
  readonly compatibilityVersion: typeof IMMUTABLE_DECK_SNAPSHOT_COMPATIBILITY_VERSION;
  readonly sourceApplication: "deck_nexus";
  readonly sourceApplicationVersion: string;
  readonly createdAt: string;
  readonly createdByProfileId?: string;
  readonly creationReason: SnapshotCreationReason;
  readonly consumerIntent: SnapshotConsumerIntent;
  readonly sourceDeckUpdatedAt: string;
  readonly snapshotChecksum: string;
  readonly gameplayChecksum: string;
  readonly metadataChecksum: string;
}

export interface ImmutableDeckSnapshot {
  readonly metadata: ImmutableDeckSnapshotMetadata;
  readonly deckIdentity: {
    readonly deckName: string;
    readonly format: Deck["format"];
    readonly deckDescription?: string;
    readonly deckImage?: string;
    readonly originalDeckId: string;
  };
  readonly gameplay: SnapshotGameplayConfiguration;
  readonly nonGameplaySections: {
    readonly maybeboard: readonly SnapshotCardEntry[];
    readonly cuts: readonly SnapshotCardEntry[];
    readonly tokensAndExtras: readonly SnapshotCardEntry[];
    readonly sidePlanningLists: readonly SnapshotCardEntry[];
  };
  readonly planningMetadata: {
    readonly deckGoals: readonly DeckGoal[];
    readonly bracketLock: BracketLock;
    readonly estimatedBracket?: Bracket;
    readonly customTags: readonly string[];
    readonly analyticsSummary: Record<string, unknown>;
    readonly recommendationSummary: Record<string, unknown>;
    readonly ownershipSummary: Record<string, unknown>;
    readonly missingCardSummary: Record<string, unknown>;
    readonly notesIncludedInArchivalSnapshot: boolean;
    readonly deckNotes?: string;
  };
  readonly validationMetadata: SnapshotValidationMetadata;
  readonly sourceMetadata: SnapshotSourceMetadata;
  readonly compatibility: SnapshotCompatibilityMetadata;
}

export interface SnapshotCreationResult {
  readonly record: ImmutableDeckSnapshotRecord;
  readonly snapshot: ImmutableDeckSnapshot;
  readonly status: SnapshotStatus;
  readonly warnings: readonly string[];
}

export interface SnapshotComparisonChange {
  readonly type:
    | "commander_changed"
    | "companion_changed"
    | "card_added"
    | "card_removed"
    | "quantity_changed"
    | "format_changed"
    | "unresolved_changed"
    | "metadata_changed";
  readonly label: string;
  readonly before?: string;
  readonly after?: string;
  readonly gameplayRelevant: boolean;
}

export interface SnapshotComparisonResult {
  readonly status: SnapshotComparisonStatus;
  readonly summary: string;
  readonly gameplayChecksumBefore: string;
  readonly gameplayChecksumAfter: string;
  readonly fullChecksumBefore?: string;
  readonly fullChecksumAfter?: string;
  readonly gameplayChanges: readonly SnapshotComparisonChange[];
  readonly metadataChanges: readonly SnapshotComparisonChange[];
}

export interface SnapshotManifest {
  readonly manifestVersion: "deck-nexus.snapshot-manifest.v1";
  readonly createdAt: string;
  readonly snapshotId: string;
  readonly deckId: string;
  readonly gameplayChecksum: string;
  readonly fullChecksum: string;
  readonly files: readonly string[];
}

export interface SnapshotExportPackage {
  readonly manifest: SnapshotManifest;
  readonly snapshot: ImmutableDeckSnapshot;
}

export interface AdvancedGameplaySnapshotEnvelope {
  readonly envelopeSchemaVersion: typeof ADVANCED_GAMEPLAY_ENVELOPE_SCHEMA_VERSION;
  readonly consumerIntent: "advanced_gameplay";
  readonly sourceApplication: "deck_nexus";
  readonly sourceApplicationVersion: string;
  readonly createdAt: string;
  readonly snapshotId: string;
  readonly gameplayChecksum: string;
  readonly immutableGameplayPayload: SnapshotGameplayConfiguration;
  readonly commanderConfiguration: SnapshotCommanderConfiguration;
  readonly format: Deck["format"];
  readonly boardStateCompatibility: SnapshotCompatibilityMetadata["boardState"];
  readonly matchingBoardStateValidationResultId?: string;
  readonly localStructuralReadinessStatus: SnapshotStatus;
  readonly unresolvedCards: readonly SnapshotCardEntry[];
  readonly displayMetadata: {
    readonly deckName: string;
  };
  readonly correlationId: string;
}

export interface DryRunSnapshotEnvelope {
  readonly envelopeSchemaVersion: typeof DRY_RUN_ENVELOPE_SCHEMA_VERSION;
  readonly consumerIntent: "dry_run";
  readonly sourceApplication: "deck_nexus";
  readonly sourceApplicationVersion: string;
  readonly createdAt: string;
  readonly snapshotId: string;
  readonly gameplayChecksum: string;
  readonly immutableGameplayPayload: SnapshotGameplayConfiguration;
  readonly commanderConfiguration: SnapshotCommanderConfiguration;
  readonly format: Deck["format"];
  readonly planningMetadata: {
    readonly deckGoals: readonly DeckGoal[];
    readonly bracketLock: BracketLock;
    readonly estimatedBracket?: Bracket;
  };
  readonly matchingBoardStateValidationResultId?: string;
  readonly localStructuralReadinessStatus: SnapshotStatus;
  readonly unresolvedCards: readonly SnapshotCardEntry[];
  readonly correlationId: string;
}

export interface CreateImmutableSnapshotOptions {
  readonly sequenceNumber: number;
  readonly creationReason?: SnapshotCreationReason;
  readonly consumerIntent?: SnapshotConsumerIntent;
  readonly createdAt?: string;
  readonly canonicalSnapshot?: DeckSnapshot;
  readonly validationResults?: readonly BoardStateValidationResultRecord[];
}
