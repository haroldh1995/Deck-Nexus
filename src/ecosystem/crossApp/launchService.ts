import { saveBoardStateHandoffRecord } from "../../db/repositories";
import type {
  BoardStateHandoffRecord,
  BoardStateHandoffStatus,
  ImmutableDeckSnapshotRecord,
} from "../../types/domain";
import { createId, nowIso } from "../../utils/ids";
import {
  checksumObject,
  createDownloadBlob,
  DECK_NEXUS_APPLICATION_VERSION,
  serializePrettyJson,
} from "../export";
import {
  createAdvancedGameplaySnapshotEnvelope,
  createDryRunSnapshotEnvelope,
  snapshotFromRecord,
} from "../snapshots";
import {
  BOARDSTATE_ACKNOWLEDGMENT_SCHEMA_VERSION,
  BOARDSTATE_HANDOFF_COMPATIBILITY_VERSION,
  BOARDSTATE_LAUNCH_SCHEMA_VERSION,
  BOARDSTATE_RETURN_SCHEMA_VERSION,
  type BoardStateAcknowledgmentStatus,
  type BoardStateHandoffIntent,
  type BoardStateLaunchAcknowledgment,
  type BoardStateLaunchOptions,
  type BoardStateLaunchRequest,
  type BoardStateLaunchResult,
  type BoardStateReturnEnvelope,
  type BoardStateReturnType,
} from "./contracts";
import { findTransportCapability } from "./transportRegistry";

const activeLaunches = new Set<string>();

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function safeBoardStateFileName(value: string): string {
  return value
    .trim()
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "deck-nexus";
}

function payloadForIntent(
  snapshot: ImmutableDeckSnapshotRecord,
  intent: BoardStateHandoffIntent,
  createdAt: string,
): BoardStateLaunchRequest["immutableEnvelope"] {
  if (intent === "advanced_gameplay") {
    return createAdvancedGameplaySnapshotEnvelope(snapshot, createdAt);
  }
  if (intent === "dry_run") {
    return createDryRunSnapshotEnvelope(snapshot, createdAt);
  }
  const immutableSnapshot = snapshotFromRecord(snapshot);
  return {
    envelopeSchemaVersion: "boardstate.generic-deck-import-envelope.v1",
    consumerIntent: intent,
    sourceApplication: "deck_nexus",
    sourceApplicationVersion: DECK_NEXUS_APPLICATION_VERSION,
    createdAt,
    snapshotId: snapshot.snapshotId,
    gameplayChecksum: snapshot.gameplayChecksum,
    fullSnapshotChecksum: snapshot.fullChecksum,
    immutableGameplayPayload: immutableSnapshot.gameplay,
    deckName: snapshot.deckName,
    localStructuralReadinessStatus: snapshot.status,
    privateMetadataIncluded: false,
  };
}

export function createBoardStateLaunchRequest(
  snapshot: ImmutableDeckSnapshotRecord,
  options: BoardStateLaunchOptions,
): BoardStateLaunchRequest {
  const createdAt = options.createdAt ?? nowIso();
  const immutableEnvelope = payloadForIntent(snapshot, options.intent, createdAt);
  const payloadSize = new Blob([serializePrettyJson(immutableEnvelope)]).size;
  return {
    launchRequestId: createId("boardstate-launch"),
    launchSchemaVersion: BOARDSTATE_LAUNCH_SCHEMA_VERSION,
    createdAt,
    expiresAt: new Date(Date.parse(createdAt) + 15 * 60 * 1000).toISOString(),
    sourceApplication: "deck_nexus",
    sourceApplicationVersion: DECK_NEXUS_APPLICATION_VERSION,
    sourceCompatibilityVersion: BOARDSTATE_HANDOFF_COMPATIBILITY_VERSION,
    targetApplication: "boardstate",
    targetCapability: options.intent,
    consumerIntent: options.intent,
    snapshotId: snapshot.snapshotId,
    snapshotSequenceNumber: snapshot.snapshotSequenceNumber,
    gameplayChecksum: snapshot.gameplayChecksum,
    fullSnapshotChecksum: snapshot.fullChecksum,
    immutableEnvelope,
    requestedReturnMode: ["direct_web", "post_message", "same_origin"].includes(options.transportType)
      ? "post_message"
      : "none",
    requestedAcknowledgment: ["direct_web", "post_message", "same_origin"].includes(options.transportType),
    correlationId: createId("boardstate-correlation"),
    nonce: createId("nonce"),
    transportType: options.transportType,
    sourceOrigin: typeof window !== "undefined" ? window.location.origin : undefined,
    payloadEncoding: "json",
    payloadCompression: "none",
    payloadSize,
    signature: {
      signed: false,
      signatureVersion: null,
    },
    privacy: {
      privateNotesIncluded: false,
      ownershipInventoryIncluded: false,
      profileIncluded: false,
      gameplayStateIncluded: false,
    },
    userVisibleDeckName: snapshot.deckName,
  };
}

