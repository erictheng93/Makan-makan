import { describe, expect, it, vi } from "vitest";
import {
  clearManagementSession,
  getManagementToken,
  isManagementAuthenticated,
  saveManagementSession,
} from "./auth";

describe("management portal auth session", () => {
  it("saves and returns an unexpired exchanged management token", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_780_000_000_000);

    saveManagementSession({
      token: "management-jwt",
      expiresAt: 1_780_000_600,
    });

    expect(localStorage.getItem("management_token")).toBe("management-jwt");
    expect(localStorage.getItem("management_token_expires_at")).toBe(
      "1780000600",
    );
    expect(getManagementToken()).toBe("management-jwt");
    expect(isManagementAuthenticated()).toBe(true);
  });

  it("clears expired exchanged tokens", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_780_001_000_000);
    localStorage.setItem("management_token", "expired-jwt");
    localStorage.setItem("management_token_expires_at", "1780000000");

    expect(getManagementToken()).toBeNull();
    expect(isManagementAuthenticated()).toBe(false);
    expect(localStorage.getItem("management_token")).toBeNull();
    expect(localStorage.getItem("management_token_expires_at")).toBeNull();
  });

  it("keeps legacy manually supplied tokens without expiry metadata", () => {
    localStorage.setItem("management_token", "manual-token");

    expect(getManagementToken()).toBe("manual-token");
    expect(isManagementAuthenticated()).toBe(true);
  });

  it("clears all management auth state", () => {
    localStorage.setItem("management_token", "management-jwt");
    localStorage.setItem("management_token_expires_at", "1780000600");

    clearManagementSession();

    expect(localStorage.getItem("management_token")).toBeNull();
    expect(localStorage.getItem("management_token_expires_at")).toBeNull();
  });
});
