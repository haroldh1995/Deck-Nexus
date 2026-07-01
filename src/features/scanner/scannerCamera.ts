export type CameraPermissionState =
  | "prompt"
  | "granted"
  | "denied"
  | "unavailable"
  | "unknown"
  | "stream_error"
  | "device_busy"
  | "no_device"
  | "insecure_context";

export interface CameraDeviceOption {
  deviceId: string;
  label: string;
  groupId?: string;
  facing: "environment" | "user" | "unknown";
}

export interface CameraZoomCapability {
  min: number;
  max: number;
  step: number;
  current?: number;
}

export interface CameraCapabilities {
  torchSupported: boolean;
  zoom?: CameraZoomCapability;
  focusModes: string[];
}

export interface CameraStartResult {
  stream: MediaStream;
  devices: CameraDeviceOption[];
  selectedDeviceId?: string;
  capabilities: CameraCapabilities;
  permissionState: CameraPermissionState;
}

export interface CameraSupportStatus {
  supported: boolean;
  state: CameraPermissionState;
  title: string;
  detail: string;
}

type MediaTrackCapabilitiesWithTorch = MediaTrackCapabilities & {
  torch?: boolean;
  zoom?: {
    min?: number;
    max?: number;
    step?: number;
  };
  focusMode?: string[];
};

type MediaTrackSettingsWithZoom = MediaTrackSettings & {
  zoom?: number;
};

function labelForCamera(device: MediaDeviceInfo, index: number): string {
  const label = device.label.trim();
  if (label) {
    if (/back|rear|environment/i.test(label)) {
      return /wide/i.test(label)
        ? "Rear Wide Camera"
        : /tele/i.test(label)
          ? "Rear Telephoto Camera"
          : "Rear Camera";
    }

    if (/front|user|facetime/i.test(label)) {
      return "Front Camera";
    }

    return label;
  }

  return `Camera ${index + 1}`;
}

function facingForCamera(device: MediaDeviceInfo): CameraDeviceOption["facing"] {
  if (/back|rear|environment/i.test(device.label)) {
    return "environment";
  }

  if (/front|user|facetime/i.test(device.label)) {
    return "user";
  }

  return "unknown";
}

export function getCameraSupportStatus(): CameraSupportStatus {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      supported: false,
      state: "unavailable",
      title: "Camera unavailable",
      detail: "Camera scanning needs a browser environment with media-device support.",
    };
  }

  if (!window.isSecureContext && window.location.hostname !== "localhost") {
    return {
      supported: false,
      state: "insecure_context",
      title: "Camera scanning requires a secure HTTPS connection.",
      detail: "Open the live secure app or serve Deckstate through HTTPS or localhost before scanning.",
    };
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      supported: false,
      state: "unavailable",
      title: "Camera access is unavailable in this browser.",
      detail: "Use a browser that supports getUserMedia, or use manual entry instead.",
    };
  }

  return {
    supported: true,
    state: "prompt",
    title: "Camera ready",
    detail: "Deckstate can request camera access when you tap Allow Camera.",
  };
}

export async function queryCameraPermissionState(): Promise<CameraPermissionState> {
  if (!navigator.permissions?.query) {
    return "unknown";
  }

  try {
    const status = await navigator.permissions.query({
      name: "camera" as PermissionName,
    });
    if (status.state === "granted" || status.state === "denied" || status.state === "prompt") {
      return status.state;
    }
  } catch {
    return "unknown";
  }

  return "unknown";
}

function preferredConstraints(deviceId?: string): MediaStreamConstraints {
  if (deviceId) {
    return {
      audio: false,
      video: {
        deviceId: { exact: deviceId },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30, max: 60 },
      },
    };
  }

  return {
    audio: false,
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30, max: 60 },
    },
  };
}

const fallbackConstraints: MediaStreamConstraints[] = [
  {
    audio: false,
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 24, max: 30 },
    },
  },
  {
    audio: false,
    video: true,
  },
];

export async function enumerateCameraDevices(): Promise<CameraDeviceOption[]> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return [];
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((device) => device.kind === "videoinput")
    .map((device, index) => ({
      deviceId: device.deviceId,
      groupId: device.groupId,
      label: labelForCamera(device, index),
      facing: facingForCamera(device),
    }));
}

