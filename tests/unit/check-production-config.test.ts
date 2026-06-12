import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { checkProductionConfig } =
  require("../../scripts/check-production-config.cjs") as {
    checkProductionConfig: (options?: {
      root?: string;
      env?: Record<string, string | undefined>;
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

  it("blocks production deploys when required alerting secrets are absent", () => {
    const result = checkProductionConfig({
      root: process.cwd(),
      env: {},
    });

    expect(result.violations).toContainEqual(
      expect.objectContaining({
        file: "apps/api/wrangler.toml",
        text: expect.stringContaining(
          "missing deployment secret: SLACK_WEBHOOK_URL",
        ),
      }),
    );
  });
});
