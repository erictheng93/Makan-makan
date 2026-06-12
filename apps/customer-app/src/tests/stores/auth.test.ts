import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useAuthStore } from "@/stores/auth";
import {
  customerIdentityApi,
  type CustomerSummary,
} from "@/services/customerIdentityApi";

vi.mock("@/utils/i18n", () => ({
  translate: (key: string) => key,
}));

vi.mock("@makanmakan/utils", () => ({
  getRefreshDelay: vi.fn(() => 0),
}));

vi.mock("@/services/customerIdentityApi", () => ({
  customerIdentityApi: {
    requestOtp: vi.fn(),
    verifyOtp: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    getMe: vi.fn(),
  },
}));

const customer = (
  overrides: Partial<CustomerSummary> = {},
): CustomerSummary => ({
  id: "customer-1",
  displayName: "Lin Mei",
  primaryPhone: "0912345678",
  primaryEmail: "mei@example.com",
  status: "active",
  createdAtMs: 1770000000000,
  updatedAtMs: 1770000000000,
  ...overrides,
});

beforeEach(() => {
  setActivePinia(createPinia());
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("customer auth store", () => {
  it("hydrates customer user and token from localStorage", () => {
    localStorage.setItem(
      "customer_user",
      JSON.stringify({
        id: "customer-1",
        username: "0912345678",
        fullName: "Lin Mei",
        phone: "0912345678",
        role: 5,
      }),
    );
    localStorage.setItem("customer_auth_token", "stored-access");

    const store = useAuthStore();

    expect(store.isAuthenticated).toBe(true);
    expect(store.userId).toBe("customer-1");
    expect(store.userName).toBe("Lin Mei");
    expect(store.token).toBe("stored-access");
  });

  it("requests an OTP and exposes API errors without leaving loading enabled", async () => {
    vi.mocked(customerIdentityApi.requestOtp)
      .mockResolvedValueOnce({
        phone: "0912345678",
        expiresInSeconds: 300,
        devOtp: "123456",
      })
      .mockRejectedValueOnce(new Error("SMS quota exceeded"));
    const store = useAuthStore();

    await expect(store.requestOtp("0912345678")).resolves.toEqual({
      success: true,
      data: {
        phone: "0912345678",
        expiresInSeconds: 300,
        devOtp: "123456",
      },
    });

    await expect(store.requestOtp("0912345678")).resolves.toEqual({
      success: false,
      error: "SMS quota exceeded",
    });
    expect(store.error).toBe("SMS quota exceeded");
    expect(store.isLoading).toBe(false);
  });

  it("verifies OTP sessions, persists only the access token, and maps customer summary to app user", async () => {
    vi.mocked(customerIdentityApi.verifyOtp).mockResolvedValue({
      accessToken: "access-token",
      expiresIn: 3600,
      customer: customer(),
    });
    const store = useAuthStore();

    await expect(store.verifyOtp("0912345678", "123456")).resolves.toEqual({
      success: true,
    });

    expect(store.isAuthenticated).toBe(true);
    expect(store.user).toEqual({
      id: "customer-1",
      username: "0912345678",
      fullName: "Lin Mei",
      email: "mei@example.com",
      phone: "0912345678",
      role: 5,
    });
    expect(localStorage.getItem("customer_auth_token")).toBe("access-token");
    expect(localStorage.getItem("customer_refresh_token")).toBeNull();
    expect(JSON.parse(localStorage.getItem("customer_user")!)).toMatchObject({
      id: "customer-1",
      fullName: "Lin Mei",
    });
  });

  it("falls back to refresh during checkAuth and does not logout on refresh success", async () => {
    localStorage.setItem("customer_auth_token", "old-access");
    vi.mocked(customerIdentityApi.getMe).mockRejectedValue(
      new Error("access expired"),
    );
    vi.mocked(customerIdentityApi.refresh).mockResolvedValue({
      accessToken: "new-access",
      expiresIn: 3600,
    });
    const store = useAuthStore();

    await expect(store.checkAuth()).resolves.toBe(true);

    expect(customerIdentityApi.refresh).toHaveBeenCalledWith();
    expect(store.token).toBe("new-access");
    expect(localStorage.getItem("customer_auth_token")).toBe("new-access");
    expect(localStorage.getItem("customer_refresh_token")).toBeNull();
    expect(customerIdentityApi.logout).not.toHaveBeenCalled();
  });

  it("logs out locally even when logout API fails", async () => {
    localStorage.setItem("customer_auth_token", "access-token");
    localStorage.setItem(
      "customer_user",
      JSON.stringify({
        id: "customer-1",
        username: "0912345678",
        fullName: "Lin Mei",
        role: 5,
      }),
    );
    vi.mocked(customerIdentityApi.logout).mockRejectedValue(
      new Error("network unavailable"),
    );
    const store = useAuthStore();

    await store.logout();

    expect(store.user).toBeNull();
    expect(store.token).toBeNull();
    expect(localStorage.getItem("customer_auth_token")).toBeNull();
    expect(localStorage.getItem("customer_refresh_token")).toBeNull();
    expect(localStorage.getItem("customer_user")).toBeNull();
  });

  it("keeps password registration retired", async () => {
    const store = useAuthStore();

    await expect(
      store.register({
        username: "lin",
        password: "secret",
        fullName: "Lin Mei",
      }),
    ).resolves.toEqual({
      success: false,
      error: "Customer password registration is retired. Use phone OTP login.",
    });
  });
});
