import "@fontsource/unbounded/300.css";
import "@fontsource/unbounded/600.css";
import "@fontsource/inter-tight/400.css";
import "@fontsource/inter-tight/500.css";
import "@fontsource/jetbrains-mono/400.css";
import "./ui/styles.css";
import "./ui/verdict.css";
import { LavaGuard } from "./guard/session";
import { LavaObserver } from "./guard/observer";
import { GuardLab } from "./guard/lab";

import { Lamp } from "./lamp/lamp";
import { LAMP, STIR } from "./lamp/constants";
import { StirController } from "./stir/controller";
import { SnapshotSource } from "./entropy/snapshot";
import { CameraSource } from "./entropy/camera";
import { currentUser, login, logout, register, revokeAll, type User } from "./auth/passkeys";
import { prefersReducedMotion, onReducedMotionChange } from "./a11y/motion";
import { announce } from "./a11y/announce";
import { $, showScreen, trackControlsHeight } from "./ui/dom";
import { EntropyRing } from "./ui/ring";
import { showStatus } from "./ui/status";
import { messageFor } from "./ui/messages";
import { Wax } from "./ui/wax";
import { CameraControl } from "./ui/camera-control";
import { Lab, type LampHealth } from "./ui/lab";
import "./ui/lab.css";

// ---------------------------------------------------------------- lamp setup

let lamp: Lamp | null = null;
try {
  lamp = new Lamp($("#lamp") as HTMLCanvasElement);
} catch {
  // No WebGL 2: static gradient fallback. Auth still works.
  document.body.classList.add("no-webgl");
}

const applyMotion = (reduced: boolean) => {
  if (lamp) lamp.physics.speed = reduced ? LAMP.REDUCED_MOTION_SPEED : 1;
};
applyMotion(prefersReducedMotion());
onReducedMotionChange(applyMotion);

trackControlsHeight(); // screens and Lab mode stay clear of the lamp controls

// Every auth event's wax response lives in ui/wax.ts.
const wax = new Wax(lamp, () => camera.enabled && camera.covered);

// Landing: the cursor is a gentle heat source.
let screen: "landing" | "choose" | "stir" | "waiting" | "success" = "landing";
let cursor: { x: number; y: number } | null = null;
window.addEventListener("pointermove", (e) => {
  if (lamp) cursor = lamp.renderer.toWorld(e.clientX, e.clientY);
}, { passive: true });

// Lamp snapshots, taken right after a frame renders.
const snapshots = new SnapshotSource();
let snapshotRequest: ((pixels: Uint8Array) => void) | null = null;
function takeSnapshot(): Promise<Uint8Array | null> {
  if (!lamp || lamp.isPaused || lamp.freeze >= 1) return Promise.resolve(null);
  return new Promise((resolve) => {
    snapshotRequest = async (pixels) => {
      const { digest, accepted } = await snapshots.capture(pixels);
      if (!accepted) wax.fizzle(); // repeated snapshot fizzles
      resolve(accepted ? digest : null);
    };
  });
}

// Optional camera noise: off until the user turns it on.
const camera = new CameraSource();
const cameraControl = new CameraControl(camera, wax);

// Lab mode: the pipeline, live, from real counters.
const lab = new Lab({ snapshots, camera, lampHealth });

const ring = new EntropyRing();
const ringArc = $("[data-ring-arc]");
const stir = lamp
  ? new StirController(lamp.renderer, lamp.physics, {
      onProgress: (bits, progress) => {
        ring.set(bits, progress);
        lab.stirring(bits);
      },
      onTooRegular: () => {
        ring.stall();
        showStatus("Too regular, keep stirring.");
      },
    })
  : null;

const guardLab = new GuardLab();
void guardLab.init().catch(() => {});
const bubbleIds = new WeakMap<object, number>();
let nextBubbleId = 0;
const observer = new LavaObserver(ringArc, (x, y) => {
  if (!lamp) return { distance: 1, remaining: 0 };
  const p = lamp.renderer.toWorld(x, y), physics = lamp.physics;
  const diameter = (physics.ring?.radius ?? .3) * 2;
  const nearest = physics.blobs.filter(b => !physics.ring?.isOut(b)).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
  if (nearest && !bubbleIds.has(nearest)) bubbleIds.set(nearest, nextBubbleId++);
  const bounds = ringArc.getBoundingClientRect();
  const worldPerPixel = lamp.renderer.toWorld(1, 0).x;
  return { distance: Math.max(0, Math.min(diameter, ...physics.blobs.map(b => Math.hypot(b.x - p.x, b.y - p.y) - b.r))) / diameter,
    remaining: physics.blobs.filter(b => !physics.ring?.isOut(b)).length,
    targetX: nearest ? (x - bounds.left + (nearest.x - p.x) / worldPerPixel) / bounds.width : undefined,
    targetY: nearest ? (y - bounds.top - (nearest.y - p.y) / worldPerPixel) / bounds.height : undefined,
    targetId: nearest ? bubbleIds.get(nearest) : undefined };
});
const guard = new LavaGuard(stir, observer, () => wax.fillRing(ringArc), (summary, decision, samples) => guardLab.report(summary, decision, samples), () => guardLab.begin());
window.addEventListener("pagehide", () => { guard.cancel(); guardLab.clear(); });

if (lamp) {
  lamp.onStep = (dt) => {
    if (screen === "landing" && cursor) lamp!.physics.heatAt(cursor.x, cursor.y, dt);
    if (screen === "stir") wax.trackRing(ringArc); // follow resizes and Lab mode's split
    stir?.update(dt);
  };
  lamp.onFrame = () => {
    if (snapshotRequest) {
      const request = snapshotRequest;
      snapshotRequest = null;
      void request(lamp!.renderer.readCentre());
    }
  };
  lamp.start();
}

