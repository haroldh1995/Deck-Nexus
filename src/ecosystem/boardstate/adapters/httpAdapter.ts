import {
  type BoardStateBridgeConfig,
  type BoardStateCapabilities,
  type BoardStateTransport,
  type BoardStateValidationRequest,
  type BoardStateValidationResponse,
} from "../contracts/validationContracts";
import { isBoardStateRemoteEndpointAllowed } from "../config/boardStateConfig";
import { BoardStateBridgeError } from "../errors/boardStateErrors";

function joinEndpoint(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

async function fetchJson<T>({
  url,
  method = "GET",
  body,
  signal,
  timeoutMs,
}: {
  url: string;
  method?: "GET" | "POST";
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs: number;
}): Promise<{ value: T; statusCode: number; responseTimeMs: number }> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  const abortHandler = () => controller.abort();
  signal?.addEventListener("abort", abortHandler, { once: true });

  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const responseTimeMs = performance.now() - started;
    if (!response.ok) {
      throw new BoardStateBridgeError({
        code: response.status === 401 || response.status === 403 ? "unauthorized" : "transport_error",
        message: `BoardState endpoint returned ${response.status}.`,
        retryable: response.status >= 500,
        technicalDetail: response.statusText,
      });
    }

    return {
      value: await response.json() as T,
      statusCode: response.status,
      responseTimeMs,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new BoardStateBridgeError({
        code: "timeout",
        message: "BoardState request timed out.",
        retryable: true,
      });
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", abortHandler);
  }
}

export function createBoardStateHttpAdapter(config: BoardStateBridgeConfig): BoardStateTransport {
  const endpoint = config.endpoint;

  function assertConfigured(): string {
    if (!config.enabled || !endpoint) {
      throw new BoardStateBridgeError({
        code: "not_configured",
        message: "BoardState validation requires a configured bridge endpoint.",
      });
    }

    if (!isBoardStateRemoteEndpointAllowed(endpoint)) {
      throw new BoardStateBridgeError({
        code: "blocked_origin",
        message: "BoardState endpoint must use HTTPS in production.",
      });
    }

    return endpoint;
  }

  return {
    transportType: config.transportType === "same_origin_endpoint" ? "same_origin_endpoint" : "http_endpoint",
    testOnly: false,
    async getStatus() {
      if (!config.enabled || !endpoint) {
        return {
          state: "not_configured",
          message: "BoardState validation requires a configured bridge.",
          transportType: "unavailable",
          authoritativeAvailable: false,
          testOnly: false,
        };
      }

      if (!isBoardStateRemoteEndpointAllowed(endpoint)) {
        return {
          state: "error",
          message: "BoardState endpoint must use HTTPS in production.",
          transportType: this.transportType,
          authoritativeAvailable: false,
          testOnly: false,
        };
      }

      return {
        state: "checking",
        message: "BoardState bridge endpoint is configured; capabilities have not been confirmed.",
        transportType: this.transportType,
        authoritativeAvailable: false,
        testOnly: false,
      };
    },
    async getCapabilities(signal?: AbortSignal): Promise<BoardStateCapabilities> {
      const base = assertConfigured();
      const { value } = await fetchJson<BoardStateCapabilities>({
        url: joinEndpoint(base, "capabilities"),
        signal,
        timeoutMs: config.requestTimeoutMs,
      });
      return value;
    },
    async validateDeckSnapshot(
      request: BoardStateValidationRequest,
      signal?: AbortSignal,
    ): Promise<BoardStateValidationResponse> {
      const base = assertConfigured();
      const { value, statusCode, responseTimeMs } = await fetchJson<BoardStateValidationResponse>({
        url: joinEndpoint(base, "validate-deck"),
        method: "POST",
        body: request,
        signal,
        timeoutMs: config.requestTimeoutMs,
      });
      return {
        ...value,
        transportMetadata: {
          ...(value.transportMetadata ?? {}),
          transportType: this.transportType,
          endpoint: base,
          statusCode,
          responseTimeMs,
          testOnly: false,
        },
      };
    },
    async healthCheck(signal?: AbortSignal) {
      const capabilities = await this.getCapabilities(signal);
      return {
        state: "compatible",
        message: `BoardState bridge capabilities received from ${capabilities.authorityApplicationVersion}.`,
        transportType: this.transportType,
        authoritativeAvailable: true,
        testOnly: false,
      };
    },
  };
}
