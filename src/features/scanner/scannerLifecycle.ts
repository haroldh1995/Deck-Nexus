export interface ScannerTarget {
  targetId: string;
  generation: number;
  fingerprint: string;
  acquiredAt: number;
  candidate?: ScannerTargetGeometry;
  captureCommitted: boolean;
  acceptedFingerprint?: string;
  acceptedCandidate?: ScannerTargetGeometry;
}

export interface ScannerTargetGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScannerNewTargetObservation {
  fingerprint: string;
  candidate?: ScannerTargetGeometry;
  tooClose?: boolean;
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
  let pendingReplacementFrames = 0;

  function fingerprintDistance(left: string, right: string): number {
    const length = Math.max(left.length, right.length, 1);
    let differences = Math.abs(left.length - right.length);
    for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
      if (left[index] !== right[index]) differences += 1;
    }
    return differences / length;
  }

  function geometryDistance(left?: ScannerTargetGeometry, right?: ScannerTargetGeometry): number {
    if (!left || !right) return 1;
    return Math.min(1, (
      Math.abs(left.x - right.x) +
      Math.abs(left.y - right.y) +
      Math.abs(left.width - right.width) +
      Math.abs(left.height - right.height)
    ) / 2);
  }

  function createTarget(fingerprint: string, now: number, candidate?: ScannerTargetGeometry): ScannerTarget {
    generation += 1;
    pendingReplacementFrames = 0;
    target = {
      targetId: `${sessionId}-target-${generation}`,
      generation,
      fingerprint,
      acquiredAt: now,
      candidate,
      captureCommitted: false,
    };
    return target;
  }

  function acquireTarget(
    fingerprint: string,
    now = Date.now(),
    candidate?: ScannerTargetGeometry,
    signals?: Pick<ScannerNewTargetObservation, "tooClose">,
  ): ScannerTarget {
    if (!target) {
      return createTarget(fingerprint, now, candidate);
    }

    if (target.captureCommitted) {
      const baseline = target.acceptedFingerprint ?? target.fingerprint;
      const fingerprintChange = fingerprintDistance(baseline, fingerprint);
      const geometryChange = geometryDistance(target.acceptedCandidate, candidate);
      const strongReplacement = fingerprintChange >= 0.48 || (
        fingerprintChange >= 0.28 && geometryChange >= 0.16
      ) || (
        Boolean(signals?.tooClose) && fingerprintChange >= 0.08 && geometryChange >= 0.14
      );

      if (strongReplacement) {
        pendingReplacementFrames += 1;
      } else {
        pendingReplacementFrames = 0;
      }

      // Require two coherent changed frames. This recognizes direct replacement
      // without treating autofocus, glare, or normal hand movement as a new card.
      if (pendingReplacementFrames >= 2) {
        return createTarget(fingerprint, now, candidate);
      }

      return target;
    }

    if (fingerprintDistance(target.fingerprint, fingerprint) > 0.34) {
      return createTarget(fingerprint, now, candidate);
    }
    absentFrames = 0;
    target = { ...target, fingerprint, candidate };
    return target;
  }

  function isCurrent(ownership: ScannerRecognitionResultOwnership): boolean {
    return Boolean(target && target.targetId === ownership.targetId && target.generation === ownership.captureGeneration);
  }

  return {
    acquireTarget,
    observeAbsent(): boolean {
      absentFrames += 1;
      if (absentFrames < 3) return false;
      target = undefined;
      absentFrames = 0;
      pendingReplacementFrames = 0;
      return true;
    },
    invalidateTarget(): void {
      target = undefined;
      absentFrames = 0;
      pendingReplacementFrames = 0;
    },
    commitCapture(ownership: ScannerRecognitionResultOwnership, observation: ScannerNewTargetObservation): boolean {
      if (!target || !isCurrent(ownership)) return false;
      target = {
        ...target,
        captureCommitted: true,
        acceptedFingerprint: observation.fingerprint,
        acceptedCandidate: observation.candidate,
        fingerprint: observation.fingerprint,
        candidate: observation.candidate,
      };
      pendingReplacementFrames = 0;
      absentFrames = 0;
      return true;
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
    isCurrent,
    currentTarget(): ScannerTarget | undefined {
      return target;
    },
    currentGeneration(): number {
      return generation;
    },
  };
}
