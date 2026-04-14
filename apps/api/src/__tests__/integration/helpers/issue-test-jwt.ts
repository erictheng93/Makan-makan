import { sign } from "hono/jwt";

const TEST_SECRET = "test-jwt-secret-do-not-use-in-prod";

export type UserRole = 0 | 1 | 2 | 3 | 4 | 5;

export interface IssueTestJwtClaims {
  userId?: number;
  username?: string;
  restaurantId?: string;
  expiresInSeconds?: number;
}

// hono/jwt `sign` is async, so this function is async too.
export async function issueTestJwt(
  role: UserRole,
  claims?: IssueTestJwtClaims,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const userId = claims?.userId ?? 1;
  // `username` is required by the production authMiddleware (apps/api/src/middleware/auth.ts),
  // so every test token must carry it. Default to `test-user-<id>` for determinism.
  const username = claims?.username ?? `test-user-${userId}`;
  return sign(
    {
      sub: String(userId),
      id: userId,
      username,
      role,
      restaurantId: claims?.restaurantId ?? "1",
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

export function buildAuthHelper(): AuthHelper {
  return {
    adminToken: (restaurantId = "1") => issueTestJwt(0, { restaurantId }),
    ownerToken: (userId, restaurantId) =>
      issueTestJwt(1, { userId, restaurantId }),
    staffToken: (userId, role, restaurantId) =>
      issueTestJwt(role, { userId, restaurantId }),
    customerToken: (userId) => issueTestJwt(5, { userId }),
  };
}
