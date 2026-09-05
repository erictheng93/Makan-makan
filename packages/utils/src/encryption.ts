/**
 * AES-256-GCM encryption utilities using Web Crypto API
 *
 * Provides encrypt/decrypt functions with PBKDF2 key derivation.
 * Output format: base64(iv):base64(encryptedWithTag)
 *
 * Backwards compatible: decrypt() falls back to base64 decoding
 * for legacy data that doesn't contain the ':' separator.
 *
 * This module is deliberately environment-agnostic: it never reads
 * `process.env`, a Worker binding, or any global. Whether a weak/absent key
 * is fatal is a *deployment* question, so the caller states it per call via
 * `EncryptionOptions.requireStrongKey`. The flag has no default — a new call
 * site cannot silently inherit the permissive behaviour that let an empty
 * `ENCRYPTION_KEY` derive a publicly reproducible key (issue #300).
 *
 * Derived keys are memoised per isolate; see `derivedKeys` below for why that
 * is sound and how it stays bounded. The weak-key check runs before any cache
 * lookup, so a warm cache can never smuggle a call past the guard.
 */

// Helper to convert string to Uint8Array (with ArrayBuffer guarantee for Web Crypto)
function stringToUint8Array(str: string): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(str);
  return new Uint8Array(encoded.buffer as ArrayBuffer);
}

// Helper to convert ArrayBuffer to string
function arrayBufferToString(buffer: ArrayBuffer): string {
  const decoder = new TextDecoder();
  return decoder.decode(buffer);
}

// Helper to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper to convert base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

const DEFAULT_SALT = "makanmakan-encryption-salt";

/**
 * Shortest secret we will derive a key from. PBKDF2's salt and iteration count
 * are public constants in this file, so the only entropy in the derived key is
 * the secret itself — anything short enough to guess is equivalent to no key.
 */
export const MIN_ENCRYPTION_KEY_LENGTH = 32;

export interface EncryptionOptions {
  /**
   * Domain-separation salt for PBKDF2. Two callers storing different kinds of
   * secret should pass different salts so one ciphertext can never be decrypted
   * by the other's code path.
   */
  salt?: string;
  /**
   * Refuse to run when the key is absent, empty, or shorter than
   * {@link MIN_ENCRYPTION_KEY_LENGTH}.
   *
   * Required, with no default: this package has no notion of "production", so
   * the caller must decide. In `apps/api` the decision is made in exactly one
   * place — `encryptionSettings()` in `shared/utils/encryption.ts`.
   */
  requireStrongKey: boolean;
}

/**
 * Fail loud rather than deriving a key anyone can reproduce.
 *
 * With an absent or empty secret, PBKDF2 over a hardcoded salt and iteration
 * count yields a fixed AES-256 key that every reader of this repository can
 * recompute. The failure is otherwise completely silent — no log, no exception,
 * ciphertext that looks fine in the database.
 */
export function assertStrongEncryptionKey(
  encryptionKey: string | undefined | null,
): asserts encryptionKey is string {
  if (
    typeof encryptionKey !== "string" ||
    encryptionKey.length < MIN_ENCRYPTION_KEY_LENGTH
  ) {
    throw new Error(
      "ENCRYPTION_KEY is missing or shorter than " +
        `${MIN_ENCRYPTION_KEY_LENGTH} characters — refusing to encrypt or ` +
        "decrypt with a key that anyone reading this repository could " +
        "reproduce (set the ENCRYPTION_KEY environment secret).",
    );
  }
}

/**
 * Per-isolate memo of derived keys, keyed by (secret, salt).
 *
 * PBKDF2's 100,000 iterations exist to slow an *offline* attacker who has
 * stolen the ciphertext and is guessing the secret. They do nothing against a
 * server that legitimately holds the secret in its environment, so re-running
 * the KDF on every call buys no security and costs the full stretch each time
 * — measured at ~250ms per derivation. That matters twice here: the
 * unauthenticated platform-webhook route decrypts credentials for *every*
 * active integration to find the matching store, so the cost is O(tenants) per
 * request; and ai-analytics pays a derivation per request against this repo's
 * P99 < 300ms target.
 *
 * Caching the `CryptoKey` moves nothing new into memory: the secret is already
 * sitting in `env` as plaintext, and the derived key is non-extractable.
 *
 * Growth: both parts of the cache key are configuration, never request data.
 * The secret is one value per isolate (`ENCRYPTION_KEY`) and the salts are a
 * fixed set of module-level constants, so real usage settles at a handful of
 * entries that live as long as the isolate. `MAX_DERIVED_KEYS` is there because
 * that is a property of today's callers rather than of this module: a future
 * caller deriving a salt from request data would otherwise grow the map without
 * bound inside a long-lived isolate. On overflow the whole map is dropped —
 * with entries this few and this long-lived, a periodic re-derivation is
 * cheaper to reason about than an LRU.
 */
