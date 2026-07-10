export type EcosystemAppId = "deck_nexus" | "boardstate" | "hub";

export type LinkedAppStatus =
  | "not_configured"
  | "planned"
  | "local_ready"
  | "export_ready"
  | "bridge_required"
  | "export_not_yet_implemented"
  | "connected"
  | "error";

export type DeckNexusCapability =
  | "local_deck_builder"
  | "local_collection_manager"
  | "local_card_search"
  | "local_scanner"
  | "local_deck_analysis"
  | "local_backup_restore"
  | "canonical_snapshot_export"
  | "collection_snapshot_export"
  | "profile_snapshot_export"
  | "future_snapshot_source";

export interface LinkedAppReadiness {
  appId: EcosystemAppId;
  label: string;
  status: LinkedAppStatus;
  summary: string;
  capabilities: DeckNexusCapability[];
}

export interface BoardStateBridgeStatus {
  appId: "boardstate";
  status: Exclude<LinkedAppStatus, "connected">;
  rulesAuthority: "boardstate";
  snapshotExportImplemented: boolean;
  liveValidationImplemented: false;
}

export interface HubAdapterStatus {
  appId: "hub";
  status: Exclude<LinkedAppStatus, "connected">;
  localProfileOnly: true;
  friendsImplemented: false;
  notificationsImplemented: false;
}

export interface SnapshotReadinessStatus {
  status: "not_started" | "schema_audit_complete" | "export_ready";
  immutableSnapshotsImplemented: boolean;
  schemaVersion?: string;
}
