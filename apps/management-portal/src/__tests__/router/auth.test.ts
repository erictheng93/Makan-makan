import { describe, expect, it } from "vitest";
import { router } from "@/router";
import { saveManagementSession } from "@/services/auth";

describe("management portal auth routing", () => {
  it("redirects protected routes to login when no management token exists", async () => {
    await router.push("/tenants");
    await router.isReady();

    expect(router.currentRoute.value.name).toBe("Login");
    expect(router.currentRoute.value.query.redirect).toBe("/tenants");
  });

  it("allows protected routes when a management token exists", async () => {
    saveManagementSession({
      token: "management-jwt",
      expiresAt: 4_102_444_800,
    });

    await router.push("/tenants");
    await router.isReady();

    expect(router.currentRoute.value.name).toBe("Tenants");
  });

  it("redirects authenticated operators away from the login page", async () => {
    saveManagementSession({
      token: "management-jwt",
      expiresAt: 4_102_444_800,
    });

    await router.push({ name: "Login", query: { redirect: "/health" } });
    await router.isReady();

    expect(router.currentRoute.value.name).toBe("Health");
  });
});
