import { ApiError } from "../auth/api";

/** Plain, specific copy for every failure. Errors don't apologise. */
export function messageFor(err: unknown): string {
  if (!(err instanceof ApiError)) return "Something went wrong on our side. Try again.";
  switch (err.code) {
    case "cancelled":
      return "Passkey request was cancelled. Try again when you're ready.";
    case "already_registered":
      return "This device already has a passkey here. Sign in instead.";
    case "username_taken":
      return "That username is taken. Try another.";
    case "username_invalid":
      return "Use 3 to 32 characters: lowercase letters, numbers, - or _.";
    case "rate_limited":
      return `Too many attempts. Try again in ${err.retryAfter ?? 60} seconds.`;
    case "challenge_expired":
      return "That request timed out. Start again.";
    case "challenge_used":
      return "That request was already used. Start again.";
    case "verification_failed":
      return "That passkey couldn't be verified. Try again, or create a new one.";
    default:
      return "Something went wrong on our side. Try again.";
  }
}
