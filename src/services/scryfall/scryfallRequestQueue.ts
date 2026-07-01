import { isTransientStatus, ScryfallServiceError } from "./scryfallErrors";
import type { ScryfallPriority } from "./scryfallTypes";

interface QueueTask {
  key: string;
  priority: ScryfallPriority;
  request: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  signal?: AbortSignal;
  attempt: number;
}

interface ScheduleOptions<T> {
  key: string;
  priority?: ScryfallPriority;
  signal?: AbortSignal;
  request: () => Promise<T>;
}

const priorityRank: Record<ScryfallPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const cleanup = () => signal?.removeEventListener("abort", abort);
    const timeout = window.setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const abort = () => {
      window.clearTimeout(timeout);
      cleanup();
      reject(new DOMException("Scryfall request was aborted.", "AbortError"));
    };

    if (signal?.aborted) {
      abort();
      return;
    }

    signal?.addEventListener("abort", abort, { once: true });
  });
}

export class ScryfallRequestQueue {
  private readonly minDelayMs: number;
  private readonly maxAttempts: number;
  private pending: QueueTask[] = [];
  private inflight = new Map<string, Promise<unknown>>();
  private processing = false;
  private lastStartedAt = 0;

  constructor(options: { minDelayMs?: number; maxAttempts?: number } = {}) {
    this.minDelayMs = options.minDelayMs ?? 500;
    this.maxAttempts = options.maxAttempts ?? 3;
  }

  schedule<T>(options: ScheduleOptions<T>): Promise<T> {
    const existing = this.inflight.get(options.key);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = new Promise<T>((resolve, reject) => {
      this.pending.push({
        key: options.key,
        priority: options.priority ?? "medium",
        request: options.request as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
        signal: options.signal,
        attempt: 0,
      });
      this.pending.sort((left, right) => priorityRank[left.priority] - priorityRank[right.priority]);
      void this.process();
    }).finally(() => {
      this.inflight.delete(options.key);
    });

    this.inflight.set(options.key, promise);
    return promise;
  }

  clear() {
    for (const task of this.pending) {
      task.reject(new DOMException("Scryfall queue was cleared.", "AbortError"));
    }
    this.pending = [];
  }

  private async process(): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;
    try {
      while (this.pending.length > 0) {
        const task = this.pending.shift();
        if (!task) {
          continue;
        }

        if (task.signal?.aborted) {
          task.reject(new DOMException("Scryfall request was aborted.", "AbortError"));
          continue;
        }

        const elapsed = Date.now() - this.lastStartedAt;
        try {
          await wait(Math.max(0, this.minDelayMs - elapsed), task.signal);
        } catch (error) {
          task.reject(error);
          continue;
        }
        this.lastStartedAt = Date.now();
        await this.runTask(task);
      }
    } finally {
      this.processing = false;
    }
  }

  private async runTask(task: QueueTask): Promise<void> {
    try {
      const result = await task.request();
      task.resolve(result);
    } catch (error) {
      if (
        error instanceof ScryfallServiceError &&
        isTransientStatus(error.status) &&
        task.attempt + 1 < this.maxAttempts
      ) {
        const delay = error.retryAfterMs ?? 600 * 2 ** task.attempt;
        this.pending.unshift({ ...task, attempt: task.attempt + 1 });
        await wait(delay, task.signal);
        return;
      }

      task.reject(error);
    }
  }
}

export const scryfallRequestQueue = new ScryfallRequestQueue();
