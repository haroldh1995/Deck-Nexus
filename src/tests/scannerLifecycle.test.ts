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

  it("detects a direct replacement after two coherent changed frames without requiring an empty frame", () => {
    const lifecycle = createScannerLifecycle("session");
    const first = lifecycle.acquireTarget("00000000", 1, { x: 0.1, y: 0.1, width: 0.7, height: 0.8 });
    const ownership = lifecycle.createOwnership("batch", "00000000");
    expect(lifecycle.commitCapture(ownership, {
      fingerprint: "00000000",
      candidate: { x: 0.1, y: 0.1, width: 0.7, height: 0.8 },
    })).toBe(true);

    const firstReplacementFrame = lifecycle.acquireTarget("11111111", 2, { x: 0.1, y: 0.1, width: 0.7, height: 0.8 });
    expect(firstReplacementFrame.targetId).toBe(first.targetId);
    const secondReplacementFrame = lifecycle.acquireTarget("11111111", 3, { x: 0.1, y: 0.1, width: 0.7, height: 0.8 });
    expect(secondReplacementFrame.targetId).not.toBe(first.targetId);
    expect(secondReplacementFrame.captureCommitted).toBe(false);
  });

  it("does not create a new target for a small movement after capture", () => {
    const lifecycle = createScannerLifecycle("session");
    const first = lifecycle.acquireTarget("00000000", 1, { x: 0.1, y: 0.1, width: 0.7, height: 0.8 });
    const ownership = lifecycle.createOwnership("batch", "00000000");
    lifecycle.commitCapture(ownership, {
      fingerprint: "00000000",
      candidate: { x: 0.1, y: 0.1, width: 0.7, height: 0.8 },
    });

    const moved = lifecycle.acquireTarget("00010000", 2, { x: 0.12, y: 0.1, width: 0.69, height: 0.8 });
    expect(moved.targetId).toBe(first.targetId);
  });

  it("keeps one uncommitted target while handheld motion changes fingerprints", () => {
    const lifecycle = createScannerLifecycle("session");
    const first = lifecycle.acquireTarget("00000000", 1);
    const moving = lifecycle.acquireTarget("10101010", 2, { x: 0.08, y: 0.1, width: 0.8, height: 0.82 });
    const movingAgain = lifecycle.acquireTarget("01010101", 3, { x: 0.1, y: 0.12, width: 0.78, height: 0.8 });

    expect(moving.targetId).toBe(first.targetId);
    expect(movingAgain.targetId).toBe(first.targetId);
    expect(movingAgain.captureCommitted).toBe(false);
  });
});
