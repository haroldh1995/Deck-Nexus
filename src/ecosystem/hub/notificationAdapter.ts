import { createHubCompatibilityMetadata, createHubVersionMetadata } from "./metadata";
import type { HubNotificationContract } from "./contracts";

const futureNotificationTypes = [
  "friend_request",
  "deck_shared",
  "boardstate_validation_complete",
  "advanced_gameplay_finished",
  "dry_run_finished",
  "backup_completed",
  "backup_failed",
  "app_update_available",
];

export function getNotificationAdapterStatus(
  createdAt = new Date().toISOString(),
): HubNotificationContract {
  return {
    ...createHubVersionMetadata(createdAt),
    status: "local_only",
    remoteNotificationsAvailable: false,
    localInAppStatusOnly: true,
    notifications: [],
    possibleFutureTypes: futureNotificationTypes,
    reason: "Deck Nexus currently has local in-app status messages only. Hub notifications are unavailable.",
    compatibility: createHubCompatibilityMetadata(),
  };
}
