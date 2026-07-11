import { checksumObject } from "../../export";
import type {
  BoardStateLegalityStatus,
  BoardStateValidationIssueRecord,
  BoardStateValidationStatus,
} from "../../../types/domain";
import {
  BOARDSTATE_AUTHORITY_APPLICATION,
  BOARDSTATE_RESPONSE_SCHEMA_VERSION,
  defaultBoardStateValidationModes,
  type BoardStateValidationIssue,
  type BoardStateValidationRequest,
  type BoardStateValidationResponse,
  type BoardStateTransportMetadata,
} from "../contracts/validationContracts";
import { BoardStateBridgeError } from "../errors/boardStateErrors";

const validationStatuses: BoardStateValidationStatus[] = [
  "valid",
  "invalid",
  "valid_with_warnings",
  "incomplete",
  "unsupported",
  "unavailable",
  "timeout",
  "transport_error",
  "malformed_response",
  "incompatible_schema",
  "stale",
  "canceled",
];

const legalityStatuses: BoardStateLegalityStatus[] = [
  "legal",
  "illegal",
  "legal_with_warnings",
  "unknown",
  "not_validated",
];

const severities: BoardStateValidationIssueRecord["severity"][] = [
  "error",
  "warning",
  "informational",
  "unsupported",
];

const categories: BoardStateValidationIssueRecord["category"][] = [
  "deck_size",
  "commander",
  "color_identity",
  "singleton",
  "banned_card",
  "restricted_card",
  "partner",
  "background",
  "companion",
  "format",
  "special_exception",
  "unknown_card",
  "unresolved_card",
  "malformed_snapshot",
  "unsupported_mechanic",
  "transport",
  "schema",
  "other",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function parseIssue(value: unknown): BoardStateValidationIssue {
  if (!isRecord(value)) {
    throw new BoardStateBridgeError({
      code: "malformed_response",
      message: "BoardState returned an invalid issue entry.",
    });
  }

  const severity = severities.includes(value.severity as BoardStateValidationIssueRecord["severity"])
    ? value.severity as BoardStateValidationIssueRecord["severity"]
    : "informational";
  const category = categories.includes(value.category as BoardStateValidationIssueRecord["category"])
    ? value.category as BoardStateValidationIssueRecord["category"]
    : "other";

  return {
    issueId: stringValue(value.issueId, `issue:${stringValue(value.code, "unknown")}`),
    code: stringValue(value.code, "unknown"),
    severity,
    category,
    title: stringValue(value.title, "BoardState finding"),
    message: stringValue(value.message, ""),
    affectedCardIds: stringArray(value.affectedCardIds),
    affectedOracleIds: stringArray(value.affectedOracleIds),
    affectedScryfallIds: stringArray(value.affectedScryfallIds),
    affectedSections: stringArray(value.affectedSections).filter(
      (section): section is BoardStateValidationIssueRecord["affectedSections"][number] =>
        ["main", "commander", "maybeboard", "cuts"].includes(section),
    ),
    commanderRelated: value.commanderRelated === true,
    rulesReference: stringValue(value.rulesReference) || undefined,
    suggestedActionType: stringValue(value.suggestedActionType) || undefined,
    authoritative: value.authoritative !== false,
    sourceAuthority:
      value.sourceAuthority === "boardstate_test_adapter"
        ? "boardstate_test_adapter"
        : value.sourceAuthority === "deck_nexus"
          ? "deck_nexus"
          : "boardstate",
    metadata: isRecord(value.metadata) ? value.metadata : {},
  };
}

function parseIssueList(value: unknown): BoardStateValidationIssue[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(parseIssue);
}

function parseTransportMetadata(value: unknown): BoardStateTransportMetadata {
  if (!isRecord(value)) {
    return {
      transportType: "unavailable",
      testOnly: false,
    };
  }

  const transportType =
    typeof value.transportType === "string" &&
    [
      "unavailable",
      "http_endpoint",
      "same_origin_endpoint",
      "local_app_bridge",
      "post_message_bridge",
      "deep_link_callback",
      "installed_app_bridge",
      "test_adapter",
    ].includes(value.transportType)
      ? value.transportType as BoardStateTransportMetadata["transportType"]
      : "unavailable";

  return {
    transportType,
    endpoint: stringValue(value.endpoint) || undefined,
    responseTimeMs: typeof value.responseTimeMs === "number" ? value.responseTimeMs : undefined,
    statusCode: typeof value.statusCode === "number" ? value.statusCode : undefined,
    testOnly: value.testOnly === true,
  };
}

export function parseBoardStateValidationResponse(
  value: unknown,
  request: BoardStateValidationRequest,
): BoardStateValidationResponse {
  if (!isRecord(value)) {
    throw new BoardStateBridgeError({
      code: "malformed_response",
      message: "BoardState response was not an object.",
    });
  }

  if (value.responseSchemaVersion !== BOARDSTATE_RESPONSE_SCHEMA_VERSION) {
    throw new BoardStateBridgeError({
      code: "incompatible_schema",
      message: "BoardState response schema is unsupported.",
    });
  }

  if (value.requestId !== request.requestId) {
    throw new BoardStateBridgeError({
      code: "malformed_response",
      message: "BoardState response did not match the submitted request.",
    });
  }

  if (value.authorityApplication !== BOARDSTATE_AUTHORITY_APPLICATION) {
    throw new BoardStateBridgeError({
      code: "malformed_response",
      message: "BoardState response authority was not recognized.",
    });
  }

  if (value.deckSnapshotId !== request.deckSnapshotId) {
    throw new BoardStateBridgeError({
      code: "malformed_response",
      message: "BoardState response referenced a different snapshot.",
    });
  }

  if (value.deckSnapshotChecksum !== request.deckSnapshotChecksum) {
    throw new BoardStateBridgeError({
      code: "checksum_mismatch",
      message: "BoardState response checksum did not match the submitted snapshot.",
    });
  }

  const validationStatus = validationStatuses.includes(value.validationStatus as BoardStateValidationStatus)
    ? value.validationStatus as BoardStateValidationStatus
    : undefined;
  const legalityStatus = legalityStatuses.includes(value.legalityStatus as BoardStateLegalityStatus)
    ? value.legalityStatus as BoardStateLegalityStatus
    : undefined;

  if (!validationStatus || !legalityStatus) {
    throw new BoardStateBridgeError({
      code: "malformed_response",
      message: "BoardState response included an unsupported status.",
    });
  }

  const response: BoardStateValidationResponse = {
    responseId: stringValue(value.responseId, `response:${request.requestId}`),
    responseSchemaVersion: BOARDSTATE_RESPONSE_SCHEMA_VERSION,
    requestId: request.requestId,
    validatedAt: stringValue(value.validatedAt, new Date(0).toISOString()),
    authorityApplication: BOARDSTATE_AUTHORITY_APPLICATION,
    authorityApplicationVersion: stringValue(value.authorityApplicationVersion, "unknown"),
    authorityRulesVersion: stringValue(value.authorityRulesVersion, "unknown"),
    authorityCompatibilityVersion: stringValue(value.authorityCompatibilityVersion, "unknown"),
    deckSnapshotId: request.deckSnapshotId,
    deckSnapshotVersion: stringValue(value.deckSnapshotVersion, request.deckSnapshotVersion),
    deckSnapshotChecksum: request.deckSnapshotChecksum,
    validationStatus,
    legalityStatus,
    format: request.deckFormat,
    commanderConfigurationStatus:
      value.commanderConfigurationStatus === "valid" ||
      value.commanderConfigurationStatus === "invalid" ||
      value.commanderConfigurationStatus === "warning" ||
      value.commanderConfigurationStatus === "unsupported"
        ? value.commanderConfigurationStatus
        : "unknown",
    issues: parseIssueList(value.issues),
    warnings: parseIssueList(value.warnings),
    informationalFindings: parseIssueList(value.informationalFindings),
    unsupportedChecks: stringArray(value.unsupportedChecks),
    capabilitiesUsed: Array.isArray(value.capabilitiesUsed)
      ? value.capabilitiesUsed.filter((mode): mode is typeof defaultBoardStateValidationModes[number] =>
          typeof mode === "string" && defaultBoardStateValidationModes.includes(mode as typeof defaultBoardStateValidationModes[number]),
        )
      : [],
    resultChecksum: stringValue(value.resultChecksum) || undefined,
    expiresAt: stringValue(value.expiresAt) || undefined,
    correlationId: stringValue(value.correlationId) || request.correlationId,
    transportMetadata: parseTransportMetadata(value.transportMetadata),
    error: isRecord(value.error)
      ? {
          code: stringValue(value.error.code, "unknown"),
          title: stringValue(value.error.title, "BoardState error"),
          message: stringValue(value.error.message, ""),
          retryable: value.error.retryable === true,
          technicalDetail: stringValue(value.error.technicalDetail) || undefined,
        }
      : undefined,
  };

  const calculatedChecksum = checksumObject({
    responseId: response.responseId,
    requestId: response.requestId,
    deckSnapshotChecksum: response.deckSnapshotChecksum,
    validationStatus: response.validationStatus,
    legalityStatus: response.legalityStatus,
    issues: response.issues,
    warnings: response.warnings,
    unsupportedChecks: response.unsupportedChecks,
    authorityRulesVersion: response.authorityRulesVersion,
  });

  if (response.resultChecksum && response.resultChecksum !== calculatedChecksum) {
    throw new BoardStateBridgeError({
      code: "malformed_response",
      message: "BoardState response checksum did not match its structured result.",
    });
  }

  return {
    ...response,
    resultChecksum: response.resultChecksum ?? calculatedChecksum,
  };
}
