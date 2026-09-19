import type { StartupTaskReporter } from "./startupCoordinator";

export type StartupSimulationMode = "none" | "slow" | "failure" | "parallel";

export function getStartupSimulationMode(): StartupSimulationMode {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return "none";
  }

  const value = new URLSearchParams(window.location.search).get("startup-sim");
  return value === "slow" || value === "failure" || value === "parallel"
    ? value
    : "none";
}

export async function simulateStartupTask(
  taskId: string,
  reporter: StartupTaskReporter,
  mode: StartupSimulationMode,
) {
  if (mode === "none") {
    return;
  }

  if (mode === "failure" && taskId === "home-assets") {
    throw new Error("Development startup simulation failure.");
  }

  if (mode === "slow" && (taskId === "app-core" || taskId === "home-assets")) {
    const total = taskId === "app-core" ? 6 : 12;
    for (let completed = 1; completed <= total; completed += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      reporter.progress(completed, total);
    }
  }

  if (mode === "parallel" && taskId === "home-assets") {
    reporter.progress(4, 12);
    await new Promise((resolve) => window.setTimeout(resolve, 200));
    reporter.progress(12, 12);
  }
}
