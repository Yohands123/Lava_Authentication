import type { GuardState } from "../../shared/lavaguard";
export function verdictActions(state: GuardState, permission = false) {
  const visible = ["CLEAR", "FLAG", "BLOCK", "ERROR"].includes(state);
  return { visible, disabled: state === "CLEAR" && !permission,
    action: state === "CLEAR" ? "passkey" : state === "BLOCK" ? "back" : "guard-retry",
    label: state === "CLEAR" ? "Continue with passkey" : state === "BLOCK" ? "Back" : "Try again  ↻",
    back: state === "FLAG" || state === "ERROR" };
}
