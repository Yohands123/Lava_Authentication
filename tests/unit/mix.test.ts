import { describe, expect, it } from "vitest";
import { buildChallenge, parseDigests, BadDigestError } from "../../src/worker/entropy/mix";
import { toBase64Url } from "../../src/worker/lib/base64url";

const digest = (fill: number) => toBase64Url(new Uint8Array(32).fill(fill));
const none = { stir: null, lamp: null, camera: null };

describe("buildChallenge", () => {
  it("returns 32 bytes", async () => {
    expect((await buildChallenge(none)).length).toBe(32);
  });

  it("works with every client digest absent (Freeze the Lamp)", async () => {
    const a = await buildChallenge(none);
    const b = await buildChallenge(none);
    expect(a).not.toEqual(b);
  });

  it("differs across calls even with identical client digests", async () => {
    const client = parseDigests({ stir: digest(1), lamp: digest(2), camera: digest(3) });
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) seen.add(toBase64Url(await buildChallenge(client)));
    expect(seen.size).toBe(50);
  });

  it("is not determined by attacker-chosen digests", async () => {
    const zeros = parseDigests({ stir: digest(0), lamp: digest(0), camera: digest(0) });
    expect(await buildChallenge(zeros)).not.toEqual(await buildChallenge(zeros));
  });
});

describe("parseDigests", () => {
  it("accepts absent input", () => {
    expect(parseDigests(undefined)).toEqual(none);
    expect(parseDigests({})).toEqual(none);
    expect(parseDigests({ stir: null })).toEqual(none);
  });

  it("accepts exactly 32-byte digests", () => {
    expect(parseDigests({ stir: digest(7) }).stir?.length).toBe(32);
  });

  it.each([
    ["too short", { stir: toBase64Url(new Uint8Array(31)) }],
    ["too long", { lamp: toBase64Url(new Uint8Array(33)) }],
    ["not a string", { camera: 42 }],
    ["not base64url", { stir: "!!!" }],
    ["unknown field", { mouse: digest(1) }],
    ["array", [digest(1)]],
  ])("rejects %s", (_name, input) => {
    expect(() => parseDigests(input)).toThrow(BadDigestError);
  });
});
