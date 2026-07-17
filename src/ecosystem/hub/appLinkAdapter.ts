import type { EcosystemAppId } from "../contracts/ecosystemContracts";
import { getBoardStateTransportCapabilities } from "../crossApp";
import type { BoardStateTransportRuntime } from "../crossApp/contracts";
import { createHubVersionMetadata } from "./metadata";
import type { HubAppLinkContract } from "./contracts";

export function getAppLinkStatus(
  appId: EcosystemAppId,
  runtime?: BoardStateTransportRuntime,
  createdAt = new Date().toISOString(),
): HubAppLinkContract {
  const metadata = createHubVersionMetadata(createdAt);

  if (appId === "deck_nexus") {
    return {
      ...metadata,
      appId,
      label: "Deck Nexus",
      launchAvailable: true,
      returnAvailable: false,
      configured: true,
      verified: true,
      status: "local_only",
      reason: "Deck Nexus local routing is active inside this app.",
    };
  }

  if (appId === "boardstate") {
    const capabilities = getBoardStateTransportCapabilities(0, runtime);
    const fileExport = capabilities.find((capability) => capability.type === "file_export");
    const directWeb = capabilities.find((capability) => capability.type === "direct_web");
    const directConfigured = directWeb?.status === "configured_but_unverified";

    return {
      ...metadata,
      appId,
      label: "BoardState",
      launchAvailable: directConfigured,
      returnAvailable: Boolean(directConfigured && directWeb?.supportsReturn),
      configured: directConfigured,
      verified: false,
      status: directConfigured
        ? "requires_setup"
        : fileExport?.status === "available"
          ? "local_only"
          : "unavailable",
      reason: directConfigured
        ? "A BoardState web URL is configured, but import acknowledgment must verify handoff success."
        : "Direct BoardState launch is unavailable; local file/manual handoff remains available.",
    };
  }

  return {
    ...metadata,
    appId,
    label: "Hub",
    launchAvailable: false,
    returnAvailable: false,
    configured: false,
    verified: false,
    status: "planned",
    reason: "Hub routing is planned for a future prompt and is not connected.",
  };
}

export function canLaunch(appId: EcosystemAppId, runtime?: BoardStateTransportRuntime): boolean {
  const status = getAppLinkStatus(appId, runtime);
  return status.launchAvailable && status.verified;
}
