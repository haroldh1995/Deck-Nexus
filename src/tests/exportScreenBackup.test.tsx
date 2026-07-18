import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { resetDatabaseForTests } from "../db/database";
import {
  createBlankCommanderDeck,
  listBackupPackages,
} from "../db/repositories";
import { ExportScreen } from "../features/export/ExportScreen";

describe("Export screen local backup controls", () => {
  beforeEach(async () => {
    await resetDatabaseForTests();
    await createBlankCommanderDeck({ name: "Backup UI Deck" });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:deck-nexus-backup"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports a real local backup package without cloud-provider claims", async () => {
    render(
      <MemoryRouter initialEntries={["/export"]}>
        <ExportScreen />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "Export" })).toBeVisible();
    expect(screen.getByText("Backup & Restore")).toBeVisible();
    expect(screen.getByText(/Cloud providers are not connected/i)).toBeVisible();

    await userEvent.click(screen.getByTestId("export-full-backup"));

    expect(await screen.findByText("Local backup file generated.")).toBeVisible();
    await waitFor(async () => {
      expect(await listBackupPackages()).toHaveLength(1);
    });
  });
});
