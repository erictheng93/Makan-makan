import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { sign } from "jsonwebtoken";
import { sessions, users } from "../schema";
import {
  createTestDatabase,
  type TestDatabase,
} from "../testing/create-test-database";
import { AuthService } from "./auth";

const jwtSecret = "0123456789abcdefghijklmnopqrstuvwxyz";

describe("AuthService refresh token rotation", () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await createTestDatabase();
  }, 180_000);

  afterAll(async () => {
    await testDb?.dispose();
  });

  beforeEach(async () => {
    await testDb.truncateAll();
  });

  it("rotates staff refresh tokens and rejects replay of the previous token", async () => {
    await testDb.drizzle.insert(users).values({
      id: 101,
      username: "owner-refresh",
      fullName: "Owner Refresh",
      passwordHash: "hash",
      role: 1,
      isActive: true,
      tokenVersion: 1,
    });

    const accessToken = sign(
      {
        id: 101,
        username: "owner-refresh",
        role: 1,
        tv: 1,
      },
      jwtSecret,
      { expiresIn: "72h" },
    );
    const refreshToken = sign(
      { userId: 101, type: "refresh", jti: "refresh-1" },
      jwtSecret,
      { expiresIn: "7d" },
    );

    await testDb.drizzle.insert(sessions).values({
      id: "session-1",
      userId: 101,
      token: accessToken,
      refreshToken,
      isActive: true,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const service = new AuthService(testDb.bindings.DB, {
      JWT_SECRET: jwtSecret,
      NODE_ENV: "test",
    });

    const firstRefresh = await service.refreshToken(refreshToken);

    expect(firstRefresh.success).toBe(true);
    expect(firstRefresh.tokens?.refreshToken).toBeTruthy();
    expect(firstRefresh.tokens?.refreshToken).not.toBe(refreshToken);

    const storedSession = await testDb.drizzle
      .select({ refreshToken: sessions.refreshToken })
      .from(sessions)
      .where(eq(sessions.id, "session-1"))
      .get();
    expect(storedSession?.refreshToken).toBe(firstRefresh.tokens?.refreshToken);

    await expect(service.refreshToken(refreshToken)).resolves.toMatchObject({
      success: false,
      error: "Session not found or expired",
    });
  });
});
