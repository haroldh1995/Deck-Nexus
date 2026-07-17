import type { AppSettings } from "../../types/domain";
import { getAppLinkStatus } from "./appLinkAdapter";
import { getBackupAdapterStatus } from "./backupAdapter";
import type {
  HubCapabilityContract,
  HubCapabilityId,
  HubStatusSection,
} from "./contracts";
import { getFriendAdapterStatus } from "./friendAdapter";
import { createHubVersionMetadata } from "./metadata";
import { getNotificationAdapterStatus } from "./notificationAdapter";
import { getProfileAdapterStatus, loadLocalProfile } from "./profileAdapter";

function capability(
  capabilityId: HubCapabilityId,
  label: string,
  summary: string,
  values: Omit<
    HubCapabilityContract,
    | "capabilityId"
    | "label"
    | "summary"
    | keyof ReturnType<typeof createHubVersionMetadata>
  >,
  createdAt?: string,
): HubCapabilityContract {
  return {
    ...createHubVersionMetadata(createdAt),
    capabilityId,
    label,
    summary,
    ...values,
  };
}

export function getHubCapabilityRegistry(settings?: AppSettings): HubCapabilityContract[] {
  const profile = loadLocalProfile(settings);
  const backup = getBackupAdapterStatus(settings);
  const boardStateLink = getAppLinkStatus("boardstate");

  return [
    capability("deck_building", "Deck building", "Deck Nexus local deck editing is active.", {
      supported: true,
      configured: true,
      verified: true,
      available: true,
      localOnly: true,
      planned: false,
      disabled: false,
      currentOwner: "deck_nexus",
      futureOwner: "deck_nexus",
      status: "active",
    }),
    capability("collection", "Collection", "Owned cards and scanner data remain local-first.", {
      supported: true,
      configured: true,
      verified: true,
      available: true,
      localOnly: true,
      planned: false,
      disabled: false,
      currentOwner: "deck_nexus",
      futureOwner: "deck_nexus",
      status: "active",
    }),
    capability("profile", "Profile", getProfileAdapterStatus(), {
      supported: true,
      configured: true,
      verified: true,
      available: true,
      localOnly: true,
      planned: true,
      disabled: false,
      currentOwner: "deck_nexus",
      futureOwner: "hub",
      status: profile.hubIdentity === null ? "local_only" : "requires_setup",
    }),
    capability("friends", "Friends", getFriendAdapterStatus().reason, {
      supported: false,
      configured: false,
      verified: false,
      available: false,
      localOnly: false,
      planned: true,
      disabled: false,
      currentOwner: "hub",
      futureOwner: "hub",
      status: "planned",
    }),
    capability("notifications", "Notifications", getNotificationAdapterStatus().reason, {
      supported: false,
      configured: false,
      verified: false,
      available: false,
      localOnly: true,
      planned: true,
      disabled: false,
      currentOwner: "hub",
      futureOwner: "hub",
      status: "planned",
    }),
    capability("backup", "Backup", "Local backup/export is active; central Hub backup is unavailable.", {
      supported: true,
      configured: true,
      verified: backup.activeLocalProviders.length > 0,
      available: backup.activeLocalProviders.length > 0,
      localOnly: true,
      planned: true,
      disabled: false,
      currentOwner: "deck_nexus",
      futureOwner: "hub",
      status: "local_only",
    }),
    capability("boardstate", "BoardState", "BoardState contracts exist; live authority still requires a real bridge.", {
      supported: true,
      configured: false,
      verified: false,
      available: false,
      localOnly: false,
      planned: true,
      disabled: false,
      currentOwner: "boardstate",
      futureOwner: "boardstate",
      status: "requires_setup",
    }),
    capability("advanced_gameplay", "Advanced Gameplay", "Deck Nexus prepares envelopes; BoardState gameplay remains unavailable here.", {
      supported: true,
      configured: false,
      verified: false,
      available: false,
      localOnly: false,
      planned: true,
      disabled: false,
      currentOwner: "boardstate",
      futureOwner: "boardstate",
      status: "requires_setup",
    }),
    capability("dry_run", "Dry Run", "Deck Nexus prepares Dry Run envelopes without running simulations.", {
      supported: true,
      configured: false,
      verified: false,
      available: false,
      localOnly: false,
      planned: true,
      disabled: false,
      currentOwner: "boardstate",
      futureOwner: "boardstate",
      status: "requires_setup",
    }),
    capability("scanner", "Scanner", "Deck Nexus scanner behavior remains local.", {
      supported: true,
      configured: true,
      verified: true,
      available: true,
      localOnly: true,
      planned: false,
      disabled: false,
      currentOwner: "deck_nexus",
      futureOwner: "deck_nexus",
      status: "active",
    }),
    capability("export", "Export", "Deck Nexus exports canonical local data and BoardState packages.", {
      supported: true,
      configured: true,
      verified: true,
      available: true,
      localOnly: true,
      planned: false,
      disabled: false,
      currentOwner: "deck_nexus",
      futureOwner: "deck_nexus",
      status: "active",
    }),
    capability("import", "Import", "Deck Nexus import remains local and does not depend on Hub.", {
      supported: true,
      configured: true,
      verified: true,
      available: true,
      localOnly: true,
      planned: false,
      disabled: false,
      currentOwner: "deck_nexus",
      futureOwner: "deck_nexus",
      status: "active",
    }),
    capability("cloud_sync", "Cloud sync", "Hub cloud sync is not connected.", {
      supported: false,
      configured: false,
      verified: false,
      available: false,
      localOnly: false,
      planned: true,
      disabled: false,
      currentOwner: "hub",
      futureOwner: "hub",
      status: "planned",
    }),
    capability("app_launch", "App launch", boardStateLink.reason, {
      supported: true,
      configured: boardStateLink.configured,
      verified: boardStateLink.verified,
      available: boardStateLink.launchAvailable,
      localOnly: !boardStateLink.launchAvailable,
      planned: true,
      disabled: false,
      currentOwner: "deck_nexus",
      futureOwner: "hub",
      status: boardStateLink.status === "requires_setup" ? "requires_setup" : "local_only",
    }),
    capability("return_callbacks", "Return callbacks", "Return parsing exists; no Hub callback route is connected.", {
      supported: true,
      configured: false,
      verified: false,
      available: false,
      localOnly: false,
      planned: true,
      disabled: false,
      currentOwner: "deck_nexus",
      futureOwner: "hub",
      status: "requires_setup",
    }),
  ];
}

