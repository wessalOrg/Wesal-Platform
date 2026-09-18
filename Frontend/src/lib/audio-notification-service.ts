export type AudioPermissionStatus = "pending" | "allowed" | "blocked" | "failed";

export type AudioPermissionSnapshot = {
  status: AudioPermissionStatus;
  muted: boolean;
  missedAlert: boolean;
};

type Listener = () => void;

const MUTE_KEY = "wesal_owner_audio_muted";

type WindowWithWebkitAudio = Window & {
  webkitAudioContext?: typeof AudioContext;
};

function createAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || (window as WindowWithWebkitAudio).webkitAudioContext;
  if (!Ctor) return null;
  return new Ctor();
}

function readMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* ignore quota */
  }
}

function logAudioFailure(error: unknown) {
  if (process.env.NODE_ENV === "production") return;
  console.debug("Booking alert audio could not play", error);
}

/**
 * Singleton Web Audio chime + permission/mute state.
 * Playback never throws into the visual notification path.
 */
class AudioNotificationService {
  private context: AudioContext | null = null;
  private gesturesBound = false;
  private playing = false;
  private status: AudioPermissionStatus = "pending";
  private muted = false;
  private missedAlert = false;
  private snapshot: AudioPermissionSnapshot;
  private readonly listeners = new Set<Listener>();
  private stateHandler: (() => void) | null = null;

  constructor() {
    this.muted = readMuted();
    this.snapshot = this.buildSnapshot();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): AudioPermissionSnapshot {
    return this.snapshot;
  }

  private buildSnapshot(): AudioPermissionSnapshot {
    return {
      status: this.status,
      muted: this.muted,
      missedAlert: this.missedAlert,
    };
  }

  private notify() {
    this.snapshot = this.buildSnapshot();
    this.listeners.forEach((listener) => listener());
  }

  private setStatus(next: AudioPermissionStatus) {
    if (this.status === next) return;
    this.status = next;
    this.notify();
  }

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context;
    this.context = createAudioContext();
    if (!this.context) {
      this.setStatus("failed");
      return null;
    }
    this.stateHandler = () => {
      if (!this.context) return;
      if (this.context.state === "running") this.setStatus("allowed");
      else if (this.context.state === "closed") this.setStatus("failed");
    };
    this.context.addEventListener("statechange", this.stateHandler);
    return this.context;
  }

  private onGesture = () => {
    void this.unlock();
  };

  bindUnlockGestures() {
    if (typeof window === "undefined" || this.gesturesBound) return;
    this.gesturesBound = true;
    window.addEventListener("pointerdown", this.onGesture, true);
    window.addEventListener("keydown", this.onGesture, true);
    window.addEventListener("touchstart", this.onGesture, true);
  }

  unbindUnlockGestures() {
    if (typeof window === "undefined" || !this.gesturesBound) return;
    this.gesturesBound = false;
    window.removeEventListener("pointerdown", this.onGesture, true);
    window.removeEventListener("keydown", this.onGesture, true);
    window.removeEventListener("touchstart", this.onGesture, true);
  }

  setMuted(muted: boolean) {
    if (this.muted === muted) return;
    this.muted = muted;
    writeMuted(muted);
    this.notify();
  }

  clearMissedAlert() {
    if (!this.missedAlert) return;
    this.missedAlert = false;
    this.notify();
  }

  private markMissedAlert() {
    if (this.missedAlert) return;
    this.missedAlert = true;
    this.notify();
  }

  async unlock(): Promise<boolean> {
    const context = this.ensureContext();
    if (!context) return false;
    try {
      if (context.state === "suspended") {
        await context.resume();
      }
      const allowed = context.state === "running";
      this.setStatus(allowed ? "allowed" : "blocked");
      if (allowed) this.clearMissedAlert();
      return allowed;
    } catch (error) {
      this.setStatus("blocked");
      logAudioFailure(error);
      return false;
    }
  }

  async enable(): Promise<boolean> {
    this.setMuted(false);
    return this.unlock();
  }

  async playAlert(): Promise<boolean> {
    try {
      if (this.muted) return false;
      const allowed = await this.unlock();
      const context = this.ensureContext();
      if (!context || !allowed || this.playing) {
        if (!this.muted) this.markMissedAlert();
        return false;
      }

      this.playing = true;
      const now = context.currentTime;
      this.tone(context, 523.25, now, 0.16);
      this.tone(context, 659.25, now + 0.12, 0.18);

      window.setTimeout(() => {
        this.playing = false;
      }, 400);
      return true;
    } catch (error) {
      this.playing = false;
      this.setStatus("failed");
      this.markMissedAlert();
      logAudioFailure(error);
      return false;
    }
  }

  private tone(context: AudioContext, frequency: number, start: number, duration: number) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.07, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
}

let instance: AudioNotificationService | null = null;

export function getAudioNotificationService(): AudioNotificationService {
  if (!instance) instance = new AudioNotificationService();
  return instance;
}

export function getAudioPermissionSnapshot(): AudioPermissionSnapshot {
  return getAudioNotificationService().getSnapshot();
}

export function subscribeAudioPermission(listener: Listener): () => void {
  return getAudioNotificationService().subscribe(listener);
}
