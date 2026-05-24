import { sign } from "hono/jwt";

const TEST_SECRET = "test-jwt-secret-do-not-use-in-prod";

export type UserRole = 0 | 1 | 2 | 3 | 4 | 5;

export interface IssueTestJwtClaims {
  userId?: number;
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
  const userId = claims?.userId ?? 1;
  const username = claims?.username ?? `test-user-${userId}`;
  return sign(
    {
      sub: String(userId),
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
  adminToken(restaurantId?: string): Promise<string>;
  ownerToken(userId: number, restaurantId: string): Promise<string>;
  staffToken(
    userId: number,
    role: UserRole,
    restaurantId: string,
  ): Promise<string>;
  customerToken(userId: number): Promise<string>;
}

interface TokenUserRow {
  username: string;
  role: number;
  restaurant_id: string | null;
  token_version: number | null;
}

async function loadTokenUser(
  db: D1Database | undefined,
  userId: number,
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
      .bind(userId)
      .first<TokenUserRow>()) ?? null
  );
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
    adminToken: (restaurantId = "1") =>
      issueDbBackedJwt(db, 0, { restaurantId }),
    ownerToken: (userId, restaurantId) =>
      issueDbBackedJwt(db, 1, { userId, restaurantId }),
    staffToken: (userId, role, restaurantId) =>
      issueDbBackedJwt(db, role, { userId, restaurantId }),
    customerToken: (userId) => issueDbBackedJwt(db, 5, { userId }),
  };
}
