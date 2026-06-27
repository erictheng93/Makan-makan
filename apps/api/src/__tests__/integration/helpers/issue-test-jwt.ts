import { sign } from "hono/jwt";

const TEST_SECRET = "test-jwt-secret-do-not-use-in-prod";

export type UserRole = 0 | 1 | 2 | 3 | 4 | 5;
type TestUserId = string | number;

export interface IssueTestJwtClaims {
  userId?: TestUserId;
  username?: string;
  restaurantId?: string;
  tokenVersion?: number;
  expiresInSeconds?: number;
}

export async function issueTestJwt(
  role: UserRole,
  claims?: IssueTestJwtClaims,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const userId = normalizeTestUserId(claims?.userId ?? 1);
  const username = claims?.username ?? `test-user-${userId}`;
  return sign(
    {
      sub: userId,
      id: userId,
      username,
      role,
      restaurantId: claims?.restaurantId ?? "1",
      tv: claims?.tokenVersion ?? 1,
      iat: now,
      exp: now + (claims?.expiresInSeconds ?? 3600),
    },
    TEST_SECRET,
  );
}

export interface AuthHelper {
  adminToken(restaurantId?: string, userId?: TestUserId): Promise<string>;
  ownerToken(userId: TestUserId, restaurantId: string): Promise<string>;
  staffToken(
    userId: TestUserId,
    role: UserRole,
    restaurantId: string,
  ): Promise<string>;
  customerToken(userId: TestUserId): Promise<string>;
}

interface TokenUserRow {
  username: string;
  role: number;
  restaurant_id: string | null;
  token_version: number | null;
}

async function loadTokenUser(
  db: D1Database | undefined,
  userId: TestUserId,
): Promise<TokenUserRow | null> {
  if (!db) return null;

  return (
    (await db
      .prepare(
        `SELECT username, role, restaurant_id, token_version
           FROM users
          WHERE id = ?
          LIMIT 1`,
      )
      .bind(normalizeTestUserId(userId))
      .first<TokenUserRow>()) ?? null
  );
}

function normalizeTestUserId(userId: TestUserId): string {
  if (typeof userId === "number") {
    return `01900000-0000-7000-8000-${String(userId).padStart(12, "0")}`;
  }
  return userId;
}

async function issueDbBackedJwt(
  db: D1Database | undefined,
  role: UserRole,
  claims: IssueTestJwtClaims,
): Promise<string> {
  const userId = claims.userId ?? 1;
  const row = await loadTokenUser(db, userId);

  return issueTestJwt(role, {
    ...claims,
    userId,
    username: claims.username ?? row?.username,
    restaurantId:
      claims.restaurantId ?? row?.restaurant_id ?? claims.restaurantId,
    tokenVersion: Number(row?.token_version ?? claims.tokenVersion ?? 1),
  });
}

export function buildAuthHelper(db?: D1Database): AuthHelper {
  return {
    adminToken: (restaurantId = "1", userId = 1) =>
      issueDbBackedJwt(db, 0, { userId, restaurantId }),
    ownerToken: (userId, restaurantId) =>
      issueDbBackedJwt(db, 1, { userId, restaurantId }),
    staffToken: (userId, role, restaurantId) =>
      issueDbBackedJwt(db, role, { userId, restaurantId }),
    customerToken: (userId) => issueDbBackedJwt(db, 5, { userId }),
  };
}
