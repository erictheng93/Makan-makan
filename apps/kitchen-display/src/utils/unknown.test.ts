import { describe, expect, it } from "vitest";
import { describeErrorForLog, getApiErrorStatus, isRecord } from "./unknown";

describe("kitchen unknown-narrowing helpers", () => {
  it("keeps the server's sentence available to the console", () => {
    expect(
      describeErrorForLog(
        {
          response: {
            status: 403,
            data: {
              error: { code: "FORBIDDEN", message: "Restaurant access denied" },
            },
          },
        },
        "獲取訂單失敗",
      ),
    ).toBe("Restaurant access denied");
  });

  it("uses the caller's text only when the error carries none", () => {
    expect(describeErrorForLog({}, "獲取訂單失敗")).toBe("獲取訂單失敗");
  });

  it("reads the status off an axios-shaped error", () => {
    expect(getApiErrorStatus({ response: { status: 409 } })).toBe(409);
    expect(getApiErrorStatus(new Error("boom"))).toBeUndefined();
  });

  it("narrows objects and rejects primitives", () => {
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord("x")).toBe(false);
  });
});