export function serializeBoardStateLaunchPackage(
  request: BoardStateLaunchRequest,
): string {
  return serializePrettyJson({
    packageKind: "deck-nexus-boardstate-handoff",
    packageVersion: "deck-nexus-boardstate-handoff.v1",
    checksum: checksumObject(request),
    request,
    manualImport: boardStateManualImportInstructions(request),
  });
}

export function boardStateManualImportInstructions(
  request: BoardStateLaunchRequest,
): string[] {
  return [
    "Export the BoardState package from Deck Nexus.",
    "Open Original BoardState when its import workflow is available.",
    "Choose the BoardState deck snapshot import flow.",
    `Confirm snapshot ${request.snapshotId} and checksum ${request.gameplayChecksum}.`,
    "Continue into Advanced Gameplay or Dry Run inside BoardState.",
    "Deck Nexus will not mark the package imported without a valid BoardState acknowledgment.",
  ];
}

function createHandoffRecord(
  snapshot: ImmutableDeckSnapshotRecord,
  request: BoardStateLaunchRequest,
  status: BoardStateHandoffStatus,
  retryOfHandoffId?: string,
  errorSummary?: string,
): BoardStateHandoffRecord {
  return {
    id: createId("handoff"),
    launchRequestId: request.launchRequestId,
    deckId: snapshot.deckId,
    snapshotId: snapshot.snapshotId,
    gameplayChecksum: snapshot.gameplayChecksum,
    consumerIntent: request.consumerIntent,
    transportType: request.transportType,
    createdAt: request.createdAt,
    launchedAt: ["launching", "app_or_page_opened", "export_completed", "share_sheet_opened"].includes(status)
      ? nowIso()
      : undefined,
    finalStatus: status,
    errorSummary,
    retryOfHandoffId,
    payloadSize: request.payloadSize,
    importedConfirmed: false,
    sessionCreatedConfirmed: false,
  };
}

