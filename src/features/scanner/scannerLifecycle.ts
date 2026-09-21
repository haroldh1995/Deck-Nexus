export interface ScannerTarget {
  targetId: string;
  generation: number;
  fingerprint: string;
  acquiredAt: number;
}

export interface ScannerRecognitionOwnership {
  scanSessionId: string;
  batchId: string;
  targetId: string;
  captureGeneration: number;
  frameId: number;
  recognitionJobId: string;
}

export type ScannerRecognitionResultOwnership = ScannerRecognitionOwnership;

export function createScannerLifecycle(sessionId: string) {
  let generation = 0;
  let frameId = 0;
  let jobId = 0;
  let target: ScannerTarget | undefined;
  let absentFrames = 0;

  function fingerprintDistance(left: string, right: string): number {
    const length = Math.max(left.length, right.length, 1);
    let differences = Math.abs(left.length - right.length);
    for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
      if (left[index] !== right[index]) differences += 1;
    }
    return differences / length;
  }

  function acquireTarget(fingerprint: string, now = Date.now()): ScannerTarget {
    if (!target || fingerprintDistance(target.fingerprint, fingerprint) > 0.34) {
      generation += 1;
      target = { targetId: `${sessionId}-target-${generation}`, generation, fingerprint, acquiredAt: now };
    }
    absentFrames = 0;
    target = { ...target, fingerprint };
    return target;
  }

  return {
    acquireTarget,
    observeAbsent(): boolean {
      absentFrames += 1;
      if (absentFrames < 3) return false;
      target = undefined;
      absentFrames = 0;
      return true;
    },
    invalidateTarget(): void {
      target = undefined;
      absentFrames = 0;
    },
    createOwnership(batchId: string, targetFingerprint: string): ScannerRecognitionOwnership {
      const current = target ?? acquireTarget(targetFingerprint);
      frameId += 1;
      jobId += 1;
      return {
        scanSessionId: sessionId,
        batchId,
        targetId: current.targetId,
        captureGeneration: current.generation,
        frameId,
        recognitionJobId: `${sessionId}-job-${jobId}`,
      };
    },
    isCurrent(ownership: ScannerRecognitionResultOwnership): boolean {
      return Boolean(target && target.targetId === ownership.targetId && target.generation === ownership.captureGeneration);
    },
    currentTarget(): ScannerTarget | undefined {
      return target;
    },
    currentGeneration(): number {
      return generation;
    },
  };
}
