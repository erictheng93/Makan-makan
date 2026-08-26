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
});
