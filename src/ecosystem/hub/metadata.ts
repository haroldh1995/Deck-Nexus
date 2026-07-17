import {
  CURRENT_COMPATIBILITY_VERSION,
  CURRENT_EXPORT_VERSION,
  CURRENT_SCHEMA_VERSION,
  DECK_NEXUS_APPLICATION_VERSION,
} from "../export";
import {
  HUB_CONTRACT_VERSION,
  HUB_MIGRATION_VERSION,
  type HubCompatibilityMetadata,
  type HubVersionMetadata,
} from "./contracts";

export function createHubVersionMetadata(createdAt = new Date().toISOString()): HubVersionMetadata {
  return {
    contractVersion: HUB_CONTRACT_VERSION,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportVersion: CURRENT_EXPORT_VERSION,
    compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
    migrationVersion: HUB_MIGRATION_VERSION,
    sourceApplication: "deck_nexus",
    sourceApplicationVersion: DECK_NEXUS_APPLICATION_VERSION,
    createdAt,
    updatedAt: createdAt,
  };
}

export function createHubCompatibilityMetadata(): HubCompatibilityMetadata {
  return {
    hubAvailable: false,
    hubIdentityLinked: false,
    friendsLinked: false,
    notificationsLinked: false,
    centralBackupLinked: false,
    appRoutingLinked: false,
    migration: {
      migrationRequired: false,
      migrationStatus: "current",
      targetVersion: HUB_CONTRACT_VERSION,
      notes: ["Hub runtime is not connected; Deck Nexus data remains local-first."],
    },
  };
}
