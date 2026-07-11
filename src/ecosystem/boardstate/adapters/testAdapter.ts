import { checksumObject } from "../../export";
import { createId, nowIso } from "../../../utils/ids";
import type { BoardStateValidationIssueRecord } from "../../../types/domain";
import {
  BOARDSTATE_AUTHORITY_APPLICATION,
  BOARDSTATE_COMPATIBILITY_VERSION,
  BOARDSTATE_REQUEST_SCHEMA_VERSION,
  BOARDSTATE_RESPONSE_SCHEMA_VERSION,
  defaultBoardStateValidationModes,
  type BoardStateCapabilities,
  type BoardStateTransport,
  type BoardStateValidationRequest,
  type BoardStateValidationResponse,
} from "../contracts/validationContracts";
import { BoardStateBridgeError } from "../errors/boardStateErrors";

export type BoardStateTestScenario =
  | "legal"
  | "illegal"
  | "warning"
  | "unsupported"
  | "timeout"
  | "malformed_response"
  | "incompatible_schema"
  | "checksum_mismatch"
  | "network_failure";

function issue(
  request: BoardStateValidationRequest,
  severity: BoardStateValidationIssueRecord["severity"],
): BoardStateValidationIssueRecord {
  return {
    issueId: `test-issue:${request.requestId}:${severity}`,
    code: severity === "error" ? "singleton_violation" : "test_warning",
    severity,
    category: severity === "error" ? "singleton" : "format",
    title: severity === "error" ? "Singleton issue" : "Rules warning",
    message:
      severity === "error"
        ? "<img src=x onerror=alert(1)> Test adapter found a duplicate nonbasic card."
        : "Test adapter warning for display and accessibility.",
    affectedCardIds: request.deckSnapshot.mainDeck.slice(0, 1).map((card) => card.id),
    affectedOracleIds: request.deckSnapshot.mainDeck.slice(0, 1).map((card) => card.oracleId),
    affectedScryfallIds: request.deckSnapshot.mainDeck.slice(0, 1).map((card) => card.scryfallId),
    affectedSections: ["main"],
    commanderRelated: false,
    rulesReference: "Test adapter only",
    suggestedActionType: "view_affected_card",
    authoritative: false,
    sourceAuthority: "boardstate_test_adapter",
    metadata: {},
  };
}

function createResponse(
  request: BoardStateValidationRequest,
  scenario: BoardStateTestScenario,
): BoardStateValidationResponse {
  const isIllegal = scenario === "illegal";
  const isWarning = scenario === "warning";
  const isUnsupported = scenario === "unsupported";
  const response: BoardStateValidationResponse = {
    responseId: createId("boardstate-test-response"),
    responseSchemaVersion: BOARDSTATE_RESPONSE_SCHEMA_VERSION,
    requestId: request.requestId,
    validatedAt: nowIso(),
    authorityApplication: BOARDSTATE_AUTHORITY_APPLICATION,
    authorityApplicationVersion: "boardstate-test-adapter",
    authorityRulesVersion: "test-rules-v1",
    authorityCompatibilityVersion: BOARDSTATE_COMPATIBILITY_VERSION,
    deckSnapshotId: request.deckSnapshotId,
    deckSnapshotVersion: request.deckSnapshotVersion,
    deckSnapshotChecksum:
      scenario === "checksum_mismatch"
        ? `${request.deckSnapshotChecksum}:mismatch`
        : request.deckSnapshotChecksum,
    validationStatus: isIllegal
      ? "invalid"
      : isWarning
        ? "valid_with_warnings"
        : isUnsupported
          ? "unsupported"
          : "valid",
    legalityStatus: isIllegal
      ? "illegal"
      : isWarning
        ? "legal_with_warnings"
        : isUnsupported
          ? "unknown"
          : "legal",
    format: request.deckFormat,
    commanderConfigurationStatus: isUnsupported ? "unsupported" : "valid",
    issues: isIllegal ? [issue(request, "error")] : [],
    warnings: isWarning ? [issue(request, "warning")] : [],
    informationalFindings: [],
    unsupportedChecks: isUnsupported ? ["special_card_rules"] : [],
    capabilitiesUsed: request.requestedValidationModes,
    transportMetadata: {
      transportType: "test_adapter",
      testOnly: true,
      responseTimeMs: 1,
    },
  };
  return {
    ...response,
    resultChecksum: checksumObject({
      responseId: response.responseId,
      requestId: response.requestId,
      deckSnapshotChecksum: response.deckSnapshotChecksum,
      validationStatus: response.validationStatus,
      legalityStatus: response.legalityStatus,
      issues: response.issues,
      warnings: response.warnings,
      unsupportedChecks: response.unsupportedChecks,
      authorityRulesVersion: response.authorityRulesVersion,
    }),
  };
}

export function createBoardStateTestAdapter(
  scenario: BoardStateTestScenario = "legal",
): BoardStateTransport {
  return {
    transportType: "test_adapter",
    testOnly: true,
    async getStatus() {
      return {
        state: "compatible",
        message: "BoardState test adapter is active for automated tests only.",
        transportType: "test_adapter",
        authoritativeAvailable: false,
        testOnly: true,
      };
    },
    async getCapabilities(): Promise<BoardStateCapabilities> {
      if (scenario === "incompatible_schema") {
        return {
          authorityApplication: BOARDSTATE_AUTHORITY_APPLICATION,
          authorityApplicationVersion: "boardstate-test-adapter",
          authorityCompatibilityVersion: BOARDSTATE_COMPATIBILITY_VERSION,
          authorityRulesVersion: "test-rules-v1",
          supportedRequestSchemaVersions: ["unsupported"],
          supportedResponseSchemaVersions: ["unsupported"],
          supportedSnapshotSchemaVersions: ["unsupported"],
          supportedFormats: [],
          supportedValidationModes: [],
          transportCapabilities: ["test_adapter"],
        };
      }
      return {
        authorityApplication: BOARDSTATE_AUTHORITY_APPLICATION,
        authorityApplicationVersion: "boardstate-test-adapter",
        authorityCompatibilityVersion: BOARDSTATE_COMPATIBILITY_VERSION,
        authorityRulesVersion: "test-rules-v1",
        supportedRequestSchemaVersions: [BOARDSTATE_REQUEST_SCHEMA_VERSION],
        supportedResponseSchemaVersions: [BOARDSTATE_RESPONSE_SCHEMA_VERSION],
        supportedSnapshotSchemaVersions: [requestSnapshotSchemaVersion],
        supportedFormats: ["commander"],
        supportedValidationModes: defaultBoardStateValidationModes,
        transportCapabilities: ["test_adapter"],
      };
    },
    async validateDeckSnapshot(request: BoardStateValidationRequest) {
      if (scenario === "timeout") {
        throw new BoardStateBridgeError({
          code: "timeout",
          message: "Test timeout.",
          retryable: true,
        });
      }
      if (scenario === "network_failure") {
        throw new BoardStateBridgeError({
          code: "transport_error",
          message: "Test network failure.",
          retryable: true,
        });
      }
      if (scenario === "malformed_response") {
        return { invalid: true } as unknown as BoardStateValidationResponse;
      }
      if (scenario === "incompatible_schema") {
        return {
          ...createResponse(request, "legal"),
          responseSchemaVersion: "unsupported" as typeof BOARDSTATE_RESPONSE_SCHEMA_VERSION,
        };
      }
      return createResponse(request, scenario);
    },
  };
}

const requestSnapshotSchemaVersion = "deck-nexus.snapshot.schema.v1";
