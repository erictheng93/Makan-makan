import { describe, expect, it } from "vitest";
import { resolveKitchenLoginError } from "./login-error";

describe("resolveKitchenLoginError", () => {
  it.each([
    ["INVALID_CREDENTIALS", "login.invalidCredentials"],
    ["ACCOUNT_LOCKED", "login.accountLocked"],
  ])("maps %s to its localized login message", (code, key) => {
    const translate = (translationKey: string) =>
      `translated:${translationKey}`;

    expect(
      resolveKitchenLoginError(
        { response: { status: 401, data: { error: { code } } } },
        translate,
      ),
    ).toBe(`translated:${key}`);
  });

  it("does not display an unknown server message", () => {
    const translate = (key: string) => `translated:${key}`;

    expect(
      resolveKitchenLoginError(
        {
          response: {
            status: 401,
            data: { error: { message: "Invalid username or password" } },
          },
        },
        translate,
      ),
    ).toBe("translated:errorPresentation.sessionExpired");
  });
});