export async function runBoardStateHandoff(
  snapshot: ImmutableDeckSnapshotRecord,
  options: BoardStateLaunchOptions,
): Promise<BoardStateLaunchResult> {
  const request = createBoardStateLaunchRequest(snapshot, options);
  const lockKey = `${snapshot.snapshotId}:${options.intent}`;

  if (activeLaunches.has(lockKey)) {
    const handoff = createHandoffRecord(
      snapshot,
      request,
      "failed",
      options.retryOfHandoffId,
      "A BoardState handoff is already active for this snapshot and intent.",
    );
    await saveBoardStateHandoffRecord(handoff);
    return {
      handoff,
      request,
      status: "failed",
      instructions: boardStateManualImportInstructions(request),
    };
  }

  activeLaunches.add(lockKey);
  try {
    const packageJson = serializeBoardStateLaunchPackage(request);
    const payloadSize = new Blob([packageJson]).size;
    const capability = findTransportCapability(
      options.transportType,
      payloadSize,
      options.runtime,
    );

    if (
      !["available", "requires_manual_import"].includes(capability.status) &&
      capability.status !== "configured_but_unverified"
    ) {
      const handoff = createHandoffRecord(
        snapshot,
        request,
        capability.status === "incompatible" ? "incompatible" : "failed",
        options.retryOfHandoffId,
        capability.reason,
      );
      await saveBoardStateHandoffRecord(handoff);
      return {
        handoff,
        request,
        status: handoff.finalStatus,
        instructions: boardStateManualImportInstructions(request),
      };
    }

    if (options.transportType === "clipboard") {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        throw new Error("Clipboard writing is unavailable.");
      }
      await navigator.clipboard.writeText(packageJson);
      const handoff = createHandoffRecord(snapshot, request, "export_completed", options.retryOfHandoffId);
      await saveBoardStateHandoffRecord(handoff);
      return {
        handoff,
        request,
        status: "export_completed",
        instructions: boardStateManualImportInstructions(request),
      };
    }

    if (options.transportType === "web_share") {
      const nav = navigator as Navigator & {
        share?: (data?: ShareData) => Promise<void>;
        canShare?: (data?: ShareData) => boolean;
      };
      const file = new File(
        [packageJson],
        boardStatePackageFileName(request),
        { type: "application/json" },
      );
      if (!nav.share || (nav.canShare && !nav.canShare({ files: [file] }))) {
        throw new Error("Web Share file support is unavailable.");
      }
      await nav.share({
        title: "Deck Nexus BoardState package",
        text: "BoardState import package prepared by Deck Nexus.",
        files: [file],
      });
      const handoff = createHandoffRecord(snapshot, request, "share_sheet_opened", options.retryOfHandoffId);
      await saveBoardStateHandoffRecord(handoff);
      return {
        handoff,
        request,
        status: "share_sheet_opened",
        instructions: [
          ...boardStateManualImportInstructions(request),
          "Share completion does not confirm BoardState import.",
        ],
      };
    }

    if (options.transportType === "direct_web") {
      const handoff = createHandoffRecord(
        snapshot,
        request,
        "import_unconfirmed",
        options.retryOfHandoffId,
        "Direct BoardState launch is configured but not acknowledged.",
      );
      await saveBoardStateHandoffRecord(handoff);
      return {
        handoff,
        request,
        status: "import_unconfirmed",
        instructions: [
          "BoardState page opening alone is not proof of import.",
          ...boardStateManualImportInstructions(request),
        ],
      };
    }

    const handoff = createHandoffRecord(
      snapshot,
      request,
      "export_completed",
      options.retryOfHandoffId,
    );
    await saveBoardStateHandoffRecord(handoff);
    return {
      handoff,
      request,
      status: "export_completed",
      instructions: boardStateManualImportInstructions(request),
    };
  } catch (error) {
    const handoff = createHandoffRecord(
      snapshot,
      request,
      "failed",
      options.retryOfHandoffId,
      error instanceof Error ? error.message : "BoardState handoff failed.",
    );
    await saveBoardStateHandoffRecord(handoff);
    return {
      handoff,
      request,
      status: "failed",
      instructions: boardStateManualImportInstructions(request),
    };
  } finally {
    activeLaunches.delete(lockKey);
  }
}

export function boardStatePackageFileName(request: BoardStateLaunchRequest): string {
  const suffix =
    request.consumerIntent === "advanced_gameplay"
      ? "advanced"
      : request.consumerIntent === "dry_run"
        ? "dry-run"
        : request.consumerIntent.replace(/_/g, "-");
  return `deck-nexus-boardstate-${suffix}-${safeBoardStateFileName(request.userVisibleDeckName)}-${request.snapshotSequenceNumber}.json`;
}

export function createBoardStatePackageBlob(request: BoardStateLaunchRequest): Blob {
  return createDownloadBlob(serializeBoardStateLaunchPackage(request), "application/json");
}

