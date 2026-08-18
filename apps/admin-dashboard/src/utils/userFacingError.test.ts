import { describe, expect, it } from "vitest";
import { resolveAdminUserFacingError } from "./userFacingError";

const t = (key: string) => `translated:${key}`;

describe("resolveAdminUserFacingError", () => {
  it("uses localized status copy instead of an API error message", () => {
    expect(
      resolveAdminUserFacingError(
        {
          response: {
            status: 500,
            data: { error: { message: "English server prose" } },
          },
        },
        t,
        "menu.errors.saveFailed",
      ),
    ).toBe("translated:errorPresentation.serviceUnavailable");
  });

  it("keeps the caller's localized fallback for malformed errors", () => {
    expect(resolveAdminUserFacingError(new Error("server prose"), t, "x")).toBe(
      "translated:x",
    );
  });
});
