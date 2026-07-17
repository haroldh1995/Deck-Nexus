import { defaultAppSettings } from "../../data/defaults";
import type { AppSettings } from "../../types/domain";
import { createHubCompatibilityMetadata, createHubVersionMetadata } from "./metadata";
import type {
  HubBackupContract,
  HubBackupProviderId,
  HubBackupProviderStatus,
} from "./contracts";

const localProviders: HubBackupProviderStatus[] = [
  {
    providerId: "local_file",
    label: "Local file",
    configured: true,
    verified: true,
    available: true,
    localOnly: true,
    status: "active",
    reason: "Deck Nexus can export and restore local backup files.",
  },
  {
    providerId: "json",
    label: "JSON",
    configured: true,
    verified: true,
    available: true,
    localOnly: true,
    status: "active",
    reason: "Deck Nexus JSON export remains local and user-controlled.",
  },
  {
    providerId: "zip",
    label: "ZIP",
    configured: true,
    verified: true,
    available: true,
    localOnly: true,
    status: "active",
    reason: "Deck Nexus ecosystem package export remains local.",
  },
];

const futureCloudProviders: HubBackupProviderStatus[] = [
  "google_drive",
  "icloud",
  "dropbox",
  "onedrive",
  "github",
].map((providerId) => ({
  providerId: providerId as HubBackupProviderId,
  label: providerId
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase()),
  configured: false,
  verified: false,
  available: false,
  localOnly: false,
  status: "not_connected" as const,
  reason: "Provider setup is not connected. Hub or provider authorization is required later.",
}));

export function getBackupAdapterStatus(
  settings: AppSettings = defaultAppSettings,
  createdAt = settings.updatedAt,
): HubBackupContract {
  return {
    ...createHubVersionMetadata(createdAt),
    providers: [...localProviders, ...futureCloudProviders],
    centralBackupAvailable: false,
    activeLocalProviders: localProviders.map((provider) => provider.providerId),
    compatibility: createHubCompatibilityMetadata(),
  };
}
