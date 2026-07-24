import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { checkProductionConfig } =
  require("../../scripts/check-production-config.cjs") as {
    checkProductionConfig: (options?: {
      root?: string;
      env?: Record<string, string | undefined>;
      requireDeploymentSecrets?: boolean;
      requireImagesAccountHash?: boolean;
    }) => { violations: Array<{ file: string; text: string }> };
  };

describe("check-production-config", () => {
  it("accepts the checked-in production runtime URL configuration", () => {
    const result = checkProductionConfig({
      root: process.cwd(),
      env: {
        SLACK_WEBHOOK_URL: "https://hooks.slack.test/services/prod",
      },
      // Deploy-only check: the checked-in Images account hash placeholder is
      // legitimate repo state until an operator fills it (issue #56).
      requireImagesAccountHash: false,
    });

    expect(result.violations).toEqual([]);
  });

  it("does not require Slack alerting during pilot production deploys", () => {
    const result = checkProductionConfig({
      root: process.cwd(),
      env: {},
      requireImagesAccountHash: false,
    });

    expect(result.violations).toEqual([]);
  });

  it("can skip deployment secret checks for non-deploy CI gates", () => {
    const result = checkProductionConfig({
      root: process.cwd(),
      env: {},
      requireDeploymentSecrets: false,
      requireImagesAccountHash: false,
    });

    expect(result.violations).toEqual([]);
  });

  it("blocks deploys while the Images account hash placeholder is unfilled", () => {
    // Default (deploy) mode keeps the hash gate on; the checked-in
    // wrangler.toml intentionally carries a REPLACE_ME placeholder, so the
    // deploy-context run must report exactly that violation.
    const result = checkProductionConfig({
      root: process.cwd(),
      env: {
        SLACK_WEBHOOK_URL: "https://hooks.slack.test/services/prod",
      },
    });

    const hashViolations = result.violations.filter((violation) =>
      violation.text.includes("CLOUDFLARE_IMAGES_ACCOUNT_HASH"),
    );
    expect(hashViolations).toHaveLength(1);
    expect(hashViolations[0].file).toBe("apps/image-processor/wrangler.toml");
    // And nothing else fails: the hash gate must be the only open item.
    expect(result.violations).toEqual(hashViolations);
  });

  it("skips the hash gate via the env toggle used by CI", () => {
    const result = checkProductionConfig({
      root: process.cwd(),
      env: {
        CHECK_PRODUCTION_CONFIG_REQUIRE_IMAGES_ACCOUNT_HASH: "false",
        SLACK_WEBHOOK_URL: "https://hooks.slack.test/services/prod",
      },
    });

    expect(result.violations).toEqual([]);
  });
});
