import type { StartupSnapshot, StartupTaskSnapshot } from "./startupCoordinator";

export type StartupVisualStage =
  | "core"
  | "archive"
  | "collection"
  | "visuals"
  | "nexus"
  | "orbit"
  | "ready"
  | "error";

export type StartupPresentation = Readonly<{
  magicalTitle: string;
  plainDescription: string;
  detail?: string;
  visualStage: StartupVisualStage;
  progressMode: "segments" | "units" | "none";
  progressValue?: number;
  completedVisualSegments: readonly StartupVisualStage[];
  ready: boolean;
  error?: string;
}>;

const copyByCategory: Record<string, { title: string; description: string; stage: StartupVisualStage }> = {
  core: { title: "AWAKENING THE NEXUS", description: "Preparing Deck Nexus…", stage: "core" },
  preferences: { title: "RESTORING YOUR WORKSPACE", description: "Loading your saved settings…", stage: "archive" },
  archive: { title: "RESTORING YOUR ARCHIVE", description: "Loading your saved workspace…", stage: "archive" },
  collection: { title: "ATTUNING YOUR COLLECTION", description: "Loading your saved cards…", stage: "collection" },
  visuals: { title: "CHANNELING THE PROJECTION", description: "Preparing Deck Nexus visuals…", stage: "visuals" },
  nexus: { title: "FORMING THE NEXUS", description: "Building the Commander Nexus…", stage: "nexus" },
  orbit: { title: "ALIGNING THE ORBIT", description: "Preparing controls…", stage: "orbit" },
};

const priority = [
  "app-core",
  "preferences",
  "workspace-data",
  "fonts",
  "home-assets",
  "home-structure",
  "home-geometry",
  "home-interaction",
];

const copyByTask: Record<string, { title: string; description: string; stage: StartupVisualStage }> = {
  "home-assets": { title: "SUMMONING THE NEXUS", description: "Preparing navigation cards…", stage: "visuals" },
  "home-structure": { title: "FORMING THE NEXUS", description: "Building the Commander Nexus…", stage: "nexus" },
  "home-geometry": { title: "ALIGNING THE ORBIT", description: "Positioning the Nexus…", stage: "orbit" },
  "home-interaction": { title: "STABILIZING THE NEXUS", description: "Preparing controls…", stage: "orbit" },
};

function getCopy(task: StartupTaskSnapshot | undefined) {
  return task ? copyByTask[task.id] ?? copyByCategory[task.category] : copyByCategory.core;
}

function pickTask(snapshot: StartupSnapshot): StartupTaskSnapshot | undefined {
  const byId = new Map(snapshot.tasks.map((task) => [task.id, task]));
  return priority
    .map((id) => byId.get(id))
    .find((task) => task && (task.status === "running" || task.status === "failed")) ??
    snapshot.tasks.find((task) => task.status === "running");
}

function completedSegments(snapshot: StartupSnapshot): readonly StartupVisualStage[] {
  const stages = new Set<StartupVisualStage>(["core"]);
  for (const task of snapshot.tasks) {
    if (task.status !== "ready" && task.status !== "skipped") continue;
    const stage = copyByCategory[task.category]?.stage;
    if (stage) stages.add(stage);
  }
  if (snapshot.homeReady) {
    stages.add("ready");
  }
  return [...stages];
}

export function adaptStartupSnapshot(snapshot: StartupSnapshot): StartupPresentation {
  if (snapshot.criticalFailed) {
    return {
      magicalTitle: "NEXUS DISRUPTED",
      plainDescription: "Deck Nexus couldn't finish preparing your workspace.",
      detail: snapshot.error,
      visualStage: "error",
      progressMode: "none",
      completedVisualSegments: completedSegments(snapshot),
      ready: false,
      error: snapshot.error,
    };
  }

  if (snapshot.homeReady) {
    return {
      magicalTitle: "NEXUS READY",
      plainDescription: "Opening Deck Nexus…",
      visualStage: "ready",
      progressMode: snapshot.progress ? "units" : "segments",
      progressValue: snapshot.progress?.value,
      completedVisualSegments: completedSegments(snapshot),
      ready: true,
    };
  }

  const task = pickTask(snapshot);
  const copy = getCopy(task);
  const detail = task?.completedUnits !== undefined && task.totalUnits !== undefined
    ? `${task.completedUnits.toLocaleString()} of ${task.totalUnits.toLocaleString()} ready`
    : undefined;

  return {
    magicalTitle: copy.title,
    plainDescription: copy.description,
    detail,
    visualStage: copy.stage,
    progressMode: detail ? "units" : "segments",
    progressValue: snapshot.progress?.value,
    completedVisualSegments: completedSegments(snapshot),
    ready: false,
  };
}
