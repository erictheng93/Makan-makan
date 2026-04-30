import { describe, it, expect } from "vitest";
import { verify } from "hono/jwt";
import { issueTestJwt, buildAuthHelper } from "../issue-test-jwt";

const TEST_SECRET = "test-jwt-secret-do-not-use-in-prod";

type TestJwtPayload = {
  role: number;
  id: number;
  sub: string;
  username: string;
  restaurantId: string;
  exp: number;
  iat: number;
};

describe("issueTestJwt", () => {
  it("issues a token with the expected role and default claims", async () => {
    const token = await issueTestJwt(5, { userId: 42 });
    const decoded = (await verify(
      token,
      TEST_SECRET,
      "HS256",
    )) as TestJwtPayload;
    expect(decoded.role).toBe(5);
    expect(decoded.id).toBe(42);
    expect(decoded.sub).toBe("42");
    expect(decoded.username).toBe("test-user-42");
    expect(decoded.restaurantId).toBe("1");
    expect(decoded.exp - decoded.iat).toBe(3600);
  });

  it("honors a custom username claim", async () => {
    const token = await issueTestJwt(0, { userId: 1, username: "alice" });
    const decoded = (await verify(
      token,
      TEST_SECRET,
      "HS256",
    )) as TestJwtPayload;
    expect(decoded.username).toBe("alice");
  });

  it("honors custom restaurantId and expiry", async () => {
    const token = await issueTestJwt(1, {
      userId: 7,
      restaurantId: "r-special",
      expiresInSeconds: 60,
    });
    const decoded = (await verify(
      token,
      TEST_SECRET,
      "HS256",
    )) as TestJwtPayload;
    expect(decoded.restaurantId).toBe("r-special");
    expect(decoded.exp - decoded.iat).toBe(60);
  });
});

describe("buildAuthHelper", () => {
  const helper = buildAuthHelper();

  it("adminToken produces a role=0 token", async () => {
    const decoded = (await verify(
      await helper.adminToken(),
      TEST_SECRET,
      "HS256",
    )) as TestJwtPayload;
    expect(decoded.role).toBe(0);
  });

  it("ownerToken produces a role=1 token with userId and restaurantId", async () => {
    const decoded = (await verify(
      await helper.ownerToken(9, "r-1"),
      TEST_SECRET,
      "HS256",
    )) as TestJwtPayload;
    expect(decoded.role).toBe(1);
    expect(decoded.id).toBe(9);
    expect(decoded.restaurantId).toBe("r-1");
  });

  it("customerToken produces a role=5 token", async () => {
    const decoded = (await verify(
      await helper.customerToken(100),
      TEST_SECRET,
      "HS256",
    )) as TestJwtPayload;
    expect(decoded.role).toBe(5);
    expect(decoded.id).toBe(100);
  });
});
