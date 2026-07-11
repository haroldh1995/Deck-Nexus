import { render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { SettingsProvider } from "../app/SettingsContext";
import { resetDatabaseForTests } from "../db/database";
import { beforeEach, describe, expect, it } from "vitest";
import {
  boardStateBridgeStatus,
  getEcosystemReadinessStatus,
  hasLiveExternalEcosystemConnection,
  hubAdapterStatus,
  snapshotReadinessStatus,
} from "../ecosystem";
import { SettingsScreen } from "../features/settings/SettingsScreen";

const ecosystemDocs = import.meta.glob("../../docs/ecosystem/*.md", {
  eager: true,
  query: "?raw",
  import: "default",
});

describe("ecosystem readiness preparation", () => {
  beforeEach(async () => {
    await resetDatabaseForTests();
  });

  it("reports Deck Nexus as local-ready without claiming live external links", () => {
    const statuses = getEcosystemReadinessStatus();

    expect(statuses.find((status) => status.appId === "deck_nexus")?.status)
      .toBe("local_ready");
    expect(statuses.find((status) => status.appId === "boardstate")?.status)
      .not.toBe("connected");
    expect(statuses.find((status) => status.appId === "hub")?.status)
      .not.toBe("connected");
    expect(hasLiveExternalEcosystemConnection()).toBe(false);
  });

  it("keeps future BoardState, Hub, and snapshot work honest", () => {
    expect(boardStateBridgeStatus.liveValidationImplemented).toBe(false);
    expect(boardStateBridgeStatus.snapshotExportImplemented).toBe(true);
    expect(hubAdapterStatus.localProfileOnly).toBe(true);
    expect(hubAdapterStatus.friendsImplemented).toBe(false);
    expect(hubAdapterStatus.notificationsImplemented).toBe(false);
    expect(snapshotReadinessStatus.immutableSnapshotsImplemented).toBe(false);
    expect(snapshotReadinessStatus.status).toBe("export_ready");
  });

  it("keeps the ecosystem audit documentation in the repository", () => {
    expect(Object.keys(ecosystemDocs)).toEqual(
      expect.arrayContaining([
        "../../docs/ecosystem/deck-nexus-current-state.md",
        "../../docs/ecosystem/boardstate-contracts.md",
        "../../docs/ecosystem/boardstate-status-and-errors.md",
        "../../docs/ecosystem/boardstate-validation-bridge.md",
        "../../docs/ecosystem/export-contracts.md",
        "../../docs/ecosystem/ownership-boundaries.md",
        "../../docs/ecosystem/integration-risk-register.md",
        "../../docs/ecosystem/implementation-sequence.md",
        "../../docs/ecosystem/schema-reference.md",
        "../../docs/ecosystem/versioning.md",
      ]),
    );
  });

  it("shows honest ecosystem readiness copy in Settings", async () => {
    render(
      createElement(
        SettingsProvider,
        null,
        createElement(SettingsScreen),
      ),
    );

    await waitFor(() =>
      expect(screen.getByText("Ecosystem Readiness")).toBeVisible(),
    );
    expect(screen.getByText(/BoardState will remain the rules authority/))
      .toBeVisible();
    expect(screen.getByText(/Hub profile, friends, notifications/))
      .toHaveTextContent("not connected yet");
    expect(screen.queryByText(/Live BoardState sync/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Hub connected/i)).not.toBeInTheDocument();
  });
});
