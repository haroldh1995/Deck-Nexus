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

export function createUnavailableBoardStateAdapter(
  reason = "BoardState validation is not connected.",
): BoardStateTransport {
  return {
    transportType: "unavailable",
    testOnly: false,
    async getStatus() {
      return {
        state: "not_configured",
        message: reason,
        transportType: "unavailable",
        authoritativeAvailable: false,
        testOnly: false,
      };
    },
    async getCapabilities(): Promise<BoardStateCapabilities> {
      throw new BoardStateBridgeError({
        code: "not_configured",
        message: reason,
      });
    },
    async validateDeckSnapshot(
      request: BoardStateValidationRequest,
    ): Promise<BoardStateValidationResponse> {
      void request;
      throw new BoardStateBridgeError({
        code: "not_configured",
        message: reason,
      });
    },
  };
}

export function createUnavailableBoardStateCapabilities(): BoardStateCapabilities {
  return {
    authorityApplication: BOARDSTATE_AUTHORITY_APPLICATION,
    authorityApplicationVersion: "unavailable",
    authorityCompatibilityVersion: BOARDSTATE_COMPATIBILITY_VERSION,
    authorityRulesVersion: "unavailable",
    supportedRequestSchemaVersions: [BOARDSTATE_REQUEST_SCHEMA_VERSION],
    supportedResponseSchemaVersions: [BOARDSTATE_RESPONSE_SCHEMA_VERSION],
    supportedSnapshotSchemaVersions: [],
    supportedFormats: [],
    supportedValidationModes: defaultBoardStateValidationModes,
    transportCapabilities: ["unavailable"],
  };
}
