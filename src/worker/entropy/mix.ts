// SECURITY-CRITICAL. See CLAUDE.md section 2.1.
//
// Every challenge is SHA-256(serverRandom ‖ stir ‖ lamp ‖ camera ‖ timestamp).
// serverRandom is ALWAYS 32 fresh bytes from crypto.getRandomValues(). Client
// digests are untrusted extras: they can add to the result but never weaken it,
// because the server's random bytes are always part of the hash input.

import { fromBase64Url } from "../lib/base64url";

export const DIGEST_BYTES = 32;

export interface ClientDigests {
  stir: Uint8Array | null;
  lamp: Uint8Array | null;
  camera: Uint8Array | null;
}

export class BadDigestError extends Error {
  constructor(public readonly field: string) {
    super(`Digest "${field}" must be exactly ${DIGEST_BYTES} bytes (base64url) or null`);
  }
}

const FIELDS = ["stir", "lamp", "camera"] as const;

/** Parse untrusted client input. Each digest must be 32 bytes or absent. */
export function parseDigests(input: unknown): ClientDigests {
  const result: ClientDigests = { stir: null, lamp: null, camera: null };
  if (input === undefined || input === null) return result;
  if (typeof input !== "object" || Array.isArray(input)) throw new BadDigestError("digests");

  for (const key of Object.keys(input)) {
    if (!(FIELDS as readonly string[]).includes(key)) throw new BadDigestError(key);
  }
  for (const field of FIELDS) {
    const value = (input as Record<string, unknown>)[field];
    if (value === undefined || value === null) continue;
    if (typeof value !== "string") throw new BadDigestError(field);
    let bytes: Uint8Array;
    try {
      bytes = fromBase64Url(value);
    } catch {
      throw new BadDigestError(field);
    }
    if (bytes.length !== DIGEST_BYTES) throw new BadDigestError(field);
    result[field] = bytes;
  }
  return result;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/** Build a 32-byte challenge. Never remove the server random bytes. */
export async function buildChallenge(client: ClientDigests): Promise<Uint8Array<ArrayBuffer>> {
  const serverRandom = crypto.getRandomValues(new Uint8Array(DIGEST_BYTES)); // always present
  const time = new TextEncoder().encode(Date.now().toString());
  // A one-byte tag per source keeps "absent" distinct from any present value.
  const parts: Uint8Array[] = [serverRandom];
  for (const field of FIELDS) {
    const digest = client[field];
    parts.push(new Uint8Array([digest ? 1 : 0]));
    if (digest) parts.push(digest);
  }
  parts.push(time);
  const hash = await crypto.subtle.digest("SHA-256", concat(parts) as BufferSource);
  return new Uint8Array(hash);
}
