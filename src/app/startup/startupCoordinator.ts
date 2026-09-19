import { useSyncExternalStore } from "react";

export type StartupTaskStatus =
  | "not_started"
  | "running"
  | "ready"
  | "failed"
  | "skipped";

export type StartupState = "preparing" | "ready" | "failed";
export type StartupCacheStatus = "hit" | "miss" | "unknown";

export type StartupTaskDefinition = Readonly<{
  id: string;
  category: string;
  critical: boolean;
  homeRequired?: boolean;
  dependencies?: readonly string[];
  retryable?: boolean;
}>;

export type StartupTaskSnapshot = StartupTaskDefinition &
  Readonly<{
    status: StartupTaskStatus;
    completedUnits?: number;
    totalUnits?: number;
    startedAt?: number;
    completedAt?: number;
    error?: string;
    cacheStatus: StartupCacheStatus;
  }>;

export type StartupSnapshot = Readonly<{
  generation: number;
  state: StartupState;
  tasks: readonly StartupTaskSnapshot[];
  activeTasks: readonly string[];
  completedTasks: readonly string[];
  failedTasks: readonly string[];
  criticalReady: boolean;
  criticalFailed: boolean;
  homeReady: boolean;
  progress?: Readonly<{ completed: number; total: number; value: number }>;
  blockingTasks: readonly string[];
  error?: string;
}>;

export type StartupTaskReporter = Readonly<{
  started: (cacheStatus?: StartupCacheStatus) => void;
  progress: (completedUnits: number, totalUnits: number) => void;
  ready: (cacheStatus?: StartupCacheStatus) => void;
  skipped: () => void;
  failed: (error: unknown) => void;
}>;

const HOME_READY_TASKS = new Set([
  "app-core",
  "preferences",
  "workspace-data",
  "fonts",
  "home-assets",
  "home-structure",
  "home-geometry",
  "home-interaction",
]);

const defaultDefinitions: readonly StartupTaskDefinition[] = Object.freeze([
  { id: "app-core", category: "core", critical: true, homeRequired: true },
  {
    id: "preferences",
    category: "preferences",
    critical: true,
    homeRequired: true,
    dependencies: ["app-core"],
  },
  {
    id: "workspace-data",
    category: "archive",
    critical: true,
    homeRequired: true,
    dependencies: ["app-core"],
  },
  {
    id: "collection-index",
    category: "collection",
    critical: false,
    dependencies: ["app-core"],
  },
  {
    id: "fonts",
    category: "visuals",
    critical: true,
    homeRequired: true,
    dependencies: ["app-core"],
  },
  {
    id: "home-assets",
    category: "visuals",
    critical: true,
    homeRequired: true,
    dependencies: ["app-core", "fonts"],
  },
  {
    id: "home-structure",
    category: "nexus",
    critical: true,
    homeRequired: true,
    dependencies: ["workspace-data", "home-assets"],
  },
  {
    id: "home-geometry",
    category: "orbit",
    critical: true,
    homeRequired: true,
    dependencies: ["home-structure"],
  },
  {
    id: "home-interaction",
    category: "orbit",
    critical: true,
    homeRequired: true,
    dependencies: ["home-geometry"],
  },
  {
    id: "optional-collection-hydration",
    category: "collection",
    critical: false,
    dependencies: ["app-core"],
    retryable: true,
  },
]);

function freezeSnapshot(snapshot: StartupSnapshot): StartupSnapshot {
  return Object.freeze({
    ...snapshot,
    tasks: Object.freeze(snapshot.tasks),
    activeTasks: Object.freeze(snapshot.activeTasks),
    completedTasks: Object.freeze(snapshot.completedTasks),
    failedTasks: Object.freeze(snapshot.failedTasks),
    blockingTasks: Object.freeze(snapshot.blockingTasks),
    progress: snapshot.progress ? Object.freeze(snapshot.progress) : undefined,
  });
}

function initialTask(definition: StartupTaskDefinition): StartupTaskSnapshot {
  return Object.freeze({
    ...definition,
    status: "not_started" as const,
    cacheStatus: "unknown" as const,
  });
}

export class StartupCoordinator {
  private readonly definitions = new Map<string, StartupTaskDefinition>();
  private readonly tasks = new Map<string, StartupTaskSnapshot>();
  private readonly running = new Map<string, Promise<unknown>>();
  private readonly listeners = new Set<() => void>();
  private progressEmitPending = false;
  private generation = 0;
  private snapshot: StartupSnapshot;
  private started = false;

