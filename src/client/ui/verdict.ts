import type { GuardDecision, GuardState } from "../../shared/lavaguard";
import { announce } from "../a11y/announce";
import { $ } from "./dom";
import { verdictActions } from "./verdict-actions";

export class VerdictView {
  private readonly screen = $("[data-screen=stir]");
  private readonly result = $("[data-verdict]");
  private readonly original = $(".stir-copy");
  state: GuardState = "IDLE";
  set(state: GuardState, decision?: GuardDecision, permission = false): void {
    this.state = state; this.screen.dataset.guardState = state;
    const action = $("[data-verdict-action]") as HTMLButtonElement;
    const controls = verdictActions(state, permission);
    action.inert = !controls.visible || controls.disabled;
    action.setAttribute("aria-hidden", String(action.inert));
    const visible = controls.visible;
    const back = $("[data-verdict-back]");
    back.hidden = !controls.back; back.inert = !controls.back;
    back.setAttribute("aria-hidden", String(!controls.back));
    $("[data-guard-verify]").hidden = !visible || !decision?.stepUp;
    $("[data-guard-widget]").hidden = true;
    this.result.hidden = !visible; this.result.inert = !visible;
    this.original.hidden = visible; this.original.inert = visible;
    this.screen.classList.toggle("has-verdict", visible);
    this.screen.setAttribute("aria-labelledby", visible ? "verdict-title" : "stir-title");
    this.screen.classList.toggle("is-clear", state === "CLEAR");
    $("[data-guard-pending]").hidden = state !== "PREPARING" && state !== "RING_CLEARED_PENDING_DECISION";
    $("[data-guard-pending]").textContent = state === "PREPARING" ? "Preparing your lamp…" : "The ring is clear. Checking this attempt…";
    if (!visible) return;
    const clearTitle = decision?.assessment === "shadow" ? "Interaction recorded" : decision?.assessment === "accessible" ? "Continue with a passkey" : decision?.assessment === "disabled" ? "Ring cleared" : "Ready to sign in";
    const title = state === "CLEAR" ? clearTitle : state === "FLAG" ? "Let's try that again" : state === "BLOCK" ? "Attempt restricted" : "Connection interrupted";
    $("[data-verdict-title]").textContent = title;
    const clearCopy = decision?.assessment === "shadow" ? "Observation mode hasn't verified this interaction. Your passkey is still required." : decision?.assessment === "accessible" ? "Movement analysis was skipped. Your passkey is still required." : "You can continue with your passkey.";
    $("[data-verdict-copy]").textContent = state === "CLEAR" ? clearCopy : state === "FLAG" ? "We couldn't verify this interaction." : state === "BLOCK" ? "This attempt has been restricted." : "Your lamp is ready. Please reconnect and try again.";
    action.textContent = controls.label;
    action.dataset.action = controls.action;
    action.disabled = controls.disabled;
    $("[data-verdict-note]").textContent = state === "BLOCK" && decision?.retryAfter ? `Please wait ${decision.retryAfter} seconds before another attempt.` : "";
    announce(title + ". " + $("[data-verdict-copy]").textContent);
    action.focus({ preventScroll: true });
  }
}
