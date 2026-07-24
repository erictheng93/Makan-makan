import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { sign, verify } from "jsonwebtoken";
import * as bcrypt from "bcryptjs";
import { sessions, users } from "../schema";
import {
  createTestDatabase,
  type TestDatabase,
} from "../testing/create-test-database";
import { AuthService } from "./auth";

const jwtSecret = "0123456789abcdefghijklmnopqrstuvwxyz";
const publicUserId = "018f0000-0000-7000-8000-000000000101";
const loginUserId = "018f0000-0000-7000-8000-000000000102";
const validateUserId = "018f0000-0000-7000-8000-000000000103";

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
      id: publicUserId,
      username: "owner-refresh",
      fullName: "Owner Refresh",
      passwordHash: "hash",
      role: 1,
      isActive: true,
      tokenVersion: 1,
    });

    const accessToken = sign(
      {
        sub: publicUserId,
        username: "owner-refresh",
        role: 1,
        tv: 1,
      },
      jwtSecret,
      { expiresIn: "72h" },
    );
    const refreshToken = sign(
      { sub: publicUserId, type: "refresh", jti: "refresh-1" },
      jwtSecret,
      { expiresIn: "7d" },
    );

    await testDb.drizzle.insert(sessions).values({
      id: "session-1",
      userId: publicUserId,
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
    expect(verify(firstRefresh.tokens!.accessToken, jwtSecret)).toMatchObject({
      sub: publicUserId,
      username: "owner-refresh",
      role: 1,
      tv: 1,
    });
    expect(
      verify(firstRefresh.tokens!.accessToken, jwtSecret),
    ).not.toHaveProperty("id");
    expect(verify(firstRefresh.tokens!.refreshToken, jwtSecret)).toMatchObject({
      sub: publicUserId,
      type: "refresh",
    });
    expect(
      verify(firstRefresh.tokens!.refreshToken, jwtSecret),
    ).not.toHaveProperty("userId");

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

  it("issues UUID-principal tokens on login", async () => {
    await testDb.drizzle.insert(users).values({
      id: loginUserId,
      username: "owner-login",
      fullName: "Owner Login",
      passwordHash: await bcrypt.hash("CorrectHorse123!", 10),
      role: 1,
      isActive: true,
      tokenVersion: 3,
    });

    const service = new AuthService(testDb.bindings.DB, {
      JWT_SECRET: jwtSecret,
      NODE_ENV: "test",
    });

    const result = await service.login({
      username: "owner-login",
      password: "CorrectHorse123!",
    });

    expect(result.success).toBe(true);
    expect(result.user).toMatchObject({
      id: loginUserId,
      publicId: loginUserId,
      username: "owner-login",
      tokenVersion: 3,
    });

    const accessPayload = verify(result.tokens!.accessToken, jwtSecret);
    expect(accessPayload).toMatchObject({
      sub: loginUserId,
      username: "owner-login",
      role: 1,
      tv: 3,
    });
    expect(typeof accessPayload).toBe("object");
    expect((accessPayload as { exp?: number; iat?: number }).exp).toBe(
      (accessPayload as { exp?: number; iat?: number }).iat! + 60 * 60,
    );
    expect(typeof (accessPayload as { jti?: unknown }).jti).toBe("string");
    expect(accessPayload).not.toHaveProperty("id");

    const refreshPayload = verify(result.tokens!.refreshToken, jwtSecret);
    expect(refreshPayload).toMatchObject({
      sub: loginUserId,
      type: "refresh",
    });
    expect(refreshPayload).not.toHaveProperty("userId");
  });

  it("validates UUID-principal access tokens through the session user id", async () => {
    await testDb.drizzle.insert(users).values({
      id: validateUserId,
      username: "owner-validate",
      fullName: "Owner Validate",
      passwordHash: "hash",
      role: 1,
      isActive: true,
      tokenVersion: 4,
    });

    const accessToken = sign(
      {
        sub: validateUserId,
        username: "owner-validate",
        role: 1,
        tv: 4,
      },
      jwtSecret,
      { expiresIn: "72h" },
    );

    await testDb.drizzle.insert(sessions).values({
      id: "session-validate",
      userId: validateUserId,
      token: accessToken,
      isActive: true,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const service = new AuthService(testDb.bindings.DB, {
      JWT_SECRET: jwtSecret,
      NODE_ENV: "test",
    });

    await expect(service.validateToken(accessToken)).resolves.toMatchObject({
      valid: true,
      user: {
        id: validateUserId,
        publicId: validateUserId,
        username: "owner-validate",
      },
    });
  });
});
