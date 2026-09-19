import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MagicalStartupScreen } from "../app/startup/MagicalStartupScreen";
import type { StartupPresentation } from "../app/startup/startupStatusAdapter";

const presentation: StartupPresentation = {
  magicalTitle: "SUMMONING THE NEXUS",
  plainDescription: "Preparing navigation cards…",
  detail: "10 of 12 ready",
  visualStage: "visuals",
  progressMode: "units",
  progressValue: 10 / 12,
  completedVisualSegments: ["core", "archive", "collection"],
  ready: false,
};

describe("MagicalStartupScreen", () => {
  it("presents truthful magical and plain-language status without technical logs", () => {
    render(<MagicalStartupScreen onRetry={vi.fn()} presentation={presentation} />);

    expect(screen.getByText("SUMMONING THE NEXUS")).toBeVisible();
    expect(screen.getByText("Preparing navigation cards…")).toBeVisible();
    expect(screen.getByText("10 of 12 ready")).toBeVisible();
    expect(screen.queryByText(/IndexedDB|hydrating|task id/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("magical-startup")).toHaveAttribute("role", "status");
  });

  it("offers retry only for a genuine failure", () => {
    render(
      <MagicalStartupScreen
        onRetry={vi.fn()}
        presentation={{
          ...presentation,
          magicalTitle: "NEXUS DISRUPTED",
          error: "storage unavailable",
          ready: false,
          visualStage: "error",
        }}
      />,
    );

    expect(screen.getByRole("button", { name: "Retry preparation" })).toBeVisible();
  });
});
