/**
 * Resolving a verified provider subject to a MakanMasak customer.
 *
 * The one rule this module exists to enforce: **a provider-reported email never
 * merges accounts by itself.** LINE only returns email if the channel asked for
 * it and does not promise it is verified, so "sign up at any provider claiming
 * the victim's address, then get handed their account" would be a two-step
 * takeover of order history, points and stored credit. A matching email only
 * earns the customer an invitation to prove they control the existing account,
 * which is what the binding token is for.
 */

import type { CustomerOAuthProvider } from "@makanmasak/shared-types";
import { generateUUID } from "@makanmasak/utils";
import type { Env } from "../../../../types/env";

/** Apple's relay addresses are per-app aliases; they identify nothing of ours. */
const APPLE_PRIVATE_RELAY_SUFFIX = "@privaterelay.appleid.com";

export interface OAuthProfile {
  email?: string;
  emailVerified?: boolean;
  displayName?: string;
  avatarUrl?: string;
  scopes?: string;
  tokenExpiresAtMs?: number;
}

export interface AuthIdentityRow {
  id: string;
  customer_id: string;
  provider: string;
  provider_uid: string;
  revoked_at_ms: number | null;
}

export function isUsableProviderEmail(email: string | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return false;
  // A relay alias is deliverable but says nothing about who the person is, so
  // it must never be matched against an existing primary_email.
  return !normalized.endsWith(APPLE_PRIVATE_RELAY_SUFFIX);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** `eric@example.com` → `e***@e***.com`, enough to jog a memory, not to enumerate. */
export function maskEmail(email: string): string {
  const [local, domain] = normalizeEmail(email).split("@");
  if (!domain) return "***";
  const dotIndex = domain.lastIndexOf(".");
  const tld = dotIndex === -1 ? "" : domain.slice(dotIndex);
  return `${local.slice(0, 1)}***@${domain.slice(0, 1)}***${tld}`;
}

export async function findLiveIdentity(
  env: Env,
  provider: CustomerOAuthProvider,
  providerUid: string,
): Promise<AuthIdentityRow | null> {
  return env.DB.prepare(
    `SELECT id, customer_id, provider, provider_uid, revoked_at_ms
       FROM customer_auth_identities
      WHERE provider = ? AND provider_uid = ? AND revoked_at_ms IS NULL
      LIMIT 1`,
  )
    .bind(provider, providerUid)
    .first<AuthIdentityRow>();
}

export async function findActiveCustomerIdByEmail(
  env: Env,
  email: string,
): Promise<string | null> {
  const row = await env.DB.prepare(
    `SELECT id FROM customers
      WHERE primary_email = ? AND status = 'active'
      LIMIT 1`,
  )
    .bind(normalizeEmail(email))
    .first<{ id: string }>();
  return row?.id ?? null;
}

export async function touchIdentityUse(
  env: Env,
  identityId: string,
  now: number,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE customer_auth_identities
        SET last_used_at_ms = ?, updated_at_ms = ?
      WHERE id = ?`,
  )
    .bind(now, now, identityId)
    .run();
}

/**
 * Attach a provider identity to an existing customer.
 *
 * `verified_at_ms` is set immediately: the provider already authenticated the
 * person, and the caller has already established which local account they are
 * entitled to — either because they were signed in when they started, or
 * because they passed the binding challenge.
 */
export async function insertIdentity(
  env: Env,
  input: {
    customerId: string;
    provider: CustomerOAuthProvider;
    providerUid: string;
    profile: OAuthProfile;
    now: number;
  },
): Promise<string> {
  const id = generateUUID();
  const { profile, now } = input;

  await env.DB.prepare(
    `INSERT INTO customer_auth_identities
      (id, customer_id, provider, provider_uid,
       provider_email, provider_email_verified, provider_display_name,
       provider_avatar_url, scopes, token_expires_at_ms,
       verified_at_ms, last_used_at_ms, created_at_ms, updated_at_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      input.customerId,
      input.provider,
      input.providerUid,
      profile.email ? normalizeEmail(profile.email) : null,
      profile.emailVerified === undefined
        ? null
        : profile.emailVerified
          ? 1
          : 0,
      profile.displayName ?? null,
      profile.avatarUrl ?? null,
      profile.scopes ?? null,
      profile.tokenExpiresAtMs ?? null,
      now,
      now,
      now,
      now,
    )
    .run();

  return id;
}

/**
 * Create a brand-new customer for a provider subject nothing local matches.
 *
 * `primary_email` is only claimed when the provider says the address is
 * verified. An unverified claim would let a federated account squat on an
 * address a real owner may later want to register with.
 */
export async function createCustomerForIdentity(
  env: Env,
  input: {
    provider: CustomerOAuthProvider;
    providerUid: string;
    profile: OAuthProfile;
    now: number;
  },
): Promise<string> {
  const { profile, now } = input;
  const customerId = generateUUID();
  const claimEmail =
    profile.emailVerified === true && isUsableProviderEmail(profile.email)
      ? normalizeEmail(profile.email as string)
      : null;

  if (claimEmail) {
    // `idx_customers_primary_email` is partial on `status = 'active'`, but a
    // soft-deleted row keeps its address and would still collide on insert.
    // The phone path already does exactly this before claiming a number.
    await env.DB.prepare(
      `UPDATE customers
          SET primary_email = NULL, updated_at_ms = ?
        WHERE primary_email = ? AND status = 'deleted'`,
    )
      .bind(now, claimEmail)
      .run();
  }

  await env.DB.prepare(
    `INSERT INTO customers
      (id, display_name, primary_email, avatar_url, status,
       created_at_ms, updated_at_ms)
     VALUES (?, ?, ?, ?, 'active', ?, ?)`,
  )
    .bind(
      customerId,
      profile.displayName?.trim() || "MakanMasak 會員",
      claimEmail,
      profile.avatarUrl ?? null,
      now,
      now,
    )
    .run();

  await insertIdentity(env, {
    customerId,
    provider: input.provider,
    providerUid: input.providerUid,
    profile,
    now,
  });

  return customerId;
}

export interface LiveIdentitySummary {
  id: string;
  provider: string;
  providerEmail: string | null;
  providerDisplayName: string | null;
  createdAt: number;
  lastUsedAt: number | null;
}

export async function listLiveIdentities(
  env: Env,
  customerId: string,
): Promise<LiveIdentitySummary[]> {
  const result = await env.DB.prepare(
    `SELECT id, provider, provider_email, provider_display_name,
            created_at_ms, last_used_at_ms
       FROM customer_auth_identities
      WHERE customer_id = ? AND revoked_at_ms IS NULL
      ORDER BY created_at_ms ASC`,
  )
    .bind(customerId)
    .all<{
      id: string;
      provider: string;
      provider_email: string | null;
      provider_display_name: string | null;
      created_at_ms: number;
      last_used_at_ms: number | null;
    }>();

  return (result.results ?? []).map((row) => ({
    id: row.id,
    provider: row.provider,
    providerEmail: row.provider_email,
    providerDisplayName: row.provider_display_name,
    createdAt: row.created_at_ms,
    lastUsedAt: row.last_used_at_ms,
  }));
}

/**
 * Whether the customer would still be able to sign in after removing
 * `identityId`. A verified phone counts, because phone-OTP is a login route in
 * its own right and does not need a row in this table.
 */
export async function hasAnotherAuthMethod(
  env: Env,
  customerId: string,
  identityId: string,
): Promise<boolean> {
  const customer = await env.DB.prepare(
    `SELECT primary_phone FROM customers WHERE id = ? LIMIT 1`,
  )
    .bind(customerId)
    .first<{ primary_phone: string | null }>();

  if (customer?.primary_phone) return true;

  const row = await env.DB.prepare(
    `SELECT COUNT(*) AS remaining
       FROM customer_auth_identities
      WHERE customer_id = ? AND revoked_at_ms IS NULL AND id != ?`,
  )
    .bind(customerId, identityId)
    .first<{ remaining: number }>();

  return (row?.remaining ?? 0) > 0;
}

export async function revokeIdentity(
  env: Env,
  identityId: string,
  customerId: string,
  now: number,
): Promise<boolean> {
  const result = await env.DB.prepare(
    `UPDATE customer_auth_identities
        SET revoked_at_ms = ?, updated_at_ms = ?
      WHERE id = ? AND customer_id = ? AND revoked_at_ms IS NULL`,
  )
    .bind(now, now, identityId, customerId)
    .run();

  return (result.meta.changes ?? 0) > 0;
}