const MAX_DERIVED_KEYS = 32;
const derivedKeys = new Map<string, Promise<CryptoKey>>();

function derivedKeyCacheKey(keyString: string, salt: string): string {
  // Length-prefixed so ("ab", "c") and ("a", "bc") cannot collide.
  return `${salt.length}:${salt}:${keyString}`;
}

/**
 * Drop the derived-key memo. Exported for tests and for a key rotation that
 * needs the next call to re-derive rather than reuse the retired key.
 */
export function resetEncryptionKeyCache(): void {
  derivedKeys.clear();
}

// Derive a 256-bit key from the encryption key string
function deriveKey(
  keyString: string,
  salt: string = DEFAULT_SALT,
): Promise<CryptoKey> {
  const cacheKey = derivedKeyCacheKey(keyString, salt);
  const cached = derivedKeys.get(cacheKey);
  if (cached) return cached;

  if (derivedKeys.size >= MAX_DERIVED_KEYS) derivedKeys.clear();

  // Cache the promise, not the resolved key, so concurrent callers share one
  // derivation instead of racing to run the KDF several times over.
  const pending = deriveKeyUncached(keyString, salt).catch((error: unknown) => {
    derivedKeys.delete(cacheKey);
    throw error;
  });
  derivedKeys.set(cacheKey, pending);
  return pending;
}

async function deriveKeyUncached(
  keyString: string,
  salt: string,
): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    stringToUint8Array(keyString),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: stringToUint8Array(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt plaintext using AES-256-GCM with PBKDF2 key derivation.
 *
 * @param plaintext - The string to encrypt
 * @param encryptionKey - The encryption key (will be derived via PBKDF2)
 * @param options - Domain salt plus the caller's weak-key policy
 * @returns Encrypted string in format: base64(iv):base64(encryptedWithTag)
 */
export async function encrypt(
  plaintext: string,
  encryptionKey: string,
  options: EncryptionOptions,
): Promise<string> {
  if (options.requireStrongKey) assertStrongEncryptionKey(encryptionKey);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(encryptionKey, options.salt);

  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      tagLength: 128,
    },
    key,
    stringToUint8Array(plaintext),
  );

  const ivBase64 = arrayBufferToBase64(iv.buffer);
  const encryptedBase64 = arrayBufferToBase64(encrypted);

  return `${ivBase64}:${encryptedBase64}`;
}

/**
 * Decrypt ciphertext using AES-256-GCM with PBKDF2 key derivation.
 *
 * Backwards compatible: if the input doesn't contain ':' separator,
 * falls back to base64 decoding (legacy format) with a console warning.
 *
 * The weak-key check runs before the legacy branch on purpose: refusing to
 * hand a stored secret back is the point, and the legacy branch returns one
 * without touching the key at all.
 *
 * @param ciphertext - The encrypted string (format: base64(iv):base64(encryptedWithTag))
 * @param encryptionKey - The encryption key (will be derived via PBKDF2)
 * @param options - Domain salt plus the caller's weak-key policy
 * @returns Decrypted plaintext string
 */
export async function decrypt(
  ciphertext: string,
  encryptionKey: string,
  options: EncryptionOptions,
): Promise<string> {
  if (options.requireStrongKey) assertStrongEncryptionKey(encryptionKey);

  // Legacy base64 fallback
  if (!ciphertext.includes(":")) {
    console.warn(
      "Using legacy base64 decoding — data will be upgraded to AES-256-GCM on next write",
    );
    return atob(ciphertext);
  }

  const [ivBase64, encryptedBase64] = ciphertext.split(":");

  if (!ivBase64 || !encryptedBase64) {
    throw new Error("Invalid encrypted data format");
  }

  const iv = new Uint8Array(base64ToArrayBuffer(ivBase64));
  const encrypted = base64ToArrayBuffer(encryptedBase64);

  const key = await deriveKey(encryptionKey, options.salt);

  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
      tagLength: 128,
    },
    key,
    encrypted,
  );

  return arrayBufferToString(decrypted);
}
