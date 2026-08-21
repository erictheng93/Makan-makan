/**
 * Print-agent credentials.
 *
 * The plaintext key is high-entropy and returned exactly once, at issue time;
 * only its SHA-256 digest is stored. Verification is therefore a lookup *by*
 * digest rather than a comparison against a stored secret, so there is no
 * secret-dependent comparison for an attacker to time.
 *
 * The prefix exists so a leaked key is recognisable in a log or a paste.
 */
const KEY_PREFIX = "mmpa_";
const KEY_BYTES = 32;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function generatePrintAgentKey(): string {
  return KEY_PREFIX + toHex(crypto.getRandomValues(new Uint8Array(KEY_BYTES)));
}

export async function hashPrintAgentKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key),
  );
  return toHex(new Uint8Array(digest));
}
