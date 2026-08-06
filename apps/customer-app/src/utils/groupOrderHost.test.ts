import { describe, expect, it, beforeEach } from "vitest";
import {
  STORAGE_KEY,
  saveHostCredentials,
  readHostCredentials,
  updateHostMemberToken,
  clearHostCredentials,
} from "./groupOrderHost";

describe("groupOrderHost storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips credentials for a group order", () => {
    saveHostCredentials({
      groupOrderId: "go-1",
      memberToken: "s-1",
      recoveryCode: "r-1",
    });

    expect(readHostCredentials("go-1")).toMatchObject({
      groupOrderId: "go-1",
      memberToken: "s-1",
      recoveryCode: "r-1",
    });
  });

  it("keeps the recovery code when only the member token is rotated", () => {
    saveHostCredentials({
      groupOrderId: "go-1",
      memberToken: "s-1",
      recoveryCode: "r-1",
    });

    updateHostMemberToken("go-1", "s-2");

    // Recovery issues a new member token; losing the recovery code at that
    // moment would leave the host unable to recover a second time.
    expect(readHostCredentials("go-1")).toMatchObject({
      memberToken: "s-2",
      recoveryCode: "r-1",
    });
  });

  it("does not return credentials past the TTL", () => {
    saveHostCredentials({
      groupOrderId: "go-1",
      memberToken: "s-1",
      recoveryCode: "r-1",
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    stored["go-1"].savedAt = Date.now() - 25 * 60 * 60 * 1000;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));

    expect(readHostCredentials("go-1")).toBeNull();
  });

  it("isolates group orders from each other", () => {
    saveHostCredentials({
      groupOrderId: "a",
      memberToken: "1",
      recoveryCode: "x",
    });
    saveHostCredentials({
      groupOrderId: "b",
      memberToken: "2",
      recoveryCode: "y",
    });

    clearHostCredentials("a");

    expect(readHostCredentials("a")).toBeNull();
    expect(readHostCredentials("b")).not.toBeNull();
  });

  it("survives unavailable storage without throwing", () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("QuotaExceededError");
    };

    // Safari private mode and a full quota both throw here. The group order
    // still works for this page load; only recovery degrades.
    expect(() =>
      saveHostCredentials({
        groupOrderId: "go-2",
        memberToken: "s",
        recoveryCode: "r",
      }),
    ).not.toThrow();

    Storage.prototype.setItem = original;
  });

  it("survives a corrupted blob without throwing", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");

    expect(() => readHostCredentials("go-1")).not.toThrow();
    expect(readHostCredentials("go-1")).toBeNull();
  });
});
