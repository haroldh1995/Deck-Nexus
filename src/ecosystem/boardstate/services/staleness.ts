import type { BoardStateValidationResultRecord } from "../../../types/domain";
import type { DeckSnapshot } from "../../export";

export function isBoardStateResultStale(
  result: BoardStateValidationResultRecord,
  snapshot: DeckSnapshot,
): boolean {
  return result.snapshotChecksum !== snapshot.checksum;
}

export function withBoardStateStaleState(
  result: BoardStateValidationResultRecord,
  snapshot: DeckSnapshot,
): BoardStateValidationResultRecord {
  return {
    ...result,
    stale: result.stale || isBoardStateResultStale(result, snapshot),
    status:
      result.snapshotChecksum !== snapshot.checksum && result.authoritative
        ? "stale"
        : result.status,
  };
}
