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
import { currentUser, login, logout, register, revokeAll, type User } from "./auth/passkeys";
import { prefersReducedMotion, onReducedMotionChange } from "./a11y/motion";
import { announce } from "./a11y/announce";
import { $, showScreen } from "./ui/dom";
import { EntropyRing } from "./ui/ring";
import { showStatus } from "./ui/status";
import { messageFor } from "./ui/messages";

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
      if (!accepted) lamp?.physics.drop(true); // repeated snapshot fizzles
      resolve(accepted ? digest : null);
    };
  });
}

const ring = new EntropyRing();
const stir = lamp
  ? new StirController(lamp.renderer, lamp.physics, {
      onProgress: (bits, progress) => ring.set(bits, progress),
      onTooRegular: () => showStatus("Too regular, keep stirring."),
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

// ---------------------------------------------------------------- formations

const centre = () => (lamp ? { cx: lamp.physics.width / 2, cy: lamp.physics.height / 2 } : { cx: 0, cy: 0 });

function gatherBriefly(ms = 1400): void {
  if (!lamp) return;
  lamp.physics.formation = { kind: "point", ...centre(), spread: 0.18 };
  window.setTimeout(() => {
    if (lamp && lamp.physics.formation?.kind === "point") lamp.physics.formation = null;
  }, ms);
}

function formPortal(): void {
  if (!lamp) return;
  const short = Math.min(lamp.physics.width, lamp.physics.height);
  lamp.physics.formation = { kind: "ring", ...centre(), radius: short * 0.26 };
}

function release(): void {
  if (lamp) lamp.physics.formation = null;
}

function warmUp(): void {
  if (!lamp) return;
  lamp.glowTarget = 1;
  window.setTimeout(() => lamp && (lamp.glowTarget = 0.35), 2600);
}

function failVisual(): void {
  if (!lamp) return;
  release();
  lamp.physics.drop(true);
  lamp.dimTarget = 0.4;
  window.setTimeout(() => lamp && (lamp.dimTarget = 0), 1800);
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

  // The wax gathers back before the passkey prompt.
  gatherBriefly(STIR.RETURN_SECONDS * 1000);
  waitingText.textContent = "Touch your sensor to sign in";
  go("waiting");
  lamp?.physics.drop(false); // a droplet melts in: your entropy joining the lamp

  try {
    const lampDigest = await takeSnapshot();
    const user = await login({ stir: result.digest, lamp: lampDigest, camera: null });
    warmUp();
    signedIn(user);
  } catch (err) {
    failVisual();
    showStatus(messageFor(err));
    go("choose");
  }
}

async function startSignUp(username: string): Promise<void> {
  waitingText.textContent = "Confirm with your device to create your passkey";
  go("waiting");
  formPortal();
  try {
    const lampDigest = await takeSnapshot();
    const user = await register(username, { stir: null, lamp: lampDigest, camera: null });
    lamp?.physics.burst();
    warmUp();
    signedIn(user);
  } catch (err) {
    failVisual();
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
      gatherBriefly();
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
        if (lamp) lamp.glowTarget = 0;
        go("landing");
        announce("Signed out");
      });
      break;
    case "revoke-all":
      void revokeAll().finally(() => {
        if (lamp) lamp.glowTarget = 0;
        go("landing");
        showStatus("Signed out on every device.");
      });
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
    showStatus("Use 3 to 32 characters: lowercase letters, numbers, - or _.");
    usernameInput.focus();
    return;
  }
  void startSignUp(username);
});

// ---------------------------------------------------------------- freeze dial

const dial = $("#temperature") as HTMLInputElement;
const health = $("[data-health]");
dial.addEventListener("input", () => {
  const warmth = Number(dial.value) / 100;
  if (lamp) {
    lamp.physics.heatScale = warmth;
    lamp.freeze = 1 - warmth;
  }
  const state = warmth === 0 ? "offline" : warmth < 0.6 ? "cooling" : "healthy";
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
