import { describe, expect, it } from "vitest";
import { mapApiUser } from "./api-user";

describe("mapApiUser", () => {
  it("treats an omitted isActive flag as active", () => {
    expect(
      mapApiUser({
        id: "019469a1-0001-7000-8000-000000000001",
        username: "ada",
        role: 1,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toMatchObject({ status: "active", isActive: true });
  });

  it("preserves an explicitly inactive user", () => {
    expect(
      mapApiUser({
        id: "019469a1-0002-7000-8000-000000000002",
        username: "grace",
        role: 2,
        isActive: false,
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toMatchObject({ status: "inactive", isActive: false });
  });
});
