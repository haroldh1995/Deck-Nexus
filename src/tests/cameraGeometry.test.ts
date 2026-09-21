import { describe, expect, it } from "vitest";
import { mapDisplayRectToSource, objectFitCoverSourceRect, visibleGuideSourceRect } from "../features/scanner/cameraGeometry";

describe("scanner camera geometry", () => {
  it("maps object-fit cover crop before applying the visible guide", () => {
    const crop = objectFitCoverSourceRect({ sourceWidth: 1920, sourceHeight: 1080, displayWidth: 390, displayHeight: 640 });
    expect(crop.left).toBeGreaterThan(0);
    expect(crop.top).toBe(0);
    const guide = visibleGuideSourceRect({ videoWidth: 1920, videoHeight: 1080, displayWidth: 390, displayHeight: 640 });
    expect(guide.left).toBeGreaterThan(crop.left);
    expect(guide.top).toBeGreaterThan(0);
    expect(guide.width).toBeLessThan(crop.width);
  });

  it("keeps normalized mapping deterministic for a source image", () => {
    const mapped = mapDisplayRectToSource({
      displayRect: { left: 0.15, top: 0.1, width: 0.7, height: 0.8 },
      sourceRect: { left: 100, top: 20, width: 1000, height: 1400 },
    });
    expect(mapped).toEqual({ left: 250, top: 160, width: 700, height: 1120 });
  });
});
