import type {
  BoardStateValidationIssueRecord,
  BoardStateValidationResultRecord,
} from "../../../types/domain";
import { createId, nowIso } from "../../../utils/ids";
import type { DeckSnapshot } from "../../export";
import type {
  BoardStateTransport,
  BoardStateValidationRequest,
  BoardStateValidationResponse,
} from "../contracts/validationContracts";
import {
  BoardStateBridgeError,
  boardStateErrorUserMessage,
  mapBoardStateErrorToStatus,
  toBoardStateBridgeError,
} from "../errors/boardStateErrors";
import { createBoardStateValidationRequest } from "./requestBuilder";
import { parseBoardStateValidationResponse } from "./responseParser";
import { compareBoardStateCapabilities } from "./capabilities";

export interface BoardStateValidationRun {
  request: BoardStateValidationRequest;
  response?: BoardStateValidationResponse;
  record: BoardStateValidationResultRecord;
}

function resultId(snapshot: DeckSnapshot, suffix: string): string {
  return `boardstate-result:${snapshot.deckId}:${snapshot.snapshotId}:${suffix}`;
}

function createTransportIssue(
  error: BoardStateBridgeError,
  request: BoardStateValidationRequest,
): BoardStateValidationIssueRecord {
  return {
    issueId: `transport:${request.requestId}:${error.code}`,
    code: error.code,
    severity: "informational",
    category: error.code === "incompatible_schema" ? "schema" : "transport",
    title: "BoardState validation unavailable",
    message: boardStateErrorUserMessage(error),
    affectedCardIds: [],
    affectedOracleIds: [],
    affectedScryfallIds: [],
    affectedSections: [],
    commanderRelated: false,
    authoritative: false,
    sourceAuthority: "deck_nexus",
    metadata: {
      retryable: error.retryable,
    },
  };
}

export function createBoardStateResultRecordFromResponse(
  request: BoardStateValidationRequest,
  response: BoardStateValidationResponse,
  receivedAt = nowIso(),
): BoardStateValidationResultRecord {
  const isAuthoritative =
    response.authorityApplication === "boardstate" &&
    !response.transportMetadata.testOnly &&
    ["valid", "invalid", "valid_with_warnings", "incomplete", "unsupported"].includes(
      response.validationStatus,
    );

  return {
    id: resultId(request.deckSnapshot, response.responseId),
    deckId: request.deckSnapshot.deckId,
    snapshotId: request.deckSnapshotId,
    snapshotVersion: request.deckSnapshotVersion,
    snapshotChecksum: request.deckSnapshotChecksum,
    requestId: request.requestId,
    responseId: response.responseId,
    boardStateVersion: response.authorityApplicationVersion,
    rulesVersion: response.authorityRulesVersion,
    status: response.validationStatus,
    legalityStatus: response.legalityStatus,
    issues: response.issues,
    warnings: response.warnings,
    informationalFindings: response.informationalFindings,
    unsupportedChecks: response.unsupportedChecks,
    validatedAt: response.validatedAt,
    receivedAt,
    stale: false,
    expiresAt: response.expiresAt,
    transportType: response.transportMetadata.transportType,
    errorSummary: response.error?.message,
    schemaVersions: {
      request: request.requestSchemaVersion,
      response: response.responseSchemaVersion,
      snapshot: request.deckSnapshotVersion,
      compatibility: response.authorityCompatibilityVersion,
    },
    authoritative: isAuthoritative,
    sourceAuthority: response.transportMetadata.testOnly
      ? "boardstate_test_adapter"
      : "boardstate",
    testOnly: response.transportMetadata.testOnly,
    rawResponse: {
      responseId: response.responseId,
      validationStatus: response.validationStatus,
      legalityStatus: response.legalityStatus,
      resultChecksum: response.resultChecksum,
    },
  };
}

export function createBoardStateFailureRecord(
  request: BoardStateValidationRequest,
  error: BoardStateBridgeError,
  receivedAt = nowIso(),
): BoardStateValidationResultRecord {
  const status = mapBoardStateErrorToStatus(error);
  const issue = createTransportIssue(error, request);

  return {
    id: resultId(request.deckSnapshot, `${request.requestId}:${error.code}`),
    deckId: request.deckSnapshot.deckId,
    snapshotId: request.deckSnapshotId,
    snapshotVersion: request.deckSnapshotVersion,
    snapshotChecksum: request.deckSnapshotChecksum,
    requestId: request.requestId,
    status,
    legalityStatus: "not_validated",
    issues: [],
    warnings: [],
    informationalFindings: [issue],
    unsupportedChecks: status === "unsupported" ? [error.code] : [],
    receivedAt,
    stale: false,
    transportType: "unavailable",
    errorSummary: boardStateErrorUserMessage(error),
    schemaVersions: {
      request: request.requestSchemaVersion,
      snapshot: request.deckSnapshotVersion,
    },
    authoritative: false,
    sourceAuthority: "deck_nexus",
    testOnly: false,
  };
}

export async function validateDeckSnapshotWithBoardState({
  snapshot,
  transport,
  signal,
  request,
}: {
  snapshot: DeckSnapshot;
  transport: BoardStateTransport;
  signal?: AbortSignal;
  request?: BoardStateValidationRequest;
}): Promise<BoardStateValidationRun> {
  const validationRequest = request ?? createBoardStateValidationRequest(snapshot);

  try {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      throw new BoardStateBridgeError({
        code: "offline",
        message: "Browser is offline.",
        retryable: true,
      });
    }

    const capabilities = await transport.getCapabilities(signal);
    const match = compareBoardStateCapabilities(capabilities, validationRequest);
    if (!match.compatible && !match.partiallyCompatible) {
      throw new BoardStateBridgeError({
        code: match.unsupportedReasons.some((reason) => reason.includes("schema"))
          ? "incompatible_schema"
          : "unsupported",
        message: "BoardState bridge capabilities do not support this request.",
      });
    }

    const response = await transport.validateDeckSnapshot(validationRequest, signal);
    const parsed = parseBoardStateValidationResponse(response, validationRequest);
    return {
      request: validationRequest,
      response: parsed,
      record: createBoardStateResultRecordFromResponse(validationRequest, parsed),
    };
  } catch (error) {
    const bridgeError = toBoardStateBridgeError(error);
    return {
      request: validationRequest,
      record: createBoardStateFailureRecord(validationRequest, bridgeError),
    };
  }
}

export function createManualUnavailableBoardStateRecord(
  snapshot: DeckSnapshot,
  message = "BoardState validation requires a configured bridge.",
): BoardStateValidationResultRecord {
  const request = createBoardStateValidationRequest(snapshot, {
    requestId: createId("boardstate-unavailable"),
  });
  return createBoardStateFailureRecord(
    request,
    new BoardStateBridgeError({
      code: "not_configured",
      message,
    }),
  );
}
