import { $ } from "./dom";
import { announce } from "../a11y/announce";

let timer = 0;

/** A short glass message near the bottom of the screen. Never an alert box. */
export function showStatus(message: string, ms = 4200): void {
  const el = $("[data-status]");
  el.textContent = message;
  el.classList.add("is-visible");
  announce(message);
  window.clearTimeout(timer);
  timer = window.setTimeout(() => el.classList.remove("is-visible"), ms);
}
