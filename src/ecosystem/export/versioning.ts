import {
  CURRENT_COMPATIBILITY_VERSION,
  CURRENT_EXPORT_VERSION,
  CURRENT_SCHEMA_VERSION,
  CURRENT_SNAPSHOT_VERSION,
  type MigrationMetadata,
} from "./schemas";

export interface ImportCompatibilityInput {
  schemaVersion?: string;
  snapshotVersion?: string;
  exportVersion?: string;
  applicationVersion?: string;
}

export interface ImportCompatibilityResult extends MigrationMetadata {
  snapshotVersionStatus: "current" | "older_supported" | "future_unsupported" | "unknown";
  exportVersionStatus: "current" | "older_supported" | "future_unsupported" | "unknown";
  applicationVersion?: string;
}

function classifyVersion(
  value: string | undefined,
  current: string,
): "current" | "older_supported" | "future_unsupported" | "unknown" {
  if (!value) {
    return "unknown";
  }

  if (value === current) {
    return "current";
  }

  if (value.startsWith(current.replace(/v\d+$/, ""))) {
    const currentNumber = Number(current.match(/v(\d+)$/)?.[1] ?? 0);
    const incomingNumber = Number(value.match(/v(\d+)$/)?.[1] ?? Number.NaN);
    if (Number.isFinite(incomingNumber)) {
      return incomingNumber < currentNumber
        ? "older_supported"
        : "future_unsupported";
    }
  }

  return "unknown";
}

export function getCurrentSchemaVersions() {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    snapshotVersion: CURRENT_SNAPSHOT_VERSION,
    exportVersion: CURRENT_EXPORT_VERSION,
    compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
  };
}

export function evaluateImportCompatibility(
  input: ImportCompatibilityInput,
): ImportCompatibilityResult {
  const schemaStatus = classifyVersion(input.schemaVersion, CURRENT_SCHEMA_VERSION);
  const snapshotVersionStatus = classifyVersion(
    input.snapshotVersion,
    CURRENT_SNAPSHOT_VERSION,
  );
  const exportVersionStatus = classifyVersion(
    input.exportVersion,
    CURRENT_EXPORT_VERSION,
  );
  const futureUnsupported = [schemaStatus, snapshotVersionStatus, exportVersionStatus]
    .includes("future_unsupported");
  const unknown = [schemaStatus, snapshotVersionStatus, exportVersionStatus]
    .includes("unknown");
  const older = [schemaStatus, snapshotVersionStatus, exportVersionStatus]
    .includes("older_supported");
  const migrationStatus = futureUnsupported
    ? "future_unsupported"
    : unknown
      ? "unknown"
      : older
        ? "older_supported"
        : "current";

  return {
    migrationRequired: migrationStatus !== "current",
    migrationStatus,
    sourceSchemaVersion: input.schemaVersion,
    targetSchemaVersion: CURRENT_SCHEMA_VERSION,
    snapshotVersionStatus,
    exportVersionStatus,
    applicationVersion: input.applicationVersion,
    notes:
      migrationStatus === "current"
        ? ["Schema is current."]
        : migrationStatus === "older_supported"
          ? ["Older schema detected; non-destructive migration may be required."]
          : migrationStatus === "future_unsupported"
            ? ["Future schema detected; update Deck Nexus before importing."]
            : ["Schema version is missing or unknown; preserve as legacy data."],
  };
}

export function createCurrentMigrationMetadata(): MigrationMetadata {
  return {
    migrationRequired: false,
    migrationStatus: "current",
    targetSchemaVersion: CURRENT_SCHEMA_VERSION,
    notes: ["Schema is current."],
  };
}
