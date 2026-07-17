import type {
  BoardStateTransportCapability,
  BoardStateHandoffTransportType,
  BoardStateTransportRuntime,
} from "./contracts";

const defaultLimits: Record<BoardStateHandoffTransportType, number> = {
  direct_web: 96_000,
  post_message: 2_000_000,
  same_origin: 2_000_000,
  custom_uri: 2_000,
  android_intent: 2_000,
  file_export: 25_000_000,
  clipboard: 256_000,
  web_share: 25_000_000,
  qr_code: 1_200,
  manual_import: 25_000_000,
  future_hub: 0,
};

function browserRuntime(): BoardStateTransportRuntime {
  if (typeof window === "undefined") {
    return {};
  }
  const nav = window.navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean;
    share?: (data?: ShareData) => Promise<void>;
  };
  let webShareFilesAvailable = false;
  if (typeof nav.canShare === "function" && typeof File !== "undefined") {
    try {
      webShareFilesAvailable = nav.canShare({
        files: [new File(["{}"], "deck-nexus-boardstate.json", { type: "application/json" })],
      });
    } catch {
      webShareFilesAvailable = false;
    }
  }
  return {
    clipboardAvailable: Boolean(nav.clipboard?.writeText),
    webShareAvailable: Boolean(nav.share),
    webShareFilesAvailable,
    fileDownloadAvailable: typeof document !== "undefined",
    online: nav.onLine,
  };
}

function configuredBoardStateUrl(): string | undefined {
  const value = import.meta.env.VITE_BOARDSTATE_WEB_URL as string | undefined;
  if (!value) {
    return undefined;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function getBoardStateTransportCapabilities(
  payloadSize = 0,
  runtime: BoardStateTransportRuntime = browserRuntime(),
): BoardStateTransportCapability[] {
  const directUrl = configuredBoardStateUrl();
  const fileAvailable = runtime.fileDownloadAvailable !== false;
  const clipboardAvailable = Boolean(runtime.clipboardAvailable);
  const webShareAvailable = Boolean(runtime.webShareAvailable && runtime.webShareFilesAvailable);
  const online = runtime.online !== false;
  const sizeOk = (type: BoardStateHandoffTransportType) => payloadSize <= defaultLimits[type];

  return [
    {
      type: "direct_web",
      label: "Direct BoardState web handoff",
      status: directUrl && online && sizeOk("direct_web")
        ? "configured_but_unverified"
        : "unavailable",
      supportsAcknowledgment: Boolean(directUrl),
      supportsReturn: Boolean(directUrl),
      maxPayloadBytes: defaultLimits.direct_web,
      reason: directUrl
        ? "BoardState web URL is configured, but import acknowledgment must still confirm receipt."
        : "No real BoardState web import URL is configured.",
    },
    {
      type: "post_message",
      label: "postMessage handoff",
      status: "unavailable",
      supportsAcknowledgment: true,
      supportsReturn: true,
      maxPayloadBytes: defaultLimits.post_message,
      reason: "No trusted BoardState postMessage origin is configured.",
    },
    {
      type: "same_origin",
      label: "Same-origin handoff",
      status: "unavailable",
      supportsAcknowledgment: true,
      supportsReturn: true,
      maxPayloadBytes: defaultLimits.same_origin,
      reason: "Deck Nexus and BoardState do not currently share a verified same-origin bridge.",
    },
    {
      type: "custom_uri",
      label: "BoardState app link",
      status: "unavailable",
      supportsAcknowledgment: false,
      supportsReturn: false,
      maxPayloadBytes: defaultLimits.custom_uri,
      reason: "No real BoardState custom URI or universal link contract is configured.",
    },
    {
      type: "android_intent",
      label: "Android intent",
      status: "unavailable",
      supportsAcknowledgment: false,
      supportsReturn: false,
      maxPayloadBytes: defaultLimits.android_intent,
      reason: "No verified BoardState Android package or intent URL is configured.",
    },
    {
      type: "file_export",
      label: "File export",
      status: fileAvailable && sizeOk("file_export") ? "available" : "unavailable",
      supportsAcknowledgment: false,
      supportsReturn: false,
      maxPayloadBytes: defaultLimits.file_export,
      reason: fileAvailable
        ? "Download a BoardState-compatible file and import it manually."
        : "File downloads are unavailable in this environment.",
    },
    {
      type: "clipboard",
      label: "Clipboard payload",
      status: clipboardAvailable && sizeOk("clipboard")
        ? "available"
        : payloadSize > defaultLimits.clipboard
          ? "incompatible"
          : "unavailable",
      supportsAcknowledgment: false,
      supportsReturn: false,
      maxPayloadBytes: defaultLimits.clipboard,
      reason: clipboardAvailable
        ? "Copy a compact BoardState payload. Import remains unconfirmed."
        : "Clipboard writing is unavailable.",
    },
    {
      type: "web_share",
      label: "Web Share file",
      status: webShareAvailable && sizeOk("web_share") ? "available" : "unavailable",
      supportsAcknowledgment: false,
      supportsReturn: false,
      maxPayloadBytes: defaultLimits.web_share,
      reason: webShareAvailable
        ? "Open the browser share sheet for the BoardState file."
        : "Web Share file support is unavailable.",
    },
    {
      type: "qr_code",
      label: "QR transfer",
      status: payloadSize > 0 && sizeOk("qr_code") ? "available" : "incompatible",
      supportsAcknowledgment: false,
      supportsReturn: false,
      maxPayloadBytes: defaultLimits.qr_code,
      reason: sizeOk("qr_code")
        ? "Compact payload fits a local QR transfer."
        : "Payload is too large for a practical local QR code.",
    },
    {
      type: "manual_import",
      label: "Manual import instructions",
      status: "requires_manual_import",
      supportsAcknowledgment: false,
      supportsReturn: false,
      maxPayloadBytes: defaultLimits.manual_import,
      reason: "Prepare the package locally and import it in BoardState when supported.",
    },
    {
      type: "future_hub",
      label: "Future Hub route",
      status: "unavailable",
      supportsAcknowledgment: false,
      supportsReturn: false,
      maxPayloadBytes: defaultLimits.future_hub,
      reason: "Hub routing belongs to a later prompt and is not connected.",
    },
  ];
}

export function findTransportCapability(
  type: BoardStateHandoffTransportType,
  payloadSize = 0,
  runtime?: BoardStateTransportRuntime,
): BoardStateTransportCapability {
  return getBoardStateTransportCapabilities(payloadSize, runtime).find(
    (capability) => capability.type === type,
  ) ?? {
    type,
    label: type,
    status: "unavailable",
    supportsAcknowledgment: false,
    supportsReturn: false,
    maxPayloadBytes: 0,
    reason: "Transport is not registered.",
  };
}
