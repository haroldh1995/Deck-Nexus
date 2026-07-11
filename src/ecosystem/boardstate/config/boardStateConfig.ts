import {
  BOARDSTATE_COMPATIBILITY_VERSION,
  type BoardStateBridgeConfig,
  type BoardStateTransportType,
} from "../contracts/validationContracts";

function envValue(name: string): string | undefined {
  const value = import.meta.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseEnabled(value: string | undefined): boolean {
  return value === "true" || value === "1";
}

function parseTimeout(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 30_000) : 10_000;
}

function parseTransport(value: string | undefined): BoardStateTransportType {
  if (value === "http_endpoint" || value === "same_origin_endpoint") {
    return value;
  }
  return "unavailable";
}

export function getBoardStateBridgeConfig(): BoardStateBridgeConfig {
  const endpoint = envValue("VITE_BOARDSTATE_ENDPOINT");
  const enabled = parseEnabled(envValue("VITE_BOARDSTATE_BRIDGE_ENABLED"));
  const transportType = enabled ? parseTransport(envValue("VITE_BOARDSTATE_TRANSPORT")) : "unavailable";

  return {
    enabled,
    endpoint,
    transportType: endpoint && transportType === "unavailable" ? "http_endpoint" : transportType,
    compatibilityVersion:
      envValue("VITE_BOARDSTATE_COMPATIBILITY_VERSION") ?? BOARDSTATE_COMPATIBILITY_VERSION,
    requestTimeoutMs: parseTimeout(envValue("VITE_BOARDSTATE_REQUEST_TIMEOUT_MS")),
    allowedOrigin: envValue("VITE_BOARDSTATE_ALLOWED_ORIGIN"),
  };
}

export function isBoardStateRemoteEndpointAllowed(endpoint: string): boolean {
  try {
    const parsed = new URL(endpoint, window.location.origin);
    const isLocal =
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "::1";
    return parsed.protocol === "https:" || (import.meta.env.DEV && isLocal);
  } catch {
    return false;
  }
}
