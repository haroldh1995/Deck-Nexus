import { describe, expect, it } from "vitest";
import { createScannerLifecycle } from "../features/scanner/scannerLifecycle";

describe("scanner target ownership", () => {
  it("rejects a delayed result after the physical target exits and a new target enters", () => {
    const lifecycle = createScannerLifecycle("session");
    const first = lifecycle.acquireTarget("aaa", 1);
    const ownership = lifecycle.createOwnership("batch", "aaa");
    lifecycle.observeAbsent();
    lifecycle.observeAbsent();
    lifecycle.observeAbsent();
    const second = lifecycle.acquireTarget("bbb", 10);
    expect(second.targetId).not.toBe(first.targetId);
    expect(lifecycle.isCurrent(ownership)).toBe(false);
  });

  it("allows the same card to create a new target after real exit and re-entry", () => {
    const lifecycle = createScannerLifecycle("session");
    const first = lifecycle.acquireTarget("same", 1);
    lifecycle.observeAbsent();
    lifecycle.observeAbsent();
    lifecycle.observeAbsent();
    const second = lifecycle.acquireTarget("same", 10);
    expect(second.targetId).not.toBe(first.targetId);
  });
});
