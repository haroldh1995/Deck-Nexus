import type { ScannerConfirmationVolume } from "../../types/domain";

export interface ScanFeedbackPreferences {
  soundEnabled: boolean;
  volume: ScannerConfirmationVolume;
  hapticEnabled: boolean;
}

export interface ScanFeedbackController {
  prime: () => Promise<void>;
  playAccepted: (preferences: ScanFeedbackPreferences) => Promise<void>;
  close: () => Promise<void>;
}

type AudioContextConstructor = new () => AudioContext;

function getAudioContextConstructor(): AudioContextConstructor | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
}

export function gainForScanVolume(volume: ScannerConfirmationVolume): number {
  if (volume === "high") {
    return 0.085;
  }

  if (volume === "medium") {
    return 0.052;
  }

  return 0.028;
}

export function createScanFeedbackController(): ScanFeedbackController {
  let context: AudioContext | undefined;

  async function getContext(): Promise<AudioContext | undefined> {
    const AudioContextClass = getAudioContextConstructor();
    if (!AudioContextClass) {
      return undefined;
    }

    context ??= new AudioContextClass();
    if (context.state === "suspended") {
      try {
        await context.resume();
      } catch {
        return context;
      }
    }
    return context;
  }

  return {
    async prime() {
      await getContext();
    },

    async playAccepted(preferences) {
      if (preferences.hapticEnabled && "vibrate" in navigator) {
        try {
          navigator.vibrate?.(28);
        } catch {
          // Haptic support varies heavily across browsers and platforms.
        }
      }

      if (!preferences.soundEnabled) {
        return;
      }

      const activeContext = await getContext();
      if (!activeContext) {
        return;
      }

      const oscillator = activeContext.createOscillator();
      const gain = activeContext.createGain();
      const now = activeContext.currentTime;
      const peakGain = gainForScanVolume(preferences.volume);

      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(880, now);
      oscillator.frequency.exponentialRampToValueAtTime(1120, now + 0.07);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
      oscillator.connect(gain);
      gain.connect(activeContext.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.105);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };

      window.dispatchEvent(new CustomEvent("deck-nexus:scan-beep"));
    },

    async close() {
      if (!context) {
        return;
      }

      if (context.state !== "closed") {
        await context.close().catch(() => undefined);
      }
      context = undefined;
    },
  };
}
