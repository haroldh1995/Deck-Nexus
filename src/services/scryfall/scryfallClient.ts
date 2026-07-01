import { mapScryfallError, retryAfterHeaderToMs, ScryfallServiceError } from "./scryfallErrors";
import { scryfallRequestQueue } from "./scryfallRequestQueue";
import type { ScryfallPriority } from "./scryfallTypes";

export function isBrowserOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine !== false;
}

export async function fetchScryfallJson<T>({
  url,
  method = "GET",
  body,
  priority = "medium",
  signal,
  cacheKey,
}: {
  url: string;
  method?: "GET" | "POST";
  body?: unknown;
  priority?: ScryfallPriority;
  signal?: AbortSignal;
  cacheKey?: string;
}): Promise<T> {
  if (!isBrowserOnline()) {
    throw new ScryfallServiceError("Offline card data is active.", {
      status: 0,
      code: "offline",
    });
  }

  const key = cacheKey ?? `${method}:${url}:${body ? JSON.stringify(body) : ""}`;
  return scryfallRequestQueue.schedule<T>({
    key,
    priority,
    signal,
    request: async () => {
      const response = await fetch(url, {
        method,
        signal,
        headers: {
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const retryAfterMs = retryAfterHeaderToMs(response.headers.get("Retry-After"));
      const responseBody = await response.json().catch(() => undefined);

      if (!response.ok) {
        throw mapScryfallError(response.status, responseBody, retryAfterMs);
      }

      return responseBody as T;
    },
  });
}
