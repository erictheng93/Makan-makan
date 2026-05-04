/**
 * AES-256-GCM encryption utilities using Web Crypto API
 *
 * Provides encrypt/decrypt functions with PBKDF2 key derivation.
 * Output format: base64(iv):base64(encryptedWithTag)
 *
 * Backwards compatible: decrypt() falls back to base64 decoding
 * for legacy data that doesn't contain the ':' separator.
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

const DEFAULT_SALT = "makanmasak-encryption-salt";

// Derive a 256-bit key from the encryption key string
async function deriveKey(
  keyString: string,
  salt: string = DEFAULT_SALT,
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
 * @param salt - Optional salt for key derivation (default: "makanmasak-encryption-salt")
 * @returns Encrypted string in format: base64(iv):base64(encryptedWithTag)
 */
export async function encrypt(
  plaintext: string,
  encryptionKey: string,
  salt?: string,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(encryptionKey, salt);

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
 * @param ciphertext - The encrypted string (format: base64(iv):base64(encryptedWithTag))
 * @param encryptionKey - The encryption key (will be derived via PBKDF2)
 * @param salt - Optional salt for key derivation (default: "makanmasak-encryption-salt")
 * @returns Decrypted plaintext string
 */
export async function decrypt(
  ciphertext: string,
  encryptionKey: string,
  salt?: string,
): Promise<string> {
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

  const key = await deriveKey(encryptionKey, salt);

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
