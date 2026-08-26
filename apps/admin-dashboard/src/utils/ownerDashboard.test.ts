import { describe, expect, it } from "vitest";
import { hasRequestFailure } from "./ownerDashboard";

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
