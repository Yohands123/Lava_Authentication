import { expect, it } from "vitest";
import { AttemptPermission } from "../../src/client/guard/permission";
import { verdictActions } from "../../src/client/ui/verdict-actions";
import type { GuardState } from "../../src/shared/lavaguard";
it("expires permissions even before a delayed timer runs, consumes once, and binds the generation", () => {
  const p = new AttemptPermission<string>();
  expect(p.grant(1, "clearance", 200, 100)).toBe(true);
  expect(p.take(2, 101)).toBeNull(); expect(p.take(1, 101)).toBeNull();
  p.grant(3, "clearance", 200, 100); expect(p.take(3, 200)).toBeNull();
  p.grant(4, "clearance", 200, 100); expect(p.take(4, 199)).toBe("clearance"); expect(p.take(4, 199)).toBeNull();
  for (const expiry of [NaN, Infinity, 100, 0]) expect(p.grant(4, "stale", expiry, 100)).toBe(false);
  p.grant(5, "clearance", 200, 100); p.clear(); expect(p.current(5, 100)).toBe(false);
});
it.each<GuardState>(["IDLE", "PREPARING", "STIRRING", "RING_CLEARED_PENDING_DECISION", "CLEAR", "FLAG", "BLOCK", "ERROR", "CANCELLED", "ACCESSIBLE_ALTERNATIVE"])("defines safe actions in %s", state => {
  const a = verdictActions(state);
  expect(a.action === "passkey" && !a.disabled).toBe(false);
  expect(a.action).not.toBe("guard-accessible");
  expect(a.visible).toBe(["CLEAR", "FLAG", "BLOCK", "ERROR"].includes(state));
  if (state === "CLEAR") expect(verdictActions(state, true).label).toBe("Continue with passkey");
  if (["FLAG", "ERROR"].includes(state)) { expect(a.back).toBe(true); expect(a.action).toBe("guard-retry"); }
});
