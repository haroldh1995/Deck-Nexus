import { afterEach, describe, expect, it, vi } from "vitest";
import { createScanFeedbackController } from "../features/scanner/scanFeedback";

class FakeAudioContext {
  currentTime = 0;
  destination = {};
  state: AudioContextState = "running";
  resume = async () => undefined;
  close = async () => undefined;
  createOscillator() {
    return {
      type: "triangle",
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      disconnect: vi.fn(),
      onended: null,
    };
  }
  createGain() {
    return {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }
}

describe("scanner capture feedback", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits exactly one semantic capture and beep for one durable capture id", async () => {
    Object.defineProperty(window, "AudioContext", { configurable: true, value: FakeAudioContext });
    let captureCount = 0;
    let beepCount = 0;
    window.addEventListener("deck-nexus:scan-capture-succeeded", () => { captureCount += 1; });
    window.addEventListener("deck-nexus:scan-beep", () => { beepCount += 1; });

    const controller = createScanFeedbackController();
    const preferences = {
      captureId: "capture-1",
      soundEnabled: true,
      volume: "low" as const,
      hapticEnabled: false,
    };
    await controller.playAccepted(preferences);
    await controller.playAccepted(preferences);

    expect(captureCount).toBe(1);
    expect(beepCount).toBe(1);
    await controller.close();
  });

  it("records a capture once even when sound is disabled", async () => {
    Object.defineProperty(window, "AudioContext", { configurable: true, value: FakeAudioContext });
    let captureCount = 0;
    let beepCount = 0;
    window.addEventListener("deck-nexus:scan-capture-succeeded", () => { captureCount += 1; });
    window.addEventListener("deck-nexus:scan-beep", () => { beepCount += 1; });

    const controller = createScanFeedbackController();
    await controller.playAccepted({
      captureId: "capture-muted",
      soundEnabled: false,
      volume: "medium",
      hapticEnabled: false,
    });

    expect(captureCount).toBe(1);
    expect(beepCount).toBe(0);
    await controller.close();
  });
});
