// Optional camera noise. Opt-in, off by default (CLAUDE.md section 7.4).
// Frames are analysed and hashed here in the browser; only a 32-byte digest
// ever leaves the device. Sensor noise lives in the low bits, so frames are
// hashed at capture size rather than downscaled first.

/** Capture size. Small enough to hash every frame, large enough to keep sensor noise. */
const FRAME_WIDTH = 160;
const FRAME_HEIGHT = 120;
/** Luma variance (0..255 scale, squared) below which the lens counts as covered. */
const COVERED_VARIANCE = 16;
/** How often the covered check runs while the camera is on, ms. */
const HEALTH_INTERVAL_MS = 1000;
const HISTORY = 64;

export interface LumaStats {
  mean: number;
  variance: number;
}

/** Mean and variance of Rec. 601 luma over an RGBA buffer. */
export function lumaStats(rgba: Uint8Array | Uint8ClampedArray): LumaStats {
  const n = Math.floor(rgba.length / 4);
  if (n === 0) return { mean: 0, variance: 0 };
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < n * 4; i += 4) {
    const y = 0.299 * rgba[i]! + 0.587 * rgba[i + 1]! + 0.114 * rgba[i + 2]!;
    sum += y;
    sumSq += y * y;
  }
  const mean = sum / n;
  return { mean, variance: Math.max(0, sumSq / n - mean * mean) };
}

/** A covered lens (or a flat fake feed) produces an almost uniform frame. */
export function isCovered(stats: LumaStats): boolean {
  return stats.variance < COVERED_VARIANCE;
}

export interface CameraCapture {
  /** 32-byte digest, or null when the frame failed a health check. */
  digest: Uint8Array | null;
  reason: "ok" | "covered" | "repeated";
}

export class CameraSource {
  accepted = 0;
  rejected = 0;
  covered = false;
  /** Called when the covered state changes. */
  onHealth: (covered: boolean) => void = () => {};

  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private readonly canvas = document.createElement("canvas");
  private readonly ctx: CanvasRenderingContext2D;
  private recent: string[] = [];
  private timer = 0;

  constructor() {
    this.canvas.width = FRAME_WIDTH;
    this.canvas.height = FRAME_HEIGHT;
    const ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("2D canvas unavailable");
    this.ctx = ctx;
    // Never leave the camera running in a background tab.
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.disable();
    });
  }

  get enabled(): boolean {
    return this.stream !== null;
  }

  /** Asks for permission only now, when the user turns the camera on. */
  async enable(): Promise<void> {
    if (this.stream) return;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: FRAME_WIDTH * 2 }, height: { ideal: FRAME_HEIGHT * 2 } },
      audio: false,
    });
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();
    this.stream = stream;
    this.video = video;
    this.timer = window.setInterval(() => this.checkHealth(), HEALTH_INTERVAL_MS);
  }

  /** Stops every track. Safe to call when already off. */
  disable(): void {
    window.clearInterval(this.timer);
    this.stream?.getTracks().forEach((t) => t.stop());
    if (this.video) this.video.srcObject = null;
    this.stream = null;
    this.video = null;
    this.setCovered(false);
  }

  /** Hash one frame. Returns null digest when covered or repeated. */
  async capture(): Promise<CameraCapture | null> {
    const pixels = this.grab();
    if (!pixels) return null;
    const stats = lumaStats(pixels);
    this.setCovered(isCovered(stats));
    if (this.covered) {
      this.rejected++;
      return { digest: null, reason: "covered" };
    }
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", pixels as BufferSource));
    const key = Array.from(digest.subarray(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
    if (this.recent.includes(key)) {
      this.rejected++;
      return { digest: null, reason: "repeated" };
    }
    this.recent.push(key);
    if (this.recent.length > HISTORY) this.recent.shift();
    this.accepted++;
    return { digest, reason: "ok" };
  }

  private grab(): Uint8ClampedArray | null {
    if (!this.video || this.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return null;
    this.ctx.drawImage(this.video, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
    return this.ctx.getImageData(0, 0, FRAME_WIDTH, FRAME_HEIGHT).data;
  }

  private checkHealth(): void {
    const pixels = this.grab();
    if (pixels) this.setCovered(isCovered(lumaStats(pixels)));
  }

  private setCovered(covered: boolean): void {
    if (covered === this.covered) return;
    this.covered = covered;
    this.onHealth(covered);
  }
}
