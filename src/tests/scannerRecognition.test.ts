import { describe, expect, it } from "vitest";
import { parseSetCollector } from "../features/scanner/scannerRecognition";

describe("scanner printing evidence extraction", () => {
  it("preserves a collector number printed as number-of-set-size on older cards", () => {
    const result = parseSetCollector("Illus. DiTerlizzi 131/143");
    expect(result.set).toBeUndefined();
    expect(result.collector?.value).toBe("131");
    expect(result.collector?.quality).toBeGreaterThan(0.8);
  });

  it("still extracts a conventional set and collector pair", () => {
    const result = parseSetCollector("UDS 131");
    expect(result.set?.value).toBe("uds");
    expect(result.collector?.value).toBe("131");
  });
});
