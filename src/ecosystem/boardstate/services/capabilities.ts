import {
  BOARDSTATE_REQUEST_SCHEMA_VERSION,
  BOARDSTATE_RESPONSE_SCHEMA_VERSION,
  type BoardStateBridgeRuntimeStatus,
  type BoardStateCapabilities,
  type BoardStateValidationRequest,
} from "../contracts/validationContracts";

export interface BoardStateCapabilityMatch {
  compatible: boolean;
  partiallyCompatible: boolean;
  unsupportedReasons: string[];
  supportedModes: string[];
}

export function compareBoardStateCapabilities(
  capabilities: BoardStateCapabilities,
  request: BoardStateValidationRequest,
): BoardStateCapabilityMatch {
  const unsupportedReasons: string[] = [];

  if (!capabilities.supportedRequestSchemaVersions.includes(BOARDSTATE_REQUEST_SCHEMA_VERSION)) {
    unsupportedReasons.push("request_schema");
  }

  if (!capabilities.supportedResponseSchemaVersions.includes(BOARDSTATE_RESPONSE_SCHEMA_VERSION)) {
    unsupportedReasons.push("response_schema");
  }

  if (!capabilities.supportedSnapshotSchemaVersions.includes(request.deckSnapshot.schemaVersion)) {
    unsupportedReasons.push("snapshot_schema");
  }

  if (!capabilities.supportedFormats.includes(request.deckFormat)) {
    unsupportedReasons.push("format");
  }

  const supportedModes = request.requestedValidationModes.filter((mode) =>
    capabilities.supportedValidationModes.includes(mode),
  );

  if (supportedModes.length === 0) {
    unsupportedReasons.push("validation_modes");
  }

  const encodedSize = new TextEncoder().encode(JSON.stringify(request)).byteLength;
  if (
    typeof capabilities.maximumPayloadBytes === "number" &&
    encodedSize > capabilities.maximumPayloadBytes
  ) {
    unsupportedReasons.push("payload_size");
  }

  return {
    compatible: unsupportedReasons.length === 0,
    partiallyCompatible:
      unsupportedReasons.length > 0 &&
      supportedModes.length > 0 &&
      unsupportedReasons.every((reason) => reason !== "request_schema" && reason !== "response_schema"),
    unsupportedReasons,
    supportedModes,
  };
}

export function capabilityMatchToStatus(
  match: BoardStateCapabilityMatch,
  transportType: BoardStateBridgeRuntimeStatus["transportType"],
  testOnly: boolean,
): BoardStateBridgeRuntimeStatus {
  if (match.compatible) {
    return {
      state: "compatible",
      message: "BoardState bridge capabilities are compatible.",
      transportType,
      authoritativeAvailable: !testOnly,
      testOnly,
    };
  }

  if (match.partiallyCompatible) {
    return {
      state: "partially_compatible",
      message: "BoardState bridge supports only part of the requested validation contract.",
      transportType,
      authoritativeAvailable: !testOnly,
      testOnly,
    };
  }

  return {
    state: "incompatible",
    message: "BoardState bridge does not support this Deck Nexus validation contract.",
    transportType,
    authoritativeAvailable: false,
    testOnly,
  };
}
