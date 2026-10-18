import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import { api, ApiError, toBase64Url } from "./api";

export interface User {
  id: string;
  username: string;
}

export interface Digests {
  stir: Uint8Array | null;
  lamp: Uint8Array | null;
  camera: Uint8Array | null;
}

const encode = (d: Digests) => ({
  stir: d.stir ? toBase64Url(d.stir) : null,
  lamp: d.lamp ? toBase64Url(d.lamp) : null,
  camera: d.camera ? toBase64Url(d.camera) : null,
});

/** Wrap browser WebAuthn errors so the UI can show one consistent message. */
async function withAuthenticator<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    const name = err instanceof Error ? err.name : "";
    if (name === "NotAllowedError" || name === "AbortError") {
      throw new ApiError("cancelled", 0, "Passkey request was cancelled.");
    }
    if (name === "InvalidStateError") {
      throw new ApiError("already_registered", 0, "This device already has a passkey here.");
    }
    throw new ApiError("authenticator_error", 0, "Your device couldn't complete the passkey request.");
  }
}

export async function register(username: string, digests: Digests): Promise<User> {
  const optionsJSON = await api<PublicKeyCredentialCreationOptionsJSON>("/api/register/options", {
    username,
    digests: encode(digests),
  });
  const response = await withAuthenticator(() => startRegistration({ optionsJSON }));
  const result = await api<{ user: User }>("/api/register/verify", { response });
  return result.user;
}

export async function login(digests: Digests, clearance?: string): Promise<User> {
  const optionsJSON = await api<PublicKeyCredentialRequestOptionsJSON>("/api/login/options", {
    digests: encode(digests),
    clearance,
  });
  const response = await withAuthenticator(() => startAuthentication({ optionsJSON }));
  const result = await api<{ user: User }>("/api/login/verify", { response });
  return result.user;
}

export async function currentUser(): Promise<User | null> {
  try {
    return (await api<{ user: User }>("/api/session")).user;
  } catch {
    return null;
  }
}

export const logout = () => api<{ ok: true }>("/api/logout", {});
export const revokeAll = () => api<{ ok: true }>("/api/sessions/revoke-all", {});
