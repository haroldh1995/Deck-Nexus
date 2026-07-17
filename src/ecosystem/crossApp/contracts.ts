import type {
  BoardStateHandoffRecord,
  BoardStateHandoffStatus,
  ImmutableDeckSnapshotRecord,
} from "../../types/domain";
import type {
  AdvancedGameplaySnapshotEnvelope,
  DryRunSnapshotEnvelope,
} from "../snapshots/contracts";

export const BOARDSTATE_LAUNCH_SCHEMA_VERSION =
  "deck-nexus.boardstate-launch-request.v1";
export const BOARDSTATE_ACKNOWLEDGMENT_SCHEMA_VERSION =
  "boardstate.launch-acknowledgment.v1";
export const BOARDSTATE_RETURN_SCHEMA_VERSION =
  "boardstate.return-envelope.v1";
export const BOARDSTATE_HANDOFF_COMPATIBILITY_VERSION =
  "boardstate-handoff.v1";

export type BoardStateHandoffIntent =
  | "advanced_gameplay"
  | "dry_run"
  | "validation_review"
  | "import_only"
  | "tutorial_preparation"
  | "generic_export";

export type BoardStateHandoffTransportType =
  | "direct_web"
  | "post_message"
  | "same_origin"
  | "custom_uri"
  | "android_intent"
  | "file_export"
  | "clipboard"
  | "web_share"
  | "qr_code"
  | "manual_import"
  | "future_hub";

export type TransportCapabilityStatus =
  | "available"
  | "unavailable"
  | "partially_available"
  | "configured_but_unverified"
  | "incompatible"
  | "requires_manual_import"
  | "error";

export type BoardStateAcknowledgmentStatus =
  | "received"
  | "accepted"
  | "imported"
  | "session_created"
  | "validation_started"
  | "validation_completed"
  | "rejected"
  | "unsupported"
  | "incompatible"
  | "canceled"
  | "timeout"
  | "malformed"
  | "checksum_mismatch"
  | "transport_failed"
  | "unknown";

export type BoardStateReturnType =
  | "import_acknowledgment"
  | "validation_result"
  | "session_created"
  | "dry_run_summary"
  | "advanced_gameplay_return"
  | "deck_change_proposal"
  | "rules_issue_summary"
  | "unsupported_card_report"
  | "compatibility_result"
  | "error";

export interface PayloadEncodingMetadata {
  readonly payloadEncoding: "json" | "compact_json" | "compressed_json" | "zip" | "transfer_token";
  readonly payloadCompression: "none" | "gzip";
  readonly payloadSize: number;
}

export interface BoardStateLaunchEnvelopeMap {
  advanced_gameplay: AdvancedGameplaySnapshotEnvelope;
  dry_run: DryRunSnapshotEnvelope;
  validation_review: Record<string, unknown>;
  import_only: Record<string, unknown>;
  tutorial_preparation: Record<string, unknown>;
  generic_export: Record<string, unknown>;
}

export interface BoardStateLaunchRequest {
  readonly launchRequestId: string;
  readonly launchSchemaVersion: typeof BOARDSTATE_LAUNCH_SCHEMA_VERSION;
  readonly createdAt: string;
  readonly expiresAt?: string;
  readonly sourceApplication: "deck_nexus";
  readonly sourceApplicationVersion: string;
  readonly sourceCompatibilityVersion: typeof BOARDSTATE_HANDOFF_COMPATIBILITY_VERSION;
  readonly targetApplication: "boardstate";
  readonly targetApplicationVersionRequirement?: string;
  readonly targetCapability: BoardStateHandoffIntent;
  readonly consumerIntent: BoardStateHandoffIntent;
  readonly snapshotId: string;
  readonly snapshotSequenceNumber: number;
  readonly gameplayChecksum: string;
  readonly fullSnapshotChecksum: string;
  readonly immutableEnvelope: BoardStateLaunchEnvelopeMap[BoardStateHandoffIntent];
  readonly requestedReturnMode: "none" | "callback" | "post_message" | "broadcast_channel" | "manual_code";
  readonly requestedAcknowledgment: boolean;
  readonly correlationId: string;
  readonly nonce: string;
  readonly transportType: BoardStateHandoffTransportType;
  readonly sourceReturnUri?: string;
  readonly sourceOrigin?: string;
  readonly payloadEncoding: PayloadEncodingMetadata["payloadEncoding"];
  readonly payloadCompression: PayloadEncodingMetadata["payloadCompression"];
  readonly payloadSize: number;
  readonly signature: {
    readonly signed: false;
    readonly signatureVersion: null;
  };
  readonly privacy: {
    readonly privateNotesIncluded: false;
    readonly ownershipInventoryIncluded: false;
    readonly profileIncluded: false;
    readonly gameplayStateIncluded: false;
  };
  readonly userVisibleDeckName: string;
}

