import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { checkProductionConfig } =
  require("../../scripts/check-production-config.cjs") as {
    checkProductionConfig: (options?: {
      root?: string;
      env?: Record<string, string | undefined>;
      requireDeploymentSecrets?: boolean;
    }) => { violations: Array<{ file: string; text: string }> };
  };

describe("check-production-config", () => {
  it("accepts the checked-in production runtime URL configuration", () => {
    const result = checkProductionConfig({
      root: process.cwd(),
      env: {
        SLACK_WEBHOOK_URL: "https://hooks.slack.test/services/prod",
      },
    });

    expect(result.violations).toEqual([]);
  });

  it("does not require Slack alerting during pilot production deploys", () => {
    const result = checkProductionConfig({
      root: process.cwd(),
      env: {},
    });

    expect(result.violations).toEqual([]);
  });

  it("can skip deployment secret checks for non-deploy CI gates", () => {
    const result = checkProductionConfig({
      root: process.cwd(),
      env: {},
      requireDeploymentSecrets: false,
    });

    expect(result.violations).toEqual([]);
  });
});