export function parseBoardStateAcknowledgment(
  value: unknown,
  request: BoardStateLaunchRequest,
): BoardStateLaunchAcknowledgment {
  const record = value as Partial<BoardStateLaunchAcknowledgment>;
  if (!record || typeof record !== "object") {
    throw new Error("BoardState acknowledgment is malformed.");
  }
  if (record.acknowledgmentSchemaVersion !== BOARDSTATE_ACKNOWLEDGMENT_SCHEMA_VERSION) {
    throw new Error("BoardState acknowledgment schema is incompatible.");
  }
  if (record.targetApplication !== "boardstate") {
    throw new Error("BoardState acknowledgment has the wrong target application.");
  }
  if (record.launchRequestId !== request.launchRequestId) {
    throw new Error("BoardState acknowledgment has the wrong request ID.");
  }
  if (record.correlationId !== request.correlationId) {
    throw new Error("BoardState acknowledgment has the wrong correlation ID.");
  }
  if (record.snapshotId !== request.snapshotId) {
    throw new Error("BoardState acknowledgment has the wrong snapshot ID.");
  }
  if (record.gameplayChecksum !== request.gameplayChecksum) {
    throw new Error("BoardState acknowledgment checksum mismatch.");
  }
  if (!isAcknowledgmentStatus(record.acknowledgmentStatus)) {
    throw new Error("BoardState acknowledgment status is unsupported.");
  }
  return {
    acknowledgmentId: String(record.acknowledgmentId),
    acknowledgmentSchemaVersion: BOARDSTATE_ACKNOWLEDGMENT_SCHEMA_VERSION,
    launchRequestId: request.launchRequestId,
    correlationId: request.correlationId,
    targetApplication: "boardstate",
    targetApplicationVersion: record.targetApplicationVersion,
    receivedAt: String(record.receivedAt),
    acknowledgmentStatus: record.acknowledgmentStatus,
    snapshotId: request.snapshotId,
    gameplayChecksum: request.gameplayChecksum,
    acceptedIntent: record.acceptedIntent ?? request.consumerIntent,
    importedDeckId: record.importedDeckId,
    sessionId: record.sessionId,
    validationResultId: record.validationResultId,
    rulesVersion: record.rulesVersion,
    errorCode: record.errorCode,
    errorMessage: record.errorMessage,
    unsupportedCapabilities: record.unsupportedCapabilities ?? [],
    returnCapability: record.returnCapability ?? "none",
    transportMetadata: cloneJson(record.transportMetadata ?? {}),
  };
}

export function parseBoardStateReturnEnvelope(
  value: unknown,
  request: BoardStateLaunchRequest,
): BoardStateReturnEnvelope {
  const record = value as Partial<BoardStateReturnEnvelope>;
  if (!record || typeof record !== "object") {
    throw new Error("BoardState return payload is malformed.");
  }
  if (record.returnSchemaVersion !== BOARDSTATE_RETURN_SCHEMA_VERSION) {
    throw new Error("BoardState return schema is incompatible.");
  }
  if (record.sourceApplication !== "boardstate" || record.targetApplication !== "deck_nexus") {
    throw new Error("BoardState return payload has an invalid application boundary.");
  }
  if (record.launchRequestId !== request.launchRequestId) {
    throw new Error("BoardState return payload has the wrong request ID.");
  }
  if (record.correlationId !== request.correlationId) {
    throw new Error("BoardState return payload has the wrong correlation ID.");
  }
  if (record.snapshotId !== request.snapshotId || record.gameplayChecksum !== request.gameplayChecksum) {
    throw new Error("BoardState return payload does not match this snapshot.");
  }
  if (!isReturnType(record.returnType) || !isAcknowledgmentStatus(record.status)) {
    throw new Error("BoardState return payload status is unsupported.");
  }
  return {
    returnSchemaVersion: BOARDSTATE_RETURN_SCHEMA_VERSION,
    sourceApplication: "boardstate",
    sourceApplicationVersion: record.sourceApplicationVersion,
    targetApplication: "deck_nexus",
    launchRequestId: request.launchRequestId,
    correlationId: request.correlationId,
    snapshotId: request.snapshotId,
    gameplayChecksum: request.gameplayChecksum,
    returnType: record.returnType,
    returnedAt: String(record.returnedAt),
    payload: cloneJson(record.payload ?? {}),
    status: record.status,
    error: record.error,
    integrity: {
      checksum: record.integrity?.checksum,
      signed: false,
    },
  };
}

function isAcknowledgmentStatus(value: unknown): value is BoardStateAcknowledgmentStatus {
  return typeof value === "string" && [
    "received",
    "accepted",
    "imported",
    "session_created",
    "validation_started",
    "validation_completed",
    "rejected",
    "unsupported",
    "incompatible",
    "canceled",
    "timeout",
    "malformed",
    "checksum_mismatch",
    "transport_failed",
    "unknown",
  ].includes(value);
}

function isReturnType(value: unknown): value is BoardStateReturnType {
  return typeof value === "string" && [
    "import_acknowledgment",
    "validation_result",
    "session_created",
    "dry_run_summary",
    "advanced_gameplay_return",
    "deck_change_proposal",
    "rules_issue_summary",
    "unsupported_card_report",
    "compatibility_result",
    "error",
  ].includes(value);
}
