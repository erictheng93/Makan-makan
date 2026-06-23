import { ApiError } from "../utils/api-error";

export type StaffPrincipalIdentifier = string | number;

export interface StaffPrincipalRow {
  id: number;
  public_id: string | null;
  username: string;
  role: number;
  restaurant_id: string | null;
  is_active: number | boolean;
  token_version: number | null;
}

export interface StaffPrincipal {
  legacyUserId: number;
  publicUserId?: string;
  username: string;
  role: number;
  restaurantId?: string;
  isActive: boolean;
  tokenVersion: number;
}

export interface StaffPrincipalResolveOptions {
  requireActive?: boolean;
}

export type StaffPrincipalLookupInput =
  | { legacyUserId: number; publicUserId?: never }
  | { publicUserId: string; legacyUserId?: never };

const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function toStaffPrincipalLookupInput(
  identifier: StaffPrincipalIdentifier,
): StaffPrincipalLookupInput {
  if (typeof identifier === "number") {
    if (!Number.isInteger(identifier) || identifier <= 0) {
      throw invalidPrincipal();
    }
    return { legacyUserId: identifier };
  }

  const lookupKey = identifier.trim();
  if (!lookupKey) {
    throw invalidPrincipal();
  }

  if (/^\d+$/.test(lookupKey)) {
    const legacyUserId = Number.parseInt(lookupKey, 10);
    if (!Number.isInteger(legacyUserId) || legacyUserId <= 0) {
      throw invalidPrincipal();
    }
    return { legacyUserId };
  }

  if (!UUID_V7_PATTERN.test(lookupKey)) {
    throw invalidPrincipal();
  }

  return { publicUserId: lookupKey };
}

export async function resolveStaffPrincipal(
  db: D1Database,
  identifier: StaffPrincipalIdentifier,
  options: StaffPrincipalResolveOptions = {},
): Promise<StaffPrincipal> {
  const requireActive = options.requireActive ?? true;
  const lookup = toStaffPrincipalLookupInput(identifier);
  const sql =
    "legacyUserId" in lookup
      ? "SELECT `id`, `public_id`, `username`, `role`, `restaurant_id`, `is_active`, `token_version` FROM `users` WHERE `id` = ? LIMIT 1"
      : "SELECT `id`, `public_id`, `username`, `role`, `restaurant_id`, `is_active`, `token_version` FROM `users` WHERE `public_id` = ? LIMIT 1";
  const bindValue =
    "legacyUserId" in lookup ? lookup.legacyUserId : lookup.publicUserId;
  const row = await db.prepare(sql).bind(bindValue).first<StaffPrincipalRow>();

  if (!row) {
    throw new ApiError(
      "STAFF_PRINCIPAL_NOT_FOUND",
      "Staff principal not found",
      404,
    );
  }

  const principal = toStaffPrincipal(row);
  if (requireActive && !principal.isActive) {
    throw new ApiError(
      "STAFF_PRINCIPAL_INACTIVE",
      "Staff principal is inactive",
      403,
    );
  }

  return principal;
}

function toStaffPrincipal(row: StaffPrincipalRow): StaffPrincipal {
  return {
    legacyUserId: Number(row.id),
    publicUserId: row.public_id ?? undefined,
    username: String(row.username),
    role: Number(row.role),
    restaurantId: row.restaurant_id ?? undefined,
    isActive: row.is_active === true || Number(row.is_active) === 1,
    tokenVersion: Number(row.token_version ?? 1),
  };
}

function invalidPrincipal(): ApiError {
  return new ApiError(
    "STAFF_PRINCIPAL_INVALID",
    "Staff principal must be a positive integer id or UUID-v7 public id",
    400,
  );
}
