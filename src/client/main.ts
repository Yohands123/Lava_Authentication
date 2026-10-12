import "@fontsource/unbounded/300.css";
import "@fontsource/unbounded/600.css";
import "@fontsource/inter-tight/400.css";
import "@fontsource/inter-tight/500.css";
import "@fontsource/jetbrains-mono/400.css";
import "./ui/styles.css";

import { Lamp } from "./lamp/lamp";
import { LAMP, STIR } from "./lamp/constants";
import { StirController } from "./stir/controller";
import { SnapshotSource } from "./entropy/snapshot";
import { CameraSource } from "./entropy/camera";
import { currentUser, login, logout, register, revokeAll, type User } from "./auth/passkeys";
import { prefersReducedMotion, onReducedMotionChange } from "./a11y/motion";
import { announce } from "./a11y/announce";
import { $, showScreen } from "./ui/dom";
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
    }, prefersReducedMotion)
  : null;

if (lamp) {
  lamp.onStep = (dt) => {
    if (screen === "landing" && cursor) lamp!.physics.heatAt(cursor.x, cursor.y, dt);
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
  screen = next;
  showScreen(next);
}

function signedIn(user: User): void {
  $("[data-username]").textContent = user.username;
  go("success");
  announce(`Signed in as ${user.username}`);
}

const waitingText = $("[data-waiting-text]");
const signupForm = $("[data-form=signup]") as HTMLFormElement;
const usernameInput = $("#username") as HTMLInputElement;

async function startSignIn(): Promise<void> {
  go("stir");
  announce("Stir the lamp, hold Space, or choose skip.");
  const result = stir ? await stir.run() : { digest: null, skipped: true };
  if (screen !== "stir") return; // cancelled
  lab.stirFinished(result.skipped);

  // The wax gathers back before the passkey prompt.
  wax.gather(STIR.RETURN_SECONDS * 1000);
  waitingText.textContent = "Touch your sensor to sign in";
  go("waiting");
  wax.melt(); // your entropy joining the lamp

  try {
    const lampDigest = await takeSnapshot();
    const digests = { stir: result.digest, lamp: lampDigest, camera: await cameraControl.digest() };
    lab.sent(digests);
    const user = await login(digests);
    wax.warmUp();
    signedIn(user);
  } catch (err) {
    wax.fail(err);
    showStatus(messageFor(err));
    go("choose");
  }
}

async function startSignUp(username: string): Promise<void> {
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
    case "skip":
      stir?.skip();
      break;
    case "back":
      stir?.cancel();
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
    case "pause": {
      if (!lamp) break;
      const paused = !lamp.isPaused;
      lamp.setPaused(paused);
      target.setAttribute("aria-pressed", String(paused));
      target.textContent = paused ? "Resume lamp" : "Pause lamp";
      break;
    }
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