export function getCameraCapabilities(stream: MediaStream): CameraCapabilities {
  const [track] = stream.getVideoTracks();
  if (!track?.getCapabilities) {
    return {
      torchSupported: false,
      focusModes: [],
    };
  }

  const capabilities = track.getCapabilities() as MediaTrackCapabilitiesWithTorch;
  const settings = track.getSettings?.() as MediaTrackSettingsWithZoom | undefined;
  const zoom = capabilities.zoom
    ? {
        min: capabilities.zoom.min ?? 1,
        max: capabilities.zoom.max ?? 1,
        step: capabilities.zoom.step ?? 0.1,
        current: settings?.zoom,
      }
    : undefined;

  return {
    torchSupported: Boolean(capabilities.torch),
    zoom,
    focusModes: capabilities.focusMode ?? [],
  };
}

export function stopCameraStream(stream?: MediaStream | null): void {
  stream?.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // Stopping an already-ended track is harmless.
    }
  });
}

export async function openCameraStream(deviceId?: string): Promise<CameraStartResult> {
  const support = getCameraSupportStatus();
  if (!support.supported) {
    throw Object.assign(new Error(support.detail), {
      name: support.state,
    });
  }

  const attempts = [preferredConstraints(deviceId), ...fallbackConstraints];
  let lastError: unknown;

  for (const constraints of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const devices = await enumerateCameraDevices();
      const [track] = stream.getVideoTracks();
      return {
        stream,
        devices,
        selectedDeviceId: track?.getSettings?.().deviceId ?? deviceId,
        capabilities: getCameraCapabilities(stream),
        permissionState: "granted",
      };
    } catch (error) {
      lastError = error;
      if (deviceId) {
        break;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Camera stream failed.");
}

export async function applyTorchToStream(
  stream: MediaStream | null | undefined,
  enabled: boolean,
): Promise<boolean> {
  const [track] = stream?.getVideoTracks() ?? [];
  if (!track) {
    return false;
  }

  const capabilities = track.getCapabilities?.() as MediaTrackCapabilitiesWithTorch | undefined;
  if (!capabilities?.torch || !track.applyConstraints) {
    return false;
  }

  await track.applyConstraints({
    advanced: [{ torch: enabled } as MediaTrackConstraintSet],
  });
  return true;
}

export async function applyZoomToStream(
  stream: MediaStream | null | undefined,
  zoom: number,
): Promise<boolean> {
  const [track] = stream?.getVideoTracks() ?? [];
  if (!track?.applyConstraints) {
    return false;
  }

  const capabilities = track.getCapabilities?.() as MediaTrackCapabilitiesWithTorch | undefined;
  if (!capabilities?.zoom) {
    return false;
  }

  const min = capabilities.zoom.min ?? 1;
  const max = capabilities.zoom.max ?? min;
  const clamped = Math.min(max, Math.max(min, zoom));
  await track.applyConstraints({
    advanced: [{ zoom: clamped } as MediaTrackConstraintSet],
  });
  return true;
}

export function mapCameraError(error: unknown): {
  state: CameraPermissionState;
  title: string;
  detail: string;
  action: string;
} {
  const name = error instanceof DOMException || error instanceof Error ? error.name : "";

  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return {
      state: "denied",
      title: "Camera access is blocked.",
      detail: "Enable camera access for this site in your browser or device settings, then return and try again.",
      action: "Try Again",
    };
  }

  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return {
      state: "no_device",
      title: "No camera was found on this device.",
      detail: "Connect a camera or use manual entry instead.",
      action: "Retry",
    };
  }

  if (name === "NotReadableError" || name === "TrackStartError") {
    return {
      state: "device_busy",
      title: "The camera is currently being used by another app or browser tab.",
      detail: "Close the other camera session, then try compatible camera mode again.",
      action: "Try Compatible Mode",
    };
  }

  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
    return {
      state: "stream_error",
      title: "Preferred rear-camera settings are unavailable.",
      detail: "Deckstate can try a compatible camera mode.",
      action: "Try Compatible Mode",
    };
  }

  if (name === "SecurityError" || name === "insecure_context") {
    return {
      state: "insecure_context",
      title: "Camera scanning requires a secure HTTPS connection.",
      detail: "Open the live secure app or use localhost/HTTPS before scanning.",
      action: "Open Live Secure App",
    };
  }

  return {
    state: "stream_error",
    title: "Camera stream failed.",
    detail: "Refresh the camera or use manual entry while keeping the active batch saved.",
    action: "Retry",
  };
}
