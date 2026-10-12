// The "Use camera" control: opt-in toggle, health readout, and the digest
// handed to sign-in. Raw frames stay inside CameraSource.

import type { CameraSource } from "../entropy/camera";
import { announce } from "../a11y/announce";
import { $ } from "./dom";
import { showStatus } from "./status";
import type { Wax } from "./wax";

export class CameraControl {
  private readonly button = $("[data-action=camera]");
  private readonly health = $("[data-camera-health]");

  constructor(
    private readonly camera: CameraSource,
    private readonly wax: Wax,
  ) {
    camera.onHealth = (covered) => {
      wax.cameraHealth(); // a covered lens dims the lamp; uncovering brings it back
      if (covered) announce("Camera covered");
      this.render();
    };
    // CameraSource stops its tracks when the tab hides; reflect that here.
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.render();
    });
  }

  toggle(): void {
    if (this.camera.enabled) {
      this.camera.disable();
      this.render();
      announce("Camera off");
      return;
    }
    this.camera.enable().then(
      () => {
        this.render();
        announce("Camera on. Frames stay on this device.");
      },
      () => {
        this.wax.fizzle();
        showStatus("Camera unavailable. Sign-in works without it.");
      },
    );
  }

  /** One frame's digest for a challenge, or null when off, covered or repeated. */
  async digest(): Promise<Uint8Array | null> {
    if (!this.camera.enabled) return null;
    const result = await this.camera.capture();
    if (result?.reason === "repeated") this.wax.fizzle(); // repeated frame fizzles
    return result?.digest ?? null;
  }

  private render(): void {
    const { enabled, covered } = this.camera;
    this.button.setAttribute("aria-pressed", String(enabled));
    this.button.textContent = enabled ? "Stop camera" : "Use camera";
    this.health.textContent = !enabled ? "Camera off" : covered ? "Camera covered" : "Camera healthy";
    document.body.dataset.camera = !enabled ? "off" : covered ? "covered" : "healthy";
  }
}