export interface BoardStateLaunchAcknowledgment {
  readonly acknowledgmentId: string;
  readonly acknowledgmentSchemaVersion: typeof BOARDSTATE_ACKNOWLEDGMENT_SCHEMA_VERSION;
  readonly launchRequestId: string;
  readonly correlationId: string;
  readonly targetApplication: "boardstate";
  readonly targetApplicationVersion?: string;
  readonly receivedAt: string;
  readonly acknowledgmentStatus: BoardStateAcknowledgmentStatus;
  readonly snapshotId: string;
  readonly gameplayChecksum: string;
  readonly acceptedIntent: BoardStateHandoffIntent;
  readonly importedDeckId?: string;
  readonly sessionId?: string;
  readonly validationResultId?: string;
  readonly rulesVersion?: string;
  readonly errorCode?: string;
  readonly errorMessage?: string;
  readonly unsupportedCapabilities: readonly string[];
  readonly returnCapability: "none" | "callback" | "post_message" | "broadcast_channel" | "manual_code";
  readonly transportMetadata: Record<string, unknown>;
}

export interface BoardStateReturnEnvelope {
  readonly returnSchemaVersion: typeof BOARDSTATE_RETURN_SCHEMA_VERSION;
  readonly sourceApplication: "boardstate";
  readonly sourceApplicationVersion?: string;
  readonly targetApplication: "deck_nexus";
  readonly launchRequestId: string;
  readonly correlationId: string;
  readonly snapshotId: string;
  readonly gameplayChecksum: string;
  readonly returnType: BoardStateReturnType;
  readonly returnedAt: string;
  readonly payload: Record<string, unknown>;
  readonly status: BoardStateAcknowledgmentStatus;
  readonly error?: {
    readonly code: string;
    readonly message: string;
  };
  readonly integrity: {
    readonly checksum?: string;
    readonly signed: false;
  };
}

export interface BoardStateTransportCapability {
  readonly type: BoardStateHandoffTransportType;
  readonly label: string;
  readonly status: TransportCapabilityStatus;
  readonly supportsAcknowledgment: boolean;
  readonly supportsReturn: boolean;
  readonly maxPayloadBytes: number;
  readonly reason: string;
}

export interface BoardStateTransportRuntime {
  readonly clipboardAvailable?: boolean;
  readonly webShareAvailable?: boolean;
  readonly webShareFilesAvailable?: boolean;
  readonly fileDownloadAvailable?: boolean;
  readonly online?: boolean;
}

export interface BoardStateLaunchResult {
  readonly handoff: BoardStateHandoffRecord;
  readonly request: BoardStateLaunchRequest;
  readonly status: BoardStateHandoffStatus;
  readonly acknowledgment?: BoardStateLaunchAcknowledgment;
  readonly instructions: readonly string[];
}

export interface BoardStateLaunchOptions {
  readonly intent: BoardStateHandoffIntent;
  readonly transportType: BoardStateHandoffTransportType;
  readonly createdAt?: string;
  readonly retryOfHandoffId?: string;
  readonly runtime?: BoardStateTransportRuntime;
}

export interface BoardStateLaunchValidationContext {
  readonly request: BoardStateLaunchRequest;
  readonly snapshot: ImmutableDeckSnapshotRecord;
}
