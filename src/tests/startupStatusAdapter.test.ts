import { describe, expect, it } from "vitest";
import { StartupCoordinator } from "../app/startup/startupCoordinator";
import { adaptStartupSnapshot } from "../app/startup/startupStatusAdapter";

describe("StartupStatusAdapter", () => {
  it("maps the active real task to magical and plain-language copy", async () => {
    const coordinator = new StartupCoordinator([
      { id: "archive", category: "archive", critical: true, homeRequired: true },
    ]);
    const generation = coordinator.beginGeneration();
    coordinator.taskStarted("archive", generation, "miss");
    coordinator.taskProgress("archive", 18, 34, generation);
    await Promise.resolve();

    const presentation = adaptStartupSnapshot(coordinator.getSnapshot());
    expect(presentation.magicalTitle).toBe("RESTORING YOUR ARCHIVE");
    expect(presentation.plainDescription).toContain("saved workspace");
    expect(presentation.detail).toBe("18 of 34 ready");
    expect(presentation.progressMode).toBe("units");
    expect(presentation.ready).toBe(false);
  });

  it("does not invent a stage for a cache-complete startup", () => {
    const coordinator = new StartupCoordinator([
      { id: "core", category: "core", critical: true, homeRequired: true },
    ]);
    const generation = coordinator.beginGeneration();
    coordinator.taskReady("core", generation, "hit");

    const presentation = adaptStartupSnapshot(coordinator.getSnapshot());
    expect(presentation.ready).toBe(true);
    expect(presentation.magicalTitle).toBe("NEXUS READY");
    expect(presentation.progressMode).toBe("segments");
  });

  it("surfaces critical failure without allowing Home reveal", () => {
    const coordinator = new StartupCoordinator([
      { id: "core", category: "core", critical: true, homeRequired: true },
    ]);
    const generation = coordinator.beginGeneration();
    coordinator.taskFailed("core", new Error("storage unavailable"), generation);

    const presentation = adaptStartupSnapshot(coordinator.getSnapshot());
    expect(presentation.magicalTitle).toBe("NEXUS DISRUPTED");
    expect(presentation.error).toContain("storage unavailable");
    expect(presentation.ready).toBe(false);
  });
});
