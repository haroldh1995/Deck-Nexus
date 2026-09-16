type ScheduledWork = {
  cancel: () => void;
};

const scheduledWork = new Map<string, ScheduledWork>();
const runningWorkKeys = new Set<string>();
let activeInteractionCount = 0;

export function setUserInteractionActive(active: boolean): void {
  activeInteractionCount = Math.max(
    0,
    activeInteractionCount + (active ? 1 : -1),
  );
}

export function isUserInteracting(): boolean {
  return activeInteractionCount > 0;
}

export function scheduleBackgroundWork(
  key: string,
  work: () => void | Promise<void>,
  delayMilliseconds = 900,
): () => void {
  if (scheduledWork.has(key) || runningWorkKeys.has(key)) {
    return () => undefined;
  }

  let cancelled = false;
  let idleHandle: number | null = null;
  let timeoutHandle: number | null = null;

  const cancel = () => {
    cancelled = true;
    if (idleHandle !== null && typeof window.cancelIdleCallback === "function") {
      window.cancelIdleCallback(idleHandle);
    }
    if (timeoutHandle !== null) {
      window.clearTimeout(timeoutHandle);
    }
    if (scheduledWork.get(key)?.cancel === cancel) {
      scheduledWork.delete(key);
    }
  };

  const scheduleAttempt = () => {
    if (cancelled) {
      return;
    }

    if (typeof window.requestIdleCallback === "function") {
      idleHandle = window.requestIdleCallback(run, { timeout: 4000 });
      return;
    }

    timeoutHandle = window.setTimeout(run, 250);
  };

  const run = () => {
    idleHandle = null;
    timeoutHandle = null;
    if (cancelled) {
      return;
    }

    if (isUserInteracting() || document.visibilityState === "hidden") {
      timeoutHandle = window.setTimeout(scheduleAttempt, 250);
      return;
    }

    scheduledWork.delete(key);
    runningWorkKeys.add(key);
    Promise.resolve()
      .then(work)
      .catch(() => undefined)
      .finally(() => runningWorkKeys.delete(key));
  };

  timeoutHandle = window.setTimeout(scheduleAttempt, delayMilliseconds);
  scheduledWork.set(key, { cancel });
  return cancel;
}
