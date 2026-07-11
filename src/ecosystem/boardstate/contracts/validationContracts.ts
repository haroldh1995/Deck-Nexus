import type {
  BoardStateLegalityStatus,
  BoardStateValidationIssueRecord,
  BoardStateValidationResultRecord,
  BoardStateValidationStatus,
} from "../../../types/domain";
import type { DeckSnapshot } from "../../export";

export const BOARDSTATE_AUTHORITY_APPLICATION = "boardstate";
export const BOARDSTATE_REQUEST_SCHEMA_VERSION = "boardstate.validation.request.v1";
export const BOARDSTATE_RESPONSE_SCHEMA_VERSION = "boardstate.validation.response.v1";
export const BOARDSTATE_COMPATIBILITY_VERSION = "boardstate-ecosystem.v1";

export type BoardStateValidationMode =
  | "deck_legality"
  | "commander_legality"
  | "color_identity"
  | "singleton"
  | "deck_size"
  | "commander_configuration"
  | "banned_restricted"
  | "special_card_rules"
  | "companion"
  | "partner_background"
  | "format_compatibility";

export const defaultBoardStateValidationModes: BoardStateValidationMode[] = [
  "deck_legality",
  "commander_legality",
  "color_identity",
  "singleton",
  "deck_size",
  "commander_configuration",
  "banned_restricted",
  "special_card_rules",
  "companion",
  "partner_background",
  "format_compatibility",
];

export type BoardStateRequestedAuthority = typeof BOARDSTATE_AUTHORITY_APPLICATION;

export type BoardStateRulesEnvironment = "commander";

export interface BoardStateClientCapabilities {
  supportedRequestSchemaVersions: string[];
  supportedResponseSchemaVersions: string[];
  supportedSnapshotSchemaVersions: string[];
  supportedValidationModes: BoardStateValidationMode[];
  canReceiveStructuredIssues: true;
  gameplayStateIncluded: false;
  collectionDataIncluded: false;
  profileDataIncluded: false;
}

export interface BoardStateValidationRequest {
  requestId: string;
  requestSchemaVersion: typeof BOARDSTATE_REQUEST_SCHEMA_VERSION;
  requestCreatedAt: string;
  sourceApplication: "deck_nexus";
  sourceApplicationVersion: string;
  sourceCompatibilityVersion: string;
  requestedAuthority: BoardStateRequestedAuthority;
  requestedValidationModes: BoardStateValidationMode[];
  deckSnapshot: DeckSnapshot;
  deckSnapshotId: string;
  deckSnapshotVersion: string;
  deckSnapshotChecksum: string;
  deckFormat: DeckSnapshot["format"];
  rulesEnvironment: BoardStateRulesEnvironment;
  clientCapabilities: BoardStateClientCapabilities;
  locale?: string;
  correlationId?: string;
  privacy: {
    ownershipConsideredForLegality: false;
    profileDataIncluded: false;
    collectionSnapshotIncluded: false;
    gameplayStateIncluded: false;
  };
}

export interface BoardStateTransportMetadata {
  transportType: BoardStateTransportType;
  endpoint?: string;
  responseTimeMs?: number;
  statusCode?: number;
  testOnly: boolean;
}

export interface BoardStateValidationResponse {
  responseId: string;
  responseSchemaVersion: typeof BOARDSTATE_RESPONSE_SCHEMA_VERSION;
  requestId: string;
  validatedAt: string;
  authorityApplication: BoardStateRequestedAuthority;
  authorityApplicationVersion: string;
  authorityRulesVersion: string;
  authorityCompatibilityVersion: string;
  deckSnapshotId: string;
  deckSnapshotVersion: string;
  deckSnapshotChecksum: string;
  validationStatus: BoardStateValidationStatus;
  legalityStatus: BoardStateLegalityStatus;
  format: DeckSnapshot["format"];
  commanderConfigurationStatus: "valid" | "invalid" | "warning" | "unsupported" | "unknown";
  issues: BoardStateValidationIssue[];
  warnings: BoardStateValidationIssue[];
  informationalFindings: BoardStateValidationIssue[];
  unsupportedChecks: string[];
  capabilitiesUsed: BoardStateValidationMode[];
  resultChecksum?: string;
  expiresAt?: string;
  correlationId?: string;
  transportMetadata: BoardStateTransportMetadata;
  error?: BoardStateValidationErrorMetadata;
}

export type BoardStateValidationIssue = BoardStateValidationIssueRecord;

export interface BoardStateValidationErrorMetadata {
  code: string;
  title: string;
  message: string;
  retryable: boolean;
  technicalDetail?: string;
}

export type BoardStateBridgeAvailability =
  | "disabled"
  | "not_configured"
  | "checking"
  | "compatible"
  | "partially_compatible"
  | "incompatible"
  | "unavailable"
  | "error";

export type BoardStateTransportType =
  | "unavailable"
  | "http_endpoint"
  | "same_origin_endpoint"
  | "local_app_bridge"
  | "post_message_bridge"
  | "deep_link_callback"
  | "installed_app_bridge"
  | "test_adapter";

export interface BoardStateBridgeRuntimeStatus {
  state: BoardStateBridgeAvailability;
  message: string;
  transportType: BoardStateTransportType;
  authoritativeAvailable: boolean;
  testOnly: boolean;
}

export interface BoardStateCapabilities {
  authorityApplication: BoardStateRequestedAuthority;
  authorityApplicationVersion: string;
  authorityCompatibilityVersion: string;
  authorityRulesVersion: string;
  supportedRequestSchemaVersions: string[];
  supportedResponseSchemaVersions: string[];
  supportedSnapshotSchemaVersions: string[];
  supportedFormats: DeckSnapshot["format"][];
  supportedValidationModes: BoardStateValidationMode[];
  maximumPayloadBytes?: number;
  transportCapabilities: BoardStateTransportType[];
}

export interface BoardStateBridgeConfig {
  enabled: boolean;
  endpoint?: string;
  transportType: BoardStateTransportType;
  compatibilityVersion: string;
  requestTimeoutMs: number;
  allowedOrigin?: string;
}

export interface BoardStateTransport {
  readonly transportType: BoardStateTransportType;
  readonly testOnly: boolean;
  getStatus(): Promise<BoardStateBridgeRuntimeStatus>;
  getCapabilities(signal?: AbortSignal): Promise<BoardStateCapabilities>;
  validateDeckSnapshot(
    request: BoardStateValidationRequest,
    signal?: AbortSignal,
  ): Promise<BoardStateValidationResponse>;
  cancelValidation?(requestId: string): void;
  healthCheck?(signal?: AbortSignal): Promise<BoardStateBridgeRuntimeStatus>;
}

export type BoardStateValidationResult = BoardStateValidationResultRecord;