// ---------------------------------------------------------------- screens

function go(next: typeof screen): void {
  if (next !== "stir") wax.releaseRing();
  screen = next;
  showScreen(next);
}

// Clear the ring: Sign in only appears once all the wax is out.
let authBusy = false;

function setLampPaused(paused: boolean): void {
  if (!lamp) return;
  lamp.setPaused(paused);
  const button = $("[data-action=pause]");
  button.setAttribute("aria-pressed", String(paused));
  button.textContent = paused ? "Resume lamp" : "Pause lamp";
}

function signedIn(user: User): void {
  $("[data-username]").textContent = user.username;
  go("success");
  announce(`Signed in as ${user.username}`);
}

const waitingText = $("[data-waiting-text]");
const signupForm = $("[data-form=signup]") as HTMLFormElement;
const usernameInput = $("#username") as HTMLInputElement;

async function startSignIn(accessible = false): Promise<void> {
  if (authBusy) return;
  go("stir");
  if (lamp?.isPaused) setLampPaused(false); // a paused lamp can't be stirred
  announce("Stir all the wax out of the ring to sign in.");
  const result = await guard.run(accessible || !stir ? "accessible" : "gesture");
  if (screen !== "stir" || !result) return;
  lab.stirFinished(!stir);
  authBusy = true;

  // The wax gathers back before the passkey prompt.
  wax.gather(STIR.RETURN_SECONDS * 1000);
  waitingText.textContent = "Touch your sensor to sign in";
  go("waiting");
  wax.melt(); // your entropy joining the lamp

  try {
    const lampDigest = await takeSnapshot();
    const digests = { stir: result.digest, lamp: lampDigest, camera: await cameraControl.digest() };
    lab.sent(digests);
    const user = await login(digests, result.clearance);
    wax.warmUp();
    signedIn(user);
  } catch (err) {
    wax.fail(err);
    showStatus(messageFor(err));
    go("choose");
  } finally {
    authBusy = false;
  }
}

async function startSignUp(username: string): Promise<void> {
  if (authBusy) return;
  authBusy = true;
  waitingText.textContent = "Confirm with your device to create your passkey";
  go("waiting");
  wax.portal();
  try {
    const lampDigest = await takeSnapshot();
    const digests = { stir: null, lamp: lampDigest, camera: await cameraControl.digest() };
    lab.sent(digests);
    const user = await register(username, digests);
    wax.burst();
    wax.warmUp();
    signedIn(user);
  } catch (err) {
    wax.fail(err);
    showStatus(messageFor(err));
    go("choose");
    signupForm.hidden = false;
  } finally {
    authBusy = false;
  }
}

// ---------------------------------------------------------------- actions

document.addEventListener("click", (e) => {
  const target = (e.target as HTMLElement).closest<HTMLElement>("[data-action]");
  if (!target) return;
  switch (target.dataset.action) {
    case "enter":
      wax.gather();
      go("choose");
      break;
    case "signin":
      signupForm.hidden = true;
      void startSignIn();
      break;
    case "show-signup":
      signupForm.hidden = false;
      usernameInput.focus();
      break;
    case "passkey":
      guard.continue();
      break;
    case "guard-retry":
      void startSignIn();
      break;
      case "guard-verify":
        void guard.verify();
        break;
    case "guard-accessible":
      wax.releaseRing();
      void startSignIn(true);
      break;
    case "back":
      guard.cancel();
      go("choose");
      break;
    case "signout":
      void logout().finally(() => {
        wax.coolDown();
        go("landing");
        announce("Signed out");
      });
      break;
    case "revoke-all":
      void revokeAll().finally(() => {
        wax.coolDown();
        go("landing");
        showStatus("Signed out on every device.");
      });
      break;
    case "camera":
      cameraControl.toggle();
      break;
    case "lab":
      lab.toggle();
      break;
    case "pause":
      if (lamp) setLampPaused(!lamp.isPaused);
      break;
  }
});

signupForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const username = usernameInput.value.trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,32}$/.test(username)) {
    wax.fizzle();
    showStatus("Use 3 to 32 characters: lowercase letters, numbers, - or _.");
    usernameInput.focus();
    return;
  }
  void startSignUp(username);
});

// ---------------------------------------------------------------- freeze dial

const dial = $("#temperature") as HTMLInputElement;
function dialHealth(): "healthy" | "cooling" | "offline" {
  const warmth = Number(dial.value) / 100;
  return warmth === 0 ? "offline" : warmth < 0.6 ? "cooling" : "healthy";
}
function lampHealth(): LampHealth {
  return lamp?.isPaused ? "paused" : dialHealth();
}
const health = $("[data-health]");
dial.addEventListener("input", () => {
  const warmth = Number(dial.value) / 100;
  if (lamp) {
    lamp.physics.heatScale = warmth;
    lamp.freeze = 1 - warmth;
  }
  const state = dialHealth();
  document.body.dataset.lamp = state;
  health.textContent =
    state === "offline"
      ? "Lamp offline. Secure generator holding the line."
      : state === "cooling"
        ? "Lamp cooling"
        : "Lamp healthy";
});
dial.addEventListener("change", () => {
  if (Number(dial.value) === 0) announce("Lamp offline. Secure generator holding the line.");
});

// ---------------------------------------------------------------- boot

void currentUser().then((user) => {
  if (user) {
    if (lamp) lamp.glowTarget = 0.35;
    signedIn(user);
  } else {
    go("landing");
  }
});
