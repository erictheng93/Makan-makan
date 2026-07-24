/**
 * Length-checked, constant-time string comparison.
 *
 * A plain `!==` returns as soon as two characters differ, which leaks the
 * expected value (e.g. a webhook HMAC signature) one byte at a time via a
 * timing side-channel. This comparison always inspects every character of
 * equal-length inputs, so the time taken does not depend on where the first
 * mismatch occurs. Length is compared up-front — an early-out on length is
 * safe because the caller-controlled `a` value's length is not itself secret.
 *
 * Shared by the webhook signature verifiers in billing, market-checkouts, and
 * credits. Keep any local copies in sync with this implementation.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
