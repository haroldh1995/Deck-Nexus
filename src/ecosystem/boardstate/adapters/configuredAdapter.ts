import { getBoardStateBridgeConfig } from "../config/boardStateConfig";
import type { BoardStateTransport } from "../contracts/validationContracts";
import { createBoardStateHttpAdapter } from "./httpAdapter";
import { createUnavailableBoardStateAdapter } from "./unavailableAdapter";

export function createConfiguredBoardStateTransport(): BoardStateTransport {
  const config = getBoardStateBridgeConfig();

  if (!config.enabled || !config.endpoint) {
    return createUnavailableBoardStateAdapter(
      "BoardState validation is not connected. Configure a BoardState bridge endpoint to enable authoritative validation.",
    );
  }

  if (
    config.transportType === "http_endpoint" ||
    config.transportType === "same_origin_endpoint"
  ) {
    return createBoardStateHttpAdapter(config);
  }

  return createUnavailableBoardStateAdapter(
    "The configured BoardState transport is not supported in this Deck Nexus build.",
  );
}
