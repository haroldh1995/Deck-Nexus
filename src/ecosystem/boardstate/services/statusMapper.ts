import type { BoardStateValidationResultRecord } from "../../../types/domain";

export function boardStateResultLabel(result?: BoardStateValidationResultRecord): string {
  if (!result) {
    return "BoardState validation is not connected.";
  }

  if (result.stale || result.status === "stale") {
    return "BoardState result is out of date";
  }

  if (result.testOnly) {
    if (result.legalityStatus === "legal") {
      return "BoardState test adapter: Legal";
    }
    if (result.legalityStatus === "legal_with_warnings") {
      return "BoardState test adapter: Legal with Warnings";
    }
    if (result.legalityStatus === "illegal") {
      return "BoardState test adapter: Issues Found";
    }
  }

  if (!result.authoritative && result.status === "unavailable") {
    return "BoardState validation is not connected.";
  }

  if (!result.authoritative && result.errorSummary) {
    return result.errorSummary;
  }

  if (result.legalityStatus === "legal") {
    return "BoardState: Legal";
  }

  if (result.legalityStatus === "legal_with_warnings") {
    return "BoardState: Legal with Warnings";
  }

  if (result.legalityStatus === "illegal") {
    return "BoardState: Issues Found";
  }

  if (result.status === "timeout") {
    return "BoardState validation timed out.";
  }

  if (result.status === "unsupported" || result.status === "incompatible_schema") {
    return "BoardState validation is unsupported for this snapshot.";
  }

  return "BoardState validation unavailable.";
}

export function boardStateResultTone(
  result?: BoardStateValidationResultRecord,
): "cyan" | "violet" | "silver" | "amber" {
  if (!result || result.status === "unavailable") {
    return "violet";
  }
  if (result.stale || result.status === "stale") {
    return "amber";
  }
  if (result.legalityStatus === "legal") {
    return "cyan";
  }
  if (result.legalityStatus === "legal_with_warnings") {
    return "amber";
  }
  if (result.legalityStatus === "illegal") {
    return "amber";
  }
  return "silver";
}
