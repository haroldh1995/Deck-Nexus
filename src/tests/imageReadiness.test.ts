import { afterEach, describe, expect, it } from "vitest";
import {
  clearImageReadinessForTests,
  isImageReady,
  markImageReady,
} from "../app/imageReadiness";

afterEach(() => {
  clearImageReadinessForTests();
});

describe("image readiness registry", () => {
  it("keeps a successfully loaded image ready across component lifecycles", () => {
    expect(isImageReady("/assets/card.png")).toBe(false);
    markImageReady("/assets/card.png");
    expect(isImageReady("/assets/card.png")).toBe(true);
  });
});
