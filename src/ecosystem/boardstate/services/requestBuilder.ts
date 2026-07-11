import { createId, nowIso } from "../../../utils/ids";
import {
  BOARDSTATE_AUTHORITY_APPLICATION,
  BOARDSTATE_COMPATIBILITY_VERSION,
  BOARDSTATE_REQUEST_SCHEMA_VERSION,
  defaultBoardStateValidationModes,
  type BoardStateClientCapabilities,
  type BoardStateValidationMode,
  type BoardStateValidationRequest,
} from "../contracts/validationContracts";
import {
  CURRENT_SCHEMA_VERSION,
  CURRENT_SNAPSHOT_VERSION,
  CURRENT_COMPATIBILITY_VERSION,
  DECK_NEXUS_APPLICATION_VERSION,
  type DeckSnapshot,
} from "../../export";
import { BoardStateBridgeError } from "../errors/boardStateErrors";

export interface BoardStateValidationRequestOptions {
  requestId?: string;
  createdAt?: string;
  validationModes?: BoardStateValidationMode[];
  locale?: string;
  correlationId?: string;
}

export function createBoardStateClientCapabilities(
  validationModes: readonly BoardStateValidationMode[] = defaultBoardStateValidationModes,
): BoardStateClientCapabilities {
  return {
    supportedRequestSchemaVersions: [BOARDSTATE_REQUEST_SCHEMA_VERSION],
    supportedResponseSchemaVersions: ["boardstate.validation.response.v1"],
    supportedSnapshotSchemaVersions: [CURRENT_SCHEMA_VERSION],
    supportedValidationModes: [...validationModes],
    canReceiveStructuredIssues: true,
    gameplayStateIncluded: false,
    collectionDataIncluded: false,
    profileDataIncluded: false,
  };
}

export function assertDeckSnapshotReadyForBoardState(snapshot: DeckSnapshot): void {
  if (!snapshot.snapshotId || !snapshot.deckId || !snapshot.deckName) {
    throw new BoardStateBridgeError({
      code: "invalid_request",
      message: "Deck snapshot is missing required identifiers.",
    });
  }

  if (!snapshot.checksum) {
    throw new BoardStateBridgeError({
      code: "invalid_request",
      message: "Deck snapshot is missing a checksum.",
    });
  }

  if (snapshot.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new BoardStateBridgeError({
      code: "incompatible_schema",
      message: "Deck snapshot schema is not supported by this Deck Nexus bridge.",
    });
  }

  if (snapshot.snapshotVersion !== CURRENT_SNAPSHOT_VERSION) {
    throw new BoardStateBridgeError({
      code: "incompatible_schema",
      message: "Deck snapshot version is not supported by this Deck Nexus bridge.",
    });
  }

  if (snapshot.format !== "commander") {
    throw new BoardStateBridgeError({
      code: "unsupported",
      message: "Only Commander snapshots can be submitted to the BoardState bridge.",
    });
  }
}

export function createBoardStateValidationRequest(
  snapshot: DeckSnapshot,
  options: BoardStateValidationRequestOptions = {},
): BoardStateValidationRequest {
  assertDeckSnapshotReadyForBoardState(snapshot);
  const validationModes = options.validationModes ?? defaultBoardStateValidationModes;
  const deckSnapshotChecksum = snapshot.checksum;

  if (!deckSnapshotChecksum) {
    throw new BoardStateBridgeError({
      code: "invalid_request",
      message: "Deck snapshot is missing a checksum.",
    });
  }

  return {
    requestId: options.requestId ?? createId("boardstate-request"),
    requestSchemaVersion: BOARDSTATE_REQUEST_SCHEMA_VERSION,
    requestCreatedAt: options.createdAt ?? nowIso(),
    sourceApplication: "deck_nexus",
    sourceApplicationVersion: DECK_NEXUS_APPLICATION_VERSION,
    sourceCompatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
    requestedAuthority: BOARDSTATE_AUTHORITY_APPLICATION,
    requestedValidationModes: [...validationModes],
    deckSnapshot: snapshot,
    deckSnapshotId: snapshot.snapshotId,
    deckSnapshotVersion: snapshot.snapshotVersion,
    deckSnapshotChecksum,
    deckFormat: snapshot.format,
    rulesEnvironment: "commander",
    clientCapabilities: createBoardStateClientCapabilities(validationModes),
    locale: options.locale,
    correlationId: options.correlationId,
    privacy: {
      ownershipConsideredForLegality: false,
      profileDataIncluded: false,
      collectionSnapshotIncluded: false,
      gameplayStateIncluded: false,
    },
  };
}

export function boardStateBridgeCompatibilityVersion(): string {
  return BOARDSTATE_COMPATIBILITY_VERSION;
}
