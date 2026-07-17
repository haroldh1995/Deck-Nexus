import { createHubCompatibilityMetadata, createHubVersionMetadata } from "./metadata";
import type { HubFriendContract } from "./contracts";

export function getFriendAdapterStatus(createdAt = new Date().toISOString()): HubFriendContract {
  return {
    ...createHubVersionMetadata(createdAt),
    status: "not_connected",
    friendRequests: [],
    friends: [],
    blocked: [],
    favorites: [],
    onlineStatuses: [],
    sharedDeckPermissions: [],
    reason: "Hub friends are not connected. Deck Nexus will not fabricate friends, online users, or deck sharing.",
    compatibility: createHubCompatibilityMetadata(),
  };
}

export function listFriends(): [] {
  return [];
}
