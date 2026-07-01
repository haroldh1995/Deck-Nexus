import type { ScryfallErrorObject } from "./scryfallTypes";

export class ScryfallServiceError extends Error {
  status: number;
  code: string;
  retryAfterMs?: number;
  details?: string;

  constructor(message: string, options: { status: number; code: string; retryAfterMs?: number; details?: string }) {
    super(message);
    this.name = "ScryfallServiceError";
    this.status = options.status;
    this.code = options.code;
    this.retryAfterMs = options.retryAfterMs;
    this.details = options.details;
  }
}

export function isScryfallErrorObject(value: unknown): value is ScryfallErrorObject {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { object?: unknown }).object === "error" &&
    typeof (value as { status?: unknown }).status === "number"
  );
}

export function retryAfterHeaderToMs(headerValue: string | null): number | undefined {
  if (!headerValue) {
    return undefined;
  }

  const seconds = Number(headerValue);
  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1000);
  }

  const dateMs = Date.parse(headerValue);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }

  return undefined;
}

export function isTransientStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status < 600);
}

export function mapScryfallError(
  status: number,
  body: unknown,
  retryAfterMs?: number,
): ScryfallServiceError {
  if (isScryfallErrorObject(body)) {
    return new ScryfallServiceError(body.details, {
      status: body.status || status,
      code: body.code,
      retryAfterMs,
      details: body.details,
    });
  }

  return new ScryfallServiceError(`Scryfall request failed with status ${status}.`, {
    status,
    code: status === 429 ? "rate_limited" : "http_error",
    retryAfterMs,
  });
}