export function hasVerifiedHubConnection(settings?: AppSettings): boolean {
  return getHubCapabilityRegistry(settings).some(
    (capability) =>
      capability.futureOwner === "hub" &&
      capability.verified &&
      capability.available &&
      !capability.localOnly,
  );
}

export function getEcosystemStatusSections(settings?: AppSettings): HubStatusSection[] {
  const profile = loadLocalProfile(settings);
  const friends = getFriendAdapterStatus();
  const notifications = getNotificationAdapterStatus();
  const backup = getBackupAdapterStatus(settings);
  const boardStateLink = getAppLinkStatus("boardstate");
  const hubLink = getAppLinkStatus("hub");

  return [
    {
      id: "deck_nexus",
      label: "Deck Nexus",
      status: "Active",
      capability: "Decks, collection, scanner, search, analytics, snapshots",
      availability: "Local",
      verification: "Verified local",
      currentOwner: "Deck Nexus",
      futureOwner: "Deck Nexus",
    },
    {
      id: "boardstate",
      label: "BoardState",
      status: "Bridge required",
      capability: "Validation, Advanced Gameplay, Dry Run",
      availability: boardStateLink.reason,
      verification: "Not verified by a live BoardState acknowledgment",
      currentOwner: "BoardState",
      futureOwner: "BoardState",
    },
    {
      id: "hub",
      label: "Hub",
      status: "Awaiting Hub",
      capability: "Identity, friends, notifications, routing, central backup",
      availability: hubLink.reason,
      verification: "Not verified",
      currentOwner: "Hub",
      futureOwner: "Hub",
    },
    {
      id: "profile",
      label: "Profile",
      status: "Local profile only",
      capability: "Appearance, accessibility, scanner and backup preferences",
      availability: profile.hubIdentity === null ? "Local only" : "Requires review",
      verification: "Verified local; no Hub identity",
      currentOwner: "Deck Nexus",
      futureOwner: "Hub",
    },
    {
      id: "friends",
      label: "Friends",
      status: "Unavailable",
      capability: "Future friend requests, shared permissions, presence",
      availability: friends.reason,
      verification: "Not verified",
      currentOwner: "Hub",
      futureOwner: "Hub",
    },
    {
      id: "notifications",
      label: "Notifications",
      status: "Local only",
      capability: "Local in-app status messages; future Hub events",
      availability: notifications.reason,
      verification: "No remote notifications",
      currentOwner: "Deck Nexus local UI",
      futureOwner: "Hub",
    },
    {
      id: "backup",
      label: "Backup",
      status: "Local backup active",
      capability: backup.providers
        .filter((provider) => provider.available)
        .map((provider) => provider.label)
        .join(", "),
      availability: "Cloud providers require setup and are not connected",
      verification: "Verified local backup/export only",
      currentOwner: "Deck Nexus",
      futureOwner: "Hub",
    },
    {
      id: "app_links",
      label: "App Links",
      status: "Local fallback",
      capability: "BoardState file/manual handoff and future Hub orchestration",
      availability: boardStateLink.reason,
      verification: "Direct external launch is not verified",
      currentOwner: "Deck Nexus",
      futureOwner: "Hub",
    },
  ];
}
