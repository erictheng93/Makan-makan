/**
 * 訪客裝置識別
 *
 * The API keys a guest's "one active order per vendor" lock on this value.
 * It is an opaque random id, not a credential: it proves nothing, it only lets
 * the server recognise that the same browser storage is ordering again. Two
 * things it must not be derived from — the guest token (one token identifies
 * one *order*, and a market checkout mints one per vendor) and the customer
 * JWT (a shopper who signs in mid-session would change identity).
 *
 * Created lazily, so a visitor who only browses never gets one.
 */

const STORAGE_KEY = "guest_device_id";

// Mirrors the server's accepted charset/length (`getGuestDeviceId`).
const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

export function getOrCreateGuestDeviceId(): string | null {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && DEVICE_ID_PATTERN.test(existing)) return existing;

    const deviceId = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, deviceId);
    return deviceId;
  } catch (error) {
    // Private-mode storage or a disabled crypto API. The lock check degrades to
    // "no identity presented", which the server already treats as a new shopper.
    console.warn("讀取訪客裝置識別失敗:", error);
    return null;
  }
}
