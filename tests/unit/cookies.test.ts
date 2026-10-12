import { describe, expect, it } from "vitest";
import { sessionCookie, readSessionId } from "../../src/worker/lib/cookies";

describe("session cookie", () => {
  it("always carries the required flags", () => {
    const c = sessionCookie("a".repeat(43), 100);
    for (const flag of ["HttpOnly", "Secure", "SameSite=Strict", "Path=/", "Max-Age=100"]) {
      expect(c).toContain(flag);
    }
  });

  it("reads only well-formed session ids", () => {
    const id = "A".repeat(43);
    expect(readSessionId(new Request("https://x", { headers: { Cookie: `other=1; lava_session=${id}` } }))).toBe(id);
    expect(readSessionId(new Request("https://x", { headers: { Cookie: "lava_session=short" } }))).toBeNull();
  });
});
