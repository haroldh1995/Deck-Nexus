import { describe, expect, it } from "vitest";
import { StartupCoordinator } from "../app/startup/startupCoordinator";

describe("StartupCoordinator", () => {
  it("tracks real units and exposes an immutable readiness snapshot", async () => {
    const coordinator = new StartupCoordinator([
      { id: "core", category: "core", critical: true, homeRequired: true },
      {
        id: "visuals",
        category: "visuals",
        critical: true,
        homeRequired: true,
        dependencies: ["core"],
      },
    ]);
    const generation = coordinator.beginGeneration();

    coordinator.taskStarted("core", generation, "hit");
    coordinator.taskReady("core", generation, "hit");
    coordinator.taskStarted("visuals", generation, "miss");
    coordinator.taskProgress("visuals", 2, 4, generation);
    await Promise.resolve();

    expect(coordinator.getSnapshot().progress).toEqual({
      completed: 2,
      total: 4,
      value: 0.5,
    });
    expect(Object.isFrozen(coordinator.getSnapshot())).toBe(true);
    expect(coordinator.getSnapshot().homeReady).toBe(false);

    coordinator.taskReady("visuals", generation, "miss");
    expect(coordinator.getSnapshot().homeReady).toBe(true);
    expect(coordinator.getSnapshot().state).toBe("ready");
  });

  it("ignores stale generation completions", () => {
    const coordinator = new StartupCoordinator([
      { id: "core", category: "core", critical: true, homeRequired: true },
    ]);
    const first = coordinator.beginGeneration();
    const firstReporter = coordinator.reporter("core", first);
    const second = coordinator.retry();

    firstReporter.ready("hit");
    expect(coordinator.getSnapshot().generation).toBe(second);
    expect(coordinator.getSnapshot().tasks[0]?.status).toBe("not_started");
    expect(coordinator.getSnapshot().homeReady).toBe(false);

    coordinator.taskReady("core", second, "hit");
    expect(coordinator.getSnapshot().homeReady).toBe(true);
  });

  it("deduplicates a task that is already ready and reports failures", async () => {
    const coordinator = new StartupCoordinator([
      { id: "core", category: "core", critical: true },
    ]);
    const generation = coordinator.beginGeneration();
    const work = async () => "done";

    await coordinator.runTask("core", work, generation);
    await coordinator.runTask("core", work, generation);
    expect(coordinator.getSnapshot().tasks[0]?.status).toBe("ready");

    const retryGeneration = coordinator.retry();
    await expect(
      coordinator.runTask("core", async () => {
        throw new Error("broken");
      }, retryGeneration),
    ).rejects.toThrow("broken");
    expect(coordinator.getSnapshot().criticalFailed).toBe(true);
    expect(coordinator.getSnapshot().failedTasks).toEqual(["core"]);
  });

  it("shares concurrent work for the same task and generation", async () => {
    const coordinator = new StartupCoordinator([
      { id: "core", category: "core", critical: true },
    ]);
    const generation = coordinator.beginGeneration();
    let calls = 0;
    const work = async () => {
      calls += 1;
      await Promise.resolve();
      return calls;
    };

    const results = await Promise.all([
      coordinator.runTask("core", work, generation),
      coordinator.runTask("core", work, generation),
    ]);

    expect(calls).toBe(1);
    expect(results).toEqual([1, 1]);
  });
});
