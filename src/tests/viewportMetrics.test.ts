import { describe, expect, it } from "vitest";
import {
  metricsChanged,
  readViewportMetrics,
  type ViewportMetrics,
} from "../hooks/useViewportMetrics";

function metric(overrides: Partial<ViewportMetrics>): ViewportMetrics {
  return {
    aspectRatio: 390 / 844,
    keyboardLikelyOpen: false,
    layoutHeight: 844,
    layoutWidth: 390,
    orientation: "portrait",
    standalone: false,
    visualHeight: 844,
    visualWidth: 390,
    ...overrides,
  };
}

describe("viewport metrics", () => {
  it("treats portrait mobile as the default responsive stage", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 844,
    });

    const metrics = readViewportMetrics();

    expect(metrics.orientation).toBe("portrait");
    expect(metrics.keyboardLikelyOpen).toBe(false);
  });

  it("detects short landscape without depending on a hard desktop layout", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 568,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 320,
    });

    const metrics = readViewportMetrics();

    expect(metrics.orientation).toBe("landscape");
    expect(metrics.visualHeight).toBe(320);
  });

  it("ignores tiny browser-chrome viewport noise", () => {
    expect(
      metricsChanged(
        metric({ visualHeight: 844, visualWidth: 390 }),
        metric({ visualHeight: 843, visualWidth: 391 }),
      ),
    ).toBe(false);

    expect(
      metricsChanged(
        metric({ orientation: "portrait" }),
        metric({ orientation: "landscape", visualHeight: 390, visualWidth: 844 }),
      ),
    ).toBe(true);
  });
});