  constructor(definitions: readonly StartupTaskDefinition[] = defaultDefinitions) {
    for (const definition of definitions) {
      this.registerTask(definition);
    }
    this.snapshot = this.buildSnapshot();
  }

  registerTask(definition: StartupTaskDefinition) {
    if (this.definitions.has(definition.id)) {
      return;
    }
    this.definitions.set(definition.id, Object.freeze({ ...definition }));
    this.tasks.set(definition.id, initialTask(definition));
    this.emit();
  }

  beginGeneration() {
    this.generation += 1;
    this.started = true;
    this.running.clear();
    for (const definition of this.definitions.values()) {
      this.tasks.set(definition.id, initialTask(definition));
    }
    this.emit();
    return this.generation;
  }

  ensureStarted() {
    if (!this.started) {
      this.beginGeneration();
    }
    return this.generation;
  }

  getGeneration() {
    return this.generation;
  }

  getSnapshot() {
    return this.snapshot;
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  reporter(taskId: string, generation = this.generation): StartupTaskReporter {
    return {
      started: (cacheStatus = "unknown") => {
        if (this.isCurrent(generation, taskId)) {
          this.taskStarted(taskId, generation, cacheStatus);
        }
      },
      progress: (completedUnits, totalUnits) => {
        if (this.isCurrent(generation, taskId)) {
          this.taskProgress(taskId, completedUnits, totalUnits, generation);
        }
      },
      ready: (cacheStatus = "unknown") => {
        if (this.isCurrent(generation, taskId)) {
          this.taskReady(taskId, generation, cacheStatus);
        }
      },
      skipped: () => {
        if (this.isCurrent(generation, taskId)) {
          this.taskSkipped(taskId, generation);
        }
      },
      failed: (error) => {
        if (this.isCurrent(generation, taskId)) {
          this.taskFailed(taskId, error, generation);
        }
      },
    };
  }

  taskStarted(
    taskId: string,
    generation = this.generation,
    cacheStatus: StartupCacheStatus = "unknown",
  ) {
    if (!this.isCurrent(generation, taskId)) return;
    const current = this.tasks.get(taskId);
    if (!current || current.status === "ready") return;
    this.tasks.set(taskId, {
      ...current,
      status: "running",
      startedAt: current.startedAt ?? performance.now(),
      error: undefined,
      cacheStatus,
    });
    this.emit();
  }

  taskProgress(
    taskId: string,
    completedUnits: number,
    totalUnits: number,
    generation = this.generation,
  ) {
    if (!this.isCurrent(generation, taskId)) return;
    const current = this.tasks.get(taskId);
    if (!current || current.status === "ready" || current.status === "failed") return;
    const total = Math.max(0, Math.floor(totalUnits));
    const completed = Math.min(total, Math.max(0, Math.floor(completedUnits)));
    this.tasks.set(taskId, {
      ...current,
      status: "running",
      completedUnits: completed,
      totalUnits: total,
      startedAt: current.startedAt ?? performance.now(),
    });
    this.emitProgress();
  }

  taskReady(
    taskId: string,
    generation = this.generation,
    cacheStatus: StartupCacheStatus = "unknown",
  ) {
    if (!this.isCurrent(generation, taskId)) return;
    const current = this.tasks.get(taskId);
    if (!current || current.status === "ready") return;
    this.tasks.set(taskId, {
      ...current,
      status: "ready",
      completedUnits: current.totalUnits ?? current.completedUnits,
      completedAt: performance.now(),
      error: undefined,
      cacheStatus,
    });
    this.emit();
  }

  taskSkipped(taskId: string, generation = this.generation) {
    if (!this.isCurrent(generation, taskId)) return;
    const current = this.tasks.get(taskId);
    if (!current || current.status === "ready") return;
    this.tasks.set(taskId, {
      ...current,
      status: "skipped",
      completedAt: performance.now(),
      error: undefined,
    });
    this.emit();
  }

  taskFailed(taskId: string, error: unknown, generation = this.generation) {
    if (!this.isCurrent(generation, taskId)) return;
    const current = this.tasks.get(taskId);
    if (!current || current.status === "ready") return;
    const message = error instanceof Error ? error.message : String(error);
    this.tasks.set(taskId, {
      ...current,
      status: "failed",
      completedAt: performance.now(),
      error: message,
    });
    this.emit();
  }

  async runTask<T>(
    taskId: string,
    work: (reporter: StartupTaskReporter) => Promise<T> | T,
    generation = this.ensureStarted(),
  ): Promise<T | undefined> {
    const current = this.tasks.get(taskId);
    if (!current || !this.isCurrent(generation, taskId)) return undefined;
    if (current.status === "ready" || current.status === "skipped") {
      return undefined;
    }
    if (current.dependencies?.some((dependency) => {
      const state = this.tasks.get(dependency)?.status;
      return state !== "ready" && state !== "skipped";
    })) {
      throw new Error(`Startup task ${taskId} has unresolved dependencies.`);
    }

    const key = `${generation}:${taskId}`;
    const existing = this.running.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const operation = (async () => {
      const reporter = this.reporter(taskId, generation);
      reporter.started();
      try {
        const value = await work(reporter);
        reporter.ready();
        return value;
      } catch (error) {
        reporter.failed(error);
        throw error;
      } finally {
        this.running.delete(key);
      }
    })();
    this.running.set(key, operation);
    return operation;
  }

  retry() {
    return this.beginGeneration();
  }

  resetForTests() {
    this.generation = 0;
    this.started = false;
    for (const definition of this.definitions.values()) {
      this.tasks.set(definition.id, initialTask(definition));
    }
    this.emit();
  }

  private isCurrent(generation: number, taskId: string) {
    return generation === this.generation && this.tasks.has(taskId);
  }

  private buildSnapshot(): StartupSnapshot {
    const tasks = [...this.tasks.values()];
    const criticalTasks = tasks.filter((task) => task.critical);
    const homeTasks = tasks.filter((task) => task.homeRequired || HOME_READY_TASKS.has(task.id));
    const criticalFailed = criticalTasks.some((task) => task.status === "failed");
    const criticalReady = criticalTasks.length > 0 && criticalTasks.every(
      (task) => task.status === "ready" || task.status === "skipped",
    );
    const homeReady = homeTasks.length > 0 && homeTasks.every(
      (task) => task.status === "ready" || task.status === "skipped",
    );
    const activeTasks = tasks
      .filter((task) => task.status === "running")
      .map((task) => task.id);
    const blockingTasks = tasks
      .filter((task) => task.critical && task.status !== "ready" && task.status !== "skipped")
      .map((task) => task.id);
    const progressTasks = tasks.filter(
      (task) => task.totalUnits !== undefined && task.totalUnits > 0,
    );
    const progress = progressTasks.length > 0
      ? {
          completed: progressTasks.reduce((sum, task) => sum + (task.completedUnits ?? 0), 0),
          total: progressTasks.reduce((sum, task) => sum + (task.totalUnits ?? 0), 0),
          value: progressTasks.reduce((sum, task) => sum + (task.completedUnits ?? 0), 0) /
            progressTasks.reduce((sum, task) => sum + (task.totalUnits ?? 0), 0),
        }
      : undefined;

    return freezeSnapshot({
      generation: this.generation,
      state: criticalFailed ? "failed" : criticalReady ? "ready" : "preparing",
      tasks,
      activeTasks,
      completedTasks: tasks
        .filter((task) => task.status === "ready" || task.status === "skipped")
        .map((task) => task.id),
      failedTasks: tasks.filter((task) => task.status === "failed").map((task) => task.id),
      criticalReady,
      criticalFailed,
      homeReady,
      progress,
      blockingTasks,
      error: tasks.find((task) => task.status === "failed")?.error,
    });
  }

  private emit() {
    this.snapshot = this.buildSnapshot();
    for (const listener of this.listeners) {
      listener();
    }
  }

  private emitProgress() {
    if (this.progressEmitPending) {
      return;
    }
    this.progressEmitPending = true;
    queueMicrotask(() => {
      this.progressEmitPending = false;
      this.emit();
    });
  }
}

export const startupCoordinator = new StartupCoordinator();

export function useStartupSnapshot() {
  return useSyncExternalStore(
    (listener) => startupCoordinator.subscribe(listener),
    () => startupCoordinator.getSnapshot(),
    () => startupCoordinator.getSnapshot(),
  );
}

export function useStartupGeneration() {
  return useSyncExternalStore(
    (listener) => startupCoordinator.subscribe(listener),
    () => startupCoordinator.getSnapshot().generation,
    () => startupCoordinator.getSnapshot().generation,
  );
}

export function resetStartupForTests() {
  startupCoordinator.resetForTests();
}
