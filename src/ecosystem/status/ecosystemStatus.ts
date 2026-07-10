import type {
  BoardStateBridgeStatus,
  HubAdapterStatus,
  LinkedAppReadiness,
  SnapshotReadinessStatus,
} from "../contracts/ecosystemContracts";
import { CURRENT_SCHEMA_VERSION } from "../export";

export const boardStateBridgeStatus: BoardStateBridgeStatus = {
  appId: "boardstate",
  status: "bridge_required",
  rulesAuthority: "boardstate",
  snapshotExportImplemented: true,
  liveValidationImplemented: false,
};

export const hubAdapterStatus: HubAdapterStatus = {
  appId: "hub",
  status: "planned",
  localProfileOnly: true,
  friendsImplemented: false,
  notificationsImplemented: false,
};

export const snapshotReadinessStatus: SnapshotReadinessStatus = {
  status: "export_ready",
  immutableSnapshotsImplemented: false,
  schemaVersion: CURRENT_SCHEMA_VERSION,
};

export function getEcosystemReadinessStatus(): LinkedAppReadiness[] {
  return [
    {
      appId: "deck_nexus",
      label: "Deck Nexus",
      status: "local_ready",
      summary:
        "Local deck building, collection tracking, scanner, search, and analytics remain active.",
      capabilities: [
        "local_deck_builder",
        "local_collection_manager",
        "local_card_search",
        "local_scanner",
        "local_deck_analysis",
        "local_backup_restore",
        "canonical_snapshot_export",
        "collection_snapshot_export",
        "profile_snapshot_export",
        "future_snapshot_source",
      ],
    },
    {
      appId: "boardstate",
      label: "BoardState",
      status: boardStateBridgeStatus.status,
      summary:
        "Snapshot exports are locally ready. BoardState bridge validation is not connected yet.",
      capabilities: ["future_snapshot_source"],
    },
    {
      appId: "hub",
      label: "Hub",
      status: hubAdapterStatus.status,
      summary:
        "Hub is not connected yet. Deck Nexus currently uses local profile and settings only.",
      capabilities: [],
    },
  ];
}

export function hasLiveExternalEcosystemConnection(): boolean {
  return getEcosystemReadinessStatus().some(
    (status) => status.appId !== "deck_nexus" && status.status === "connected",
  );
}
