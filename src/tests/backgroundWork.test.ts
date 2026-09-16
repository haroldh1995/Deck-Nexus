import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isUserInteracting,
  scheduleBackgroundWork,
  setUserInteractionActive,
} from "../app/backgroundWork";

describe("background work scheduling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, "requestIdleCallback", {
      configurable: true,
      value: undefined,
    });
  });

  afterEach(() => {
    if (isUserInteracting()) {
      setUserInteractionActive(false);
    }
    vi.useRealTimers();
  });

  it("defers work while the user is interacting and runs it once idle", async () => {
    const work = vi.fn();
    setUserInteractionActive(true);
    scheduleBackgroundWork("test-idle-work", work, 0);

    await vi.advanceTimersByTimeAsync(1400);
    expect(work).not.toHaveBeenCalled();

    setUserInteractionActive(false);
    await vi.advanceTimersByTimeAsync(600);
    expect(work).toHaveBeenCalledTimes(1);
  });

  it("deduplicates a pending job by key", async () => {
    const work = vi.fn();
    scheduleBackgroundWork("test-deduped-work", work, 0);
    scheduleBackgroundWork("test-deduped-work", work, 0);

    await vi.advanceTimersByTimeAsync(1400);
    expect(work).toHaveBeenCalledTimes(1);
  });
});
