// Keep the original key so existing host recovery credentials survive the
// module rename from host-specific storage to shared group-order sessions.
export const STORAGE_KEY = "makanmakan_group_order_host_credentials";

const CREDENTIAL_TTL_MS = 24 * 60 * 60 * 1000;

export interface HostCredentials {
  groupOrderId: string;
  memberToken: string;
  memberId?: string;
  recoveryCode: string;
  savedAt: number;
}

export interface MemberCredentials {
  groupOrderId: string;
  memberId: string;
  memberToken: string;
  savedAt: number;
}

export interface ActiveGroupOrderSession {
  groupOrderId: string;
  restaurantId: string;
  tableId?: string;
  savedAt: number;
}

interface StoredGroupOrderSessions {
  hosts: Record<string, HostCredentials>;
  members: Record<string, MemberCredentials>;
  active: Record<string, ActiveGroupOrderSession>;
}

export function saveHostCredentials(input: {
  groupOrderId: string;
  memberToken: string;
  memberId?: string;
  recoveryCode: string;
}): void {
  const sessions = readSessionRecords();
  sessions.hosts[input.groupOrderId] = {
    ...sessions.hosts[input.groupOrderId],
    groupOrderId: input.groupOrderId,
    memberToken: input.memberToken,
    memberId: input.memberId ?? sessions.hosts[input.groupOrderId]?.memberId,
    recoveryCode: input.recoveryCode,
    savedAt: Date.now(),
  };
  writeSessionRecords(sessions);
}

export function readHostCredentials(
  groupOrderId: string,
): HostCredentials | null {
  const sessions = readSessionRecords();
  const credential = sessions.hosts[groupOrderId];
  if (!credential) return null;

  if (Date.now() - credential.savedAt > CREDENTIAL_TTL_MS) {
    delete sessions.hosts[groupOrderId];
    writeSessionRecords(sessions);
    return null;
  }

  return credential;
}

export function saveMemberCredentials(input: {
  groupOrderId: string;
  memberId: string;
  memberToken: string;
}): void {
  const sessions = readSessionRecords();
  sessions.members[input.groupOrderId] = {
    ...input,
    savedAt: Date.now(),
  };
  writeSessionRecords(sessions);
}

export function readMemberCredentials(
  groupOrderId: string,
): MemberCredentials | null {
  const sessions = readSessionRecords();
  const credential = sessions.members[groupOrderId];
  if (!credential) return null;

  if (Date.now() - credential.savedAt > CREDENTIAL_TTL_MS) {
    delete sessions.members[groupOrderId];
    writeSessionRecords(sessions);
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
    memberId: existing.memberId,
    recoveryCode: existing.recoveryCode,
  });
}

export function clearHostCredentials(groupOrderId: string): void {
  const sessions = readSessionRecords();
  if (!(groupOrderId in sessions.hosts)) return;

  delete sessions.hosts[groupOrderId];
  writeSessionRecords(sessions);
}

export function clearMemberCredentials(groupOrderId: string): void {
  const sessions = readSessionRecords();
  if (!(groupOrderId in sessions.members)) return;

  delete sessions.members[groupOrderId];
  writeSessionRecords(sessions);
}

export function saveActiveGroupOrder(input: {
  groupOrderId: string;
  restaurantId: string;
  tableId?: string;
}): void {
  const sessions = readSessionRecords();
  sessions.active[activeSessionKey(input.restaurantId, input.tableId)] = {
    groupOrderId: input.groupOrderId,
    restaurantId: input.restaurantId,
    tableId: input.tableId,
    savedAt: Date.now(),
  };
  writeSessionRecords(sessions);
}

export function readActiveGroupOrder(
  restaurantId: string,
  tableId?: string,
): ActiveGroupOrderSession | null {
  const sessions = readSessionRecords();
  const key = activeSessionKey(restaurantId, tableId);
  const active = sessions.active[key];
  if (!active) return null;

  if (Date.now() - active.savedAt > CREDENTIAL_TTL_MS) {
    delete sessions.active[key];
    writeSessionRecords(sessions);
    return null;
  }

  return active;
}

export function clearActiveGroupOrder(
  restaurantId: string,
  tableId?: string,
): void {
  const sessions = readSessionRecords();
  const key = activeSessionKey(restaurantId, tableId);
  if (!(key in sessions.active)) return;

  delete sessions.active[key];
  writeSessionRecords(sessions);
}

function activeSessionKey(restaurantId: string, tableId?: string): string {
  return `${restaurantId}:${tableId ?? ""}`;
}

function readSessionRecords(): StoredGroupOrderSessions {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return emptySessions();

    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      localStorage.removeItem(STORAGE_KEY);
      return emptySessions();
    }

    return normalizeSessions(parsed);
  } catch (error) {
    console.warn("讀取群組點餐 session 失敗:", error);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage can be unavailable in private browsing; recovery degrades only.
    }
    return emptySessions();
  }
}

function writeSessionRecords(sessions: StoredGroupOrderSessions): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.warn("保存群組點餐 session 失敗:", error);
  }
}

function emptySessions(): StoredGroupOrderSessions {
  return { hosts: {}, members: {}, active: {} };
}

function normalizeSessions(
  parsed: Record<string, unknown>,
): StoredGroupOrderSessions {
  const hosts = isRecord(parsed.hosts)
    ? filterRecords(parsed.hosts, isHostCredentials)
    : filterRecords(parsed, isHostCredentials);
  const members = isRecord(parsed.members)
    ? filterRecords(parsed.members, isMemberCredentials)
    : {};
  const active = isRecord(parsed.active)
    ? filterRecords(parsed.active, isActiveGroupOrderSession)
    : {};

  return { hosts, members, active };
}

function filterRecords<T>(
  records: Record<string, unknown>,
  predicate: (value: unknown) => value is T,
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(records).filter((entry): entry is [string, T] =>
      predicate(entry[1]),
    ),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isHostCredentials(value: unknown): value is HostCredentials {
  if (!value || typeof value !== "object") return false;
  const credential = value as Partial<HostCredentials>;
  return (
    typeof credential.groupOrderId === "string" &&
    typeof credential.memberToken === "string" &&
    (credential.memberId === undefined ||
      typeof credential.memberId === "string") &&
    typeof credential.recoveryCode === "string" &&
    typeof credential.savedAt === "number"
  );
}

function isMemberCredentials(value: unknown): value is MemberCredentials {
  if (!value || typeof value !== "object") return false;
  const credential = value as Partial<MemberCredentials>;
  return (
    typeof credential.groupOrderId === "string" &&
    typeof credential.memberId === "string" &&
    typeof credential.memberToken === "string" &&
    typeof credential.savedAt === "number"
  );
}

function isActiveGroupOrderSession(
  value: unknown,
): value is ActiveGroupOrderSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<ActiveGroupOrderSession>;
  return (
    typeof session.groupOrderId === "string" &&
    typeof session.restaurantId === "string" &&
    (session.tableId === undefined || typeof session.tableId === "string") &&
    typeof session.savedAt === "number"
  );
}
