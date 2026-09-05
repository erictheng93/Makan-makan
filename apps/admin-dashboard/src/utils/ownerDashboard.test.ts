import { describe, expect, it } from "vitest";
import {
  hasRequestFailure,
  staffPresence,
  toOnShiftIds,
} from "./ownerDashboard";

describe("hasRequestFailure", () => {
  it("reports a partial dashboard request failure", () => {
    expect(
      hasRequestFailure([
        { status: "fulfilled", value: {} },
        { status: "rejected", reason: new Error("orders unavailable") },
        { status: "fulfilled", value: {} },
      ]),
    ).toBe(true);
  });

  it("does not report an error when every request succeeds", () => {
    expect(
      hasRequestFailure([
        { status: "fulfilled", value: {} },
        { status: "fulfilled", value: {} },
      ]),
    ).toBe(false);
  });

  it.each(["MODULE_NOT_ENABLED", "SUBSCRIPTION_NOT_FOUND"])(
    "treats a %s rejection as a plan restriction, not a failure",
    (code) => {
      expect(
        hasRequestFailure([
          { status: "fulfilled", value: {} },
          {
            status: "rejected",
            reason: { response: { data: { error: { code } } } },
          },
        ]),
      ).toBe(false);
    },
  );

  it("still reports a plan-restricted rejection alongside a real one", () => {
    expect(
      hasRequestFailure([
        {
          status: "rejected",
          reason: {
            response: { data: { error: { code: "MODULE_NOT_ENABLED" } } },
          },
        },
        { status: "rejected", reason: new Error("orders unavailable") },
      ]),
    ).toBe(true);
  });
});

describe("toOnShiftIds", () => {
  it("keys on the employee id as a string", () => {
    // employee_schedules.employee_id is TEXT (a users.id UUID), while the
    // admin-dashboard user types still declare `id: number`. Comparing the two
    // without coercion is how a set lookup silently misses every row.
    expect(toOnShiftIds([{ employeeId: "user-1" }, { employeeId: 2 }])).toEqual(
      new Set(["user-1", "2"]),
    );
  });

  it("yields an empty set when the request produced nothing", () => {
    expect(toOnShiftIds(undefined).size).toBe(0);
    expect(toOnShiftIds(null).size).toBe(0);
    expect(toOnShiftIds([]).size).toBe(0);
  });
});

describe("staffPresence", () => {
  it("reports someone on shift as online", () => {
    expect(staffPresence("user-1", new Set(["user-1"]))).toBe("online");
    expect(staffPresence(2, new Set(["2"]))).toBe("online");
  });

  it("reports someone not on shift as offline", () => {
    expect(staffPresence("user-9", new Set(["user-1"]))).toBe("offline");
  });

  it("does not treat an enabled account as presence", () => {
    // The old rule read `user.status === "active"`, a field GET /users never
    // sends. Its replacement must not fall back to account state either: an
    // enabled employee who has not clocked in is offline, not online (#308).
    const enabledButNotClockedIn = { id: "user-3", isActive: true };
    expect(staffPresence(enabledButNotClockedIn.id, new Set())).toBe("offline");
  });
});
