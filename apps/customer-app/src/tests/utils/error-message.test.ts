import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getApiErrorMessage, getErrorMessage } from "@/utils/unknown";

describe("display error message helpers", () => {
  it("never exposes an untrusted Error message to the diner", () => {
    expect(
      getErrorMessage(
        new Error("Internal database hostname: db-prod-1"),
        "請稍後再試",
      ),
    ).toBe("請稍後再試");
  });

  it("never exposes legacy or enveloped server error messages", () => {
    expect(
      getApiErrorMessage(
        {
          response: {
            data: {
              error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "Unhandled provider exception",
              },
            },
          },
        },
        "請稍後再試",
      ),
    ).toBe("請稍後再試");
  });

  it("keeps customer-facing error paths free of raw Error.message rendering", () => {
    const appRoot = process.cwd().endsWith("customer-app")
      ? process.cwd()
      : resolve(process.cwd(), "apps/customer-app");
    const files = [
      "src/utils/unknown.ts",
      "src/services/api.ts",
      "src/services/signedQrApi.ts",
      "src/stores/auth.ts",
      "src/stores/app.ts",
      "src/views/QRScanView.vue",
      "src/views/SignedOrderEntryView.vue",
      "src/views/VerifyEmailView.vue",
      "src/views/ForgotPasswordView.vue",
      "src/views/ResetPasswordView.vue",
      "src/views/GroupOrderJoinView.vue",
    ];

    for (const file of files) {
      const source = readFileSync(resolve(appRoot, file), "utf8");
      expect(source, file).not.toMatch(
        /(?:err|error) instanceof Error[^\n]*\.message|(?:err|error)\.message/,
      );
    }
  });
});
