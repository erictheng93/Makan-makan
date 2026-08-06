export const STORAGE_KEY = "makanmakan_group_order_host_credentials";

const CREDENTIAL_TTL_MS = 24 * 60 * 60 * 1000;

export interface HostCredentials {
  groupOrderId: string;
  memberToken: string;
  recoveryCode: string;
  savedAt: number;
}

type StoredHostCredentials = Record<string, HostCredentials>;

export function saveHostCredentials(input: {
  groupOrderId: string;
  memberToken: string;
  recoveryCode: string;
}): void {
  const credentials = readCredentialRecords();
  credentials[input.groupOrderId] = {
    ...input,
    savedAt: Date.now(),
  };
  writeCredentialRecords(credentials);
}

export function readHostCredentials(
  groupOrderId: string,
): HostCredentials | null {
  const credentials = readCredentialRecords();
  const credential = credentials[groupOrderId];
  if (!credential) return null;

  if (Date.now() - credential.savedAt > CREDENTIAL_TTL_MS) {
    delete credentials[groupOrderId];
    writeCredentialRecords(credentials);
    return null;
  }

  return credential;
}

export function updateHostMemberToken(
  groupOrderId: string,
  memberToken: string,
): void {
  const existing = readHostCredentials(groupOrderId);
  if (!existing) return;

  saveHostCredentials({
    groupOrderId,
    memberToken,
    recoveryCode: existing.recoveryCode,
  });
}

export function clearHostCredentials(groupOrderId: string): void {
  const credentials = readCredentialRecords();
  if (!(groupOrderId in credentials)) return;

  delete credentials[groupOrderId];
  writeCredentialRecords(credentials);
}

function readCredentialRecords(): StoredHostCredentials {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return {};

    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      localStorage.removeItem(STORAGE_KEY);
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, HostCredentials] =>
          isHostCredentials(entry[1]),
      ),
    );
  } catch (error) {
    console.warn("讀取群組主辦人憑證失敗:", error);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage can be unavailable in private browsing; recovery degrades only.
    }
    return {};
  }
}

function writeCredentialRecords(credentials: StoredHostCredentials): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
  } catch (error) {
    console.warn("保存群組主辦人憑證失敗:", error);
  }
}

function isHostCredentials(value: unknown): value is HostCredentials {
  if (!value || typeof value !== "object") return false;
  const credential = value as Partial<HostCredentials>;
  return (
    typeof credential.groupOrderId === "string" &&
    typeof credential.memberToken === "string" &&
    typeof credential.recoveryCode === "string" &&
    typeof credential.savedAt === "number"
  );
}
