import { verify } from "hono/jwt";
import { describe, expect, it, vi } from "vitest";
import {
  CUSTOMER_REFRESH_TOKEN_SECONDS,
  customerRefreshRecordKey,
  issueBindingToken,
  issueCustomerSession,
} from "./CustomerSessionService";

const JWT_SECRET = "test-jwt-secret-with-at-least-32-chars";

describe("issueBindingToken", () => {
  it("issues customer_bind tokens with a 600 second lifetime", async () => {
    const token = await issueBindingToken(
      { JWT_SECRET },
      { provider: "line", providerUid: "line-user-1" },
    );
    const payload = await verify(token, JWT_SECRET, "HS256");

    expect(payload).toMatchObject({
      type: "customer_bind",
      provider: "line",
      providerUid: "line-user-1",
    });
    expect(Number(payload.exp) - Number(payload.iat)).toBe(600);
  });
});

describe("issueCustomerSession", () => {
  it("stores refresh records under the customer-scoped prefix", async () => {
    const tokenKv = {
      put: vi.fn(),
    };
    const context = {
      env: {
        JWT_SECRET,
        TOKEN_BLACKLIST: tokenKv,
      },
      header: vi.fn(),
    };

    await issueCustomerSession(context as never, "customer-1");

    expect(tokenKv.put).toHaveBeenCalledWith(
      expect.stringMatching(/^customer_refresh:customer-1:/),
      "1",
      { expirationTtl: CUSTOMER_REFRESH_TOKEN_SECONDS },
    );
  });

  it("builds refresh record keys from customer id and jti", () => {
    expect(customerRefreshRecordKey("customer-1", "refresh-1")).toBe(
      "customer_refresh:customer-1:refresh-1",
    );
  });
});
