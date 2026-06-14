const MANAGEMENT_TOKEN_KEY = "management_token";
const MANAGEMENT_TOKEN_EXPIRES_AT_KEY = "management_token_expires_at";

export interface ManagementSession {
  token: string;
  expiresAt?: number;
}

function storageAvailable(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function saveManagementSession(session: ManagementSession): void {
  if (!storageAvailable()) return;

  localStorage.setItem(MANAGEMENT_TOKEN_KEY, session.token);
  if (session.expiresAt != null) {
    localStorage.setItem(
      MANAGEMENT_TOKEN_EXPIRES_AT_KEY,
      String(session.expiresAt),
    );
  } else {
    localStorage.removeItem(MANAGEMENT_TOKEN_EXPIRES_AT_KEY);
  }
}

export function clearManagementSession(): void {
  if (!storageAvailable()) return;

  localStorage.removeItem(MANAGEMENT_TOKEN_KEY);
  localStorage.removeItem(MANAGEMENT_TOKEN_EXPIRES_AT_KEY);
}

export function getManagementToken(): string | null {
  if (!storageAvailable()) return null;

  const token = localStorage.getItem(MANAGEMENT_TOKEN_KEY);
  if (!token) return null;

  const expiresAtRaw = localStorage.getItem(MANAGEMENT_TOKEN_EXPIRES_AT_KEY);
  if (!expiresAtRaw) {
    return token;
  }

  const expiresAt = Number(expiresAtRaw);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) {
    clearManagementSession();
    return null;
  }

  return token;
}

export function isManagementAuthenticated(): boolean {
  return getManagementToken() != null;
}
