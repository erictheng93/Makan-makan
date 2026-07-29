/**
 * QR Code HMAC Signing Utilities
 *
 * Produces tamper-proof signed URLs for table/seat QR codes.
 * Uses Web Crypto API (works in Cloudflare Workers & browsers).
 *
 * Signed URL format:
 *   v1: /order?t={type}&r={restaurantId}&n={identifier}&v={version}&sig={hmac16hex}
 *   v2: /order?t={type}&r={restaurantId}&d={tableId}&n={identifier}&v={version}&f=2&sig={hmac16hex}
 *
 * HMAC input (deterministic, no timestamp):
 *   v1: {type}|{restaurantId}|{identifier}|{version}
 *   v2: v2|{type}|{restaurantId}|{tableId}|{identifier}|{version}
 */

// ── Types ──────────────────────────────────────────────

export interface QRSigningParams {
  /** Signing format. Omitted means legacy v1 during the transition period. */
  formatVersion?: 1 | 2;
  /** "table" or "seat" */
  type: "table" | "seat";
  /** Restaurant UUID */
  restaurantId: string;
  /** Owning table primary key. Required by format v2. */
  tableId?: number;
  /** Table number (e.g. "A1") or seat number (e.g. "01") */
  identifier: string;
  /** QR code version — incremented on regeneration to invalidate old codes */
  version: number;
}

export interface SignedQRUrlParams extends QRSigningParams {
  timestamp: number;
  signature: string;
}

// ── Helpers ────────────────────────────────────────────

function stringToUint8Array(str: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(str) as Uint8Array<ArrayBuffer>;
}

function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Build the canonical string that is signed.
 * Deterministic — does NOT include timestamp so QR codes remain valid until version changes.
 */
function buildCanonicalString(params: QRSigningParams): string {
  if (params.formatVersion === 2) {
    if (!Number.isInteger(params.tableId) || (params.tableId ?? 0) <= 0) {
      throw new Error("QR signing format v2 requires a positive tableId");
    }
    return `v2|${params.type}|${params.restaurantId}|${params.tableId}|${params.identifier}|${params.version}`;
  }
  return `${params.type}|${params.restaurantId}|${params.identifier}|${params.version}`;
}

// ── Core Signing ───────────────────────────────────────

/**
 * Import a signing key for HMAC-SHA256.
 */
async function importKey(signingKey: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    stringToUint8Array(signingKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/**
 * Sign a QR payload → 16-char hex string (first 8 bytes of HMAC-SHA256).
 *
 * 8 bytes = 2^64 possible values — sufficient to prevent casual tampering
 * while keeping QR codes low-density for easy scanning.
 */
export async function signQRPayload(
  params: QRSigningParams,
  signingKey: string,
): Promise<string> {
  const key = await importKey(signingKey);
  const data = stringToUint8Array(buildCanonicalString(params));
  const signature = await crypto.subtle.sign("HMAC", key, data);
  // Take first 8 bytes → 16 hex chars
  return uint8ArrayToHex(new Uint8Array(signature).slice(0, 8));
}

/**
 * Verify an HMAC signature against the expected QR payload.
 */
export async function verifyQRSignature(
  params: QRSigningParams,
  signature: string,
  signingKey: string,
): Promise<boolean> {
  const expected = await signQRPayload(params, signingKey);
  // Constant-time-ish comparison (length already fixed at 16)
  if (expected.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

// ── URL Building & Parsing ─────────────────────────────

/**
 * Build a complete signed QR URL.
 *
 * Example output:
 *   https://app.makanmakan.com/order?t=table&r=019469a0-0001-7000-8000-000000000001&n=A1&v=1&ts=1711324800000&sig=a1b2c3d4e5f6a7b8
 */
export async function buildSignedQRUrl(
  baseUrl: string,
  params: QRSigningParams,
  signingKey: string,
): Promise<string> {
  const sig = await signQRPayload(params, signingKey);
  const url = new URL("/order", baseUrl);
  url.searchParams.set("t", params.type);
  url.searchParams.set("r", params.restaurantId);
  if (params.formatVersion === 2) {
    url.searchParams.set("d", String(params.tableId));
    url.searchParams.set("f", "2");
  }
  url.searchParams.set("n", params.identifier);
  url.searchParams.set("v", String(params.version));
  url.searchParams.set("ts", String(Date.now()));
  url.searchParams.set("sig", sig);
  return url.toString();
}

/**
 * Parse a signed QR URL back into its components.
 * Returns null if the URL doesn't match the expected format.
 */
export function parseSignedQRUrl(urlString: string): SignedQRUrlParams | null {
  try {
    const url = new URL(urlString);
    const t = url.searchParams.get("t");
    const r = url.searchParams.get("r");
    const d = url.searchParams.get("d");
    const n = url.searchParams.get("n");
    const v = url.searchParams.get("v");
    const f = url.searchParams.get("f");
    const ts = url.searchParams.get("ts");
    const sig = url.searchParams.get("sig");

    if (!t || !r || !n || !v || !sig) return null;
    if (t !== "table" && t !== "seat") return null;
    if (f !== null && f !== "2") return null;

    const formatVersion = f === "2" ? 2 : 1;
    const version = Number(v);
    const tableId = d === null ? undefined : Number(d);
    if (!Number.isInteger(version) || version <= 0) return null;
    if (
      formatVersion === 2 &&
      (!Number.isInteger(tableId) || (tableId ?? 0) <= 0)
    ) {
      return null;
    }

    return {
      formatVersion,
      type: t,
      restaurantId: r,
      tableId,
      identifier: n,
      version,
      timestamp: ts ? parseInt(ts, 10) : 0,
      signature: sig,
    };
  } catch {
    return null;
  }
}
