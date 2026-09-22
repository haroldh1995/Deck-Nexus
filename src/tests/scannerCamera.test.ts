import { describe, expect, it, vi } from "vitest";
import {
  getCameraCapabilities,
  mapCameraError,
  stopCameraStream,
} from "../features/scanner/scannerCamera";
import {
  analyzeImageData,
  createFrameFingerprint,
  shouldSuppressDuplicateScan,
  shouldUseRecognitionFallback,
  type FrameAnalyzerMemory,
} from "../features/scanner/frameAnalysis";
import { gainForScanVolume } from "../features/scanner/scanFeedback";
import { detectScannerCard } from "../features/scanner/scannerDetection";

function makeImageData({
  width = 120,
  height = 168,
  margin = 22,
}: {
  width?: number;
  height?: number;
  margin?: number;
} = {}) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const insideCard =
        x > margin &&
        x < width - margin &&
        y > margin &&
        y < height - margin;
      const edge =
        insideCard &&
        (x <= margin + 3 ||
          x >= width - margin - 3 ||
          y <= margin + 3 ||
          y >= height - margin - 3);
      const cardTexture = 108 + (((Math.floor(x / 7) + Math.floor(y / 11)) % 2) * 66);
      const value = edge ? 226 : insideCard ? cardTexture : 22;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }
  }
  return { data, width, height } as ImageData;
}

describe("scanner camera and frame analysis", () => {
  it("maps browser camera errors to useful scanner states", () => {
    expect(mapCameraError(new DOMException("blocked", "NotAllowedError")).state).toBe("denied");
    expect(mapCameraError(new DOMException("missing", "NotFoundError")).state).toBe("no_device");
    expect(mapCameraError(new DOMException("busy", "NotReadableError")).state).toBe("device_busy");
    expect(mapCameraError(new DOMException("bad", "OverconstrainedError")).action).toMatch(/Compatible/);
  });

  it("stops every media stream track during scanner cleanup", () => {
    const stop = vi.fn();
    stopCameraStream({
      getTracks: () => [{ stop }, { stop }],
    } as unknown as MediaStream);
    expect(stop).toHaveBeenCalledTimes(2);
  });

  it("detects torch and zoom capabilities without exposing unsupported controls", () => {
    const stream = {
      getVideoTracks: () => [
        {
          getCapabilities: () => ({
            torch: true,
            zoom: { min: 1, max: 4, step: 0.25 },
            focusMode: ["continuous"],
          }),
          getSettings: () => ({ zoom: 2 }),
        },
      ],
    } as unknown as MediaStream;

    expect(getCameraCapabilities(stream)).toEqual({
      torchSupported: true,
      zoom: { min: 1, max: 4, step: 0.25, current: 2 },
      focusModes: ["continuous"],
    });
  });

  it("scores stable card-like frames and suppresses duplicate frames", () => {
    const memory: FrameAnalyzerMemory = {};
    const first = analyzeImageData(makeImageData(), memory, {
      stableDurationMs: 150,
      timestamp: 10,
    });
    const second = analyzeImageData(makeImageData(), memory, {
      stableDurationMs: 150,
      timestamp: 230,
    });
    const third = analyzeImageData(makeImageData(), memory, {
      stableDurationMs: 150,
      timestamp: 430,
    });

    expect(first.candidateVisible).toBe(true);
    expect(second.stableForMs).toBe(0);
    expect(third.stable).toBe(true);
    expect(second.boundaryConfidence).toBeGreaterThan(0.2);
    expect(
      shouldSuppressDuplicateScan({
        currentFingerprint: second.fingerprint,
        lastAcceptedFingerprint: first.fingerprint,
        transitionStarted: false,
      }),
    ).toBe(true);
    expect(
      shouldSuppressDuplicateScan({
        currentFingerprint: second.fingerprint,
        lastAcceptedFingerprint: first.fingerprint,
        transitionStarted: true,
      }),
    ).toBe(false);
  });

  it("detects too-close card coverage as a stacking-feeder cue", () => {
    const memory: FrameAnalyzerMemory = {};
    const analysis = analyzeImageData(makeImageData({ margin: 2 }), memory, {
      stableDurationMs: 150,
      timestamp: 0,
    });
    expect(analysis.tooClose).toBe(true);
    expect(analysis.feedback).toMatch(/close/i);
  });

  it("keeps a usable close handheld frame eligible for recognition", () => {
    const memory: FrameAnalyzerMemory = {};
    const first = analyzeImageData(makeImageData({ margin: 2 }), memory, {
      stableDurationMs: 150,
      timestamp: 0,
    });
    const second = analyzeImageData(makeImageData({ margin: 2 }), memory, {
      stableDurationMs: 150,
      timestamp: 200,
    });
    const third = analyzeImageData(makeImageData({ margin: 2 }), memory, {
      stableDurationMs: 150,
      timestamp: 400,
    });

    expect(first.usableForRecognition).toBe(true);
    expect(second.stableForMs).toBe(0);
    expect(third.stable).toBe(true);
    expect(third.qualityClass).toBe("ideal");
    expect(shouldUseRecognitionFallback({
      analysis: first,
      targetAgeMs: 900,
      stableDurationMs: 150,
    })).toBe(true);
  });

  it("maps the analyzed card candidate into source-space corners without stretching it to the canvas edge", () => {
    const analysis = analyzeImageData(makeImageData(), {}, {
      stableDurationMs: 0,
      timestamp: 0,
    });
    const detection = detectScannerCard(analysis, 520, 728);
    expect(detection.quadrilateral?.topLeft.x).toBeGreaterThan(0);
    expect(detection.quadrilateral?.topLeft.y).toBeGreaterThan(0);
    expect(detection.quadrilateral?.bottomRight.x).toBeLessThan(520);
    expect(detection.quadrilateral?.bottomRight.y).toBeLessThan(728);
    expect(detection.quadrilateral?.topRight.x).toBeGreaterThan(detection.quadrilateral?.topLeft.x ?? 0);
  });

  it("creates deterministic frame fingerprints and low-volume beep gains", () => {
    const fingerprint = createFrameFingerprint(makeImageData());
    expect(fingerprint).toHaveLength(64);
    expect(gainForScanVolume("low")).toBeLessThan(gainForScanVolume("medium"));
    expect(gainForScanVolume("medium")).toBeLessThan(gainForScanVolume("high"));
  });
});
