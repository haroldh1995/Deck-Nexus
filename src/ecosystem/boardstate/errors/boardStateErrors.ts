import type { BoardStateValidationStatus } from "../../../types/domain";

export type BoardStateBridgeErrorCode =
  | "not_configured"
  | "offline"
  | "timeout"
  | "transport_error"
  | "malformed_response"
  | "incompatible_schema"
  | "checksum_mismatch"
  | "invalid_request"
  | "unauthorized"
  | "blocked_origin"
  | "payload_too_large"
  | "canceled"
  | "unsupported";

const statusByCode: Record<BoardStateBridgeErrorCode, BoardStateValidationStatus> = {
  not_configured: "unavailable",
  offline: "unavailable",
  timeout: "timeout",
  transport_error: "transport_error",
  malformed_response: "malformed_response",
  incompatible_schema: "incompatible_schema",
  checksum_mismatch: "malformed_response",
  invalid_request: "incomplete",
  unauthorized: "transport_error",
  blocked_origin: "transport_error",
  payload_too_large: "unsupported",
  canceled: "canceled",
  unsupported: "unsupported",
};

export class BoardStateBridgeError extends Error {
  readonly code: BoardStateBridgeErrorCode;
  readonly retryable: boolean;
  readonly technicalDetail?: string;

  constructor({
    code,
    message,
    retryable = false,
    technicalDetail,
  }: {
    code: BoardStateBridgeErrorCode;
    message: string;
    retryable?: boolean;
    technicalDetail?: string;
  }) {
    super(message);
    this.name = "BoardStateBridgeError";
    this.code = code;
    this.retryable = retryable;
    this.technicalDetail = technicalDetail;
  }
}

export function toBoardStateBridgeError(error: unknown): BoardStateBridgeError {
  if (error instanceof BoardStateBridgeError) {
    return error;
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return new BoardStateBridgeError({
      code: "canceled",
      message: "BoardState validation was canceled.",
      retryable: true,
      technicalDetail: error.message,
    });
  }

  return new BoardStateBridgeError({
    code: "transport_error",
    message: "BoardState validation transport failed.",
    retryable: true,
    technicalDetail: error instanceof Error ? error.message : String(error),
  });
}

export function mapBoardStateErrorToStatus(
  error: BoardStateBridgeError,
): BoardStateValidationStatus {
  return statusByCode[error.code] ?? "transport_error";
}

export function boardStateErrorUserMessage(error: BoardStateBridgeError): string {
  switch (error.code) {
    case "not_configured":
      return "BoardState validation requires a configured bridge.";
    case "offline":
      return "BoardState validation is unavailable while offline. Local Deck Nexus checks remain available.";
    case "timeout":
      return "BoardState did not respond in time. No legality result was recorded.";
    case "incompatible_schema":
      return "This Deck Nexus snapshot version is not supported by the connected BoardState version.";
    case "malformed_response":
    case "checksum_mismatch":
      return "BoardState returned an unreadable validation response. The result was not saved as authoritative.";
    case "payload_too_large":
      return "This snapshot is larger than the connected BoardState bridge currently supports.";
    case "canceled":
      return "BoardState validation was canceled.";
    default:
      return "BoardState validation is unavailable. Local Deck Nexus checks remain available.";
  }
}
