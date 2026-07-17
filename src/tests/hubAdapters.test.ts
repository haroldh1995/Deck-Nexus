import { describe, expect, it } from "vitest";
import { defaultAppSettings } from "../data/defaults";
import {
  canLaunch,
  compareProfiles,
  exportProfile,
  getAppLinkStatus,
  getBackupAdapterStatus,
  getEcosystemStatusSections,
  getFriendAdapterStatus,
  getHubCapabilityRegistry,
  getNotificationAdapterStatus,
  getProfileAdapterStatus,
  hasVerifiedHubConnection,
  importProfile,
  listFriends,
  loadLocalProfile,
  mergeProfiles,
  prepareHubProfile,
} from "../ecosystem";

describe("Hub compatibility adapters", () => {
  it("exports only a local Deck Nexus profile without Hub identity or authentication", () => {
    const profile = loadLocalProfile(defaultAppSettings, "2026-01-01T00:00:00.000Z");
    const prepared = prepareHubProfile(profile);

    expect(prepared.profileId).toBe("local-profile");
    expect(prepared.hubIdentity).toBeNull();
    expect(prepared.authentication).toBeNull();
    expect(prepared.friends).toEqual([]);
    expect(prepared.notifications).toEqual([]);
    expect(prepared.compatibility.hubIdentityLinked).toBe(false);
    expect(getProfileAdapterStatus()).toMatch(/Local profile only/i);
  });

  it("compares, imports, exports, and refuses automatic profile merges", () => {
    const profile = loadLocalProfile(defaultAppSettings, "2026-01-01T00:00:00.000Z");
    const comparison = compareProfiles(profile, profile);
    const exported = exportProfile(defaultAppSettings);
    const imported = importProfile(profile);
    const merged = mergeProfiles(profile, imported);

    expect(comparison.matches).toBe(true);
    expect(exported.profileSnapshotJson).toContain("local-profile");
    expect(imported.profileId).toBe("local-profile");
    expect(merged.merged).toBe(false);
    expect(merged.reason).toMatch(/does not merge Hub profiles automatically/i);
  });

  it("keeps friends and remote notifications unavailable without fabricated data", () => {
    const friends = getFriendAdapterStatus("2026-01-01T00:00:00.000Z");
    const notifications = getNotificationAdapterStatus("2026-01-01T00:00:00.000Z");

    expect(friends.status).toBe("not_connected");
    expect(friends.friends).toEqual([]);
    expect(friends.onlineStatuses).toEqual([]);
    expect(listFriends()).toEqual([]);
    expect(notifications.remoteNotificationsAvailable).toBe(false);
    expect(notifications.notifications).toEqual([]);
    expect(notifications.reason).toMatch(/Hub notifications are unavailable/i);
  });

  it("reports only existing local backup providers as active", () => {
    const backup = getBackupAdapterStatus(defaultAppSettings, "2026-01-01T00:00:00.000Z");
    const googleDrive = backup.providers.find((provider) => provider.providerId === "google_drive");

    expect(backup.centralBackupAvailable).toBe(false);
    expect(backup.activeLocalProviders).toEqual(["local_file", "json", "zip"]);
    expect(googleDrive?.configured).toBe(false);
    expect(googleDrive?.status).toBe("not_connected");
  });

  it("keeps app links honest and never treats unverified launch paths as launchable", () => {
    const deckNexus = getAppLinkStatus("deck_nexus");
    const boardState = getAppLinkStatus("boardstate", {
      fileDownloadAvailable: true,
      online: true,
    });
    const hub = getAppLinkStatus("hub");

    expect(deckNexus.verified).toBe(true);
    expect(boardState.verified).toBe(false);
    expect(boardState.reason).toMatch(/Direct BoardState launch is unavailable/i);
    expect(canLaunch("boardstate")).toBe(false);
    expect(hub.status).toBe("planned");
    expect(hub.launchAvailable).toBe(false);
  });

  it("builds a capability registry and status surface without live Hub claims", () => {
    const capabilities = getHubCapabilityRegistry(defaultAppSettings);
    const sections = getEcosystemStatusSections(defaultAppSettings);
    const text = JSON.stringify({ capabilities, sections });

    expect(capabilities.find((capability) => capability.capabilityId === "profile")?.localOnly)
      .toBe(true);
    expect(capabilities.find((capability) => capability.capabilityId === "friends")?.available)
      .toBe(false);
    expect(hasVerifiedHubConnection(defaultAppSettings)).toBe(false);
    expect(sections.map((section) => section.id)).toEqual([
      "deck_nexus",
      "boardstate",
      "hub",
      "profile",
      "friends",
      "notifications",
      "backup",
      "app_links",
    ]);
    expect(text).not.toMatch(/Hub connected|Friends online|Notifications active|Cloud profile|Cloud backup active/i);
  });
});
