import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  UNLAUNCHED_FEATURES,
  disabledFeatures,
  isFeatureEnabled,
  type UnlaunchedFeatureKey,
} from "./feature-adoption";

const apiRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const appFactory = readFileSync(resolve(apiRoot, "src/app-factory.ts"), "utf8");

const KEYS = Object.keys(UNLAUNCHED_FEATURES) as UnlaunchedFeatureKey[];

describe("feature adoption registry", () => {
  // The registry only helps if it describes routes that exist. A renamed or
  // unmounted prefix would leave a flag that reads authoritative and gates
  // nothing.
  it.each(KEYS)("gates %s at the prefix it declares", (key) => {
    const { prefix } = UNLAUNCHED_FEATURES[key];

    expect(appFactory).toContain(
      `apiV1.use("${prefix}/*", featureGate("${key}"));`,
    );
    expect(appFactory).toContain(`apiV1.route("${prefix}"`);
  });

  it("has a distinct flag and prefix per feature", () => {
    const flags = KEYS.map((key) => UNLAUNCHED_FEATURES[key].flag);
    const prefixes = KEYS.map((key) => UNLAUNCHED_FEATURES[key].prefix);

    expect(new Set(flags).size).toBe(flags.length);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });

  it("records what production showed for every feature", () => {
    for (const key of KEYS) {
      // An entry without evidence is an assertion nobody can check later.
      expect(UNLAUNCHED_FEATURES[key].adoption.length).toBeGreaterThan(40);
    }
  });
});

describe("isFeatureEnabled", () => {
  it("falls back to the declared default when the flag is unset", () => {
    for (const key of KEYS) {
      expect(isFeatureEnabled({}, key)).toBe(
        UNLAUNCHED_FEATURES[key].enabledByDefault,
      );
      expect(isFeatureEnabled(undefined, key)).toBe(
        UNLAUNCHED_FEATURES[key].enabledByDefault,
      );
    }
  });

  it("lets an explicit value override the default in both directions", () => {
    expect(
      isFeatureEnabled(
        { STORED_VALUE_CREDITS_ENABLED: "true" },
        "storedValueCredits",
      ),
    ).toBe(true);
    expect(isFeatureEnabled({ WEB_PUSH_ENABLED: "false" }, "webPush")).toBe(
      false,
    );
  });

  // Guessing at a typo would silently switch a money path on or off.
  it("ignores values that are neither true nor false", () => {
    for (const value of ["1", "yes", "TRUE", "", "on"]) {
      expect(
        isFeatureEnabled(
          { STORED_VALUE_CREDITS_ENABLED: value },
          "storedValueCredits",
        ),
      ).toBe(UNLAUNCHED_FEATURES.storedValueCredits.enabledByDefault);
    }
  });

  // Money code that has never settled a real transaction is not reachable.
  it("keeps stored-value credits off unless asked for", () => {
    expect(UNLAUNCHED_FEATURES.storedValueCredits.enabledByDefault).toBe(false);
    expect(isFeatureEnabled({}, "storedValueCredits")).toBe(false);
  });

  // These three still have working UI behind them, so switching them off is a
  // product decision rather than a cleanup.
  it.each(["tenantBackups", "marketCheckouts", "webPush"] as const)(
    "leaves %s answering until someone turns it off",
    (key) => {
      expect(UNLAUNCHED_FEATURES[key].enabledByDefault).toBe(true);
      expect(isFeatureEnabled({}, key)).toBe(true);
    },
  );
});

describe("disabledFeatures", () => {
  it("reports only what is actually switched off", () => {
    expect(disabledFeatures({})).toEqual([
      {
        feature: "storedValueCredits",
        flag: "STORED_VALUE_CREDITS_ENABLED",
        prefix: "/credits",
      },
    ]);
  });

  it("reflects flags that were flipped", () => {
    const reported = disabledFeatures({
      STORED_VALUE_CREDITS_ENABLED: "true",
      WEB_PUSH_ENABLED: "false",
    });

    expect(reported).toEqual([
      { feature: "webPush", flag: "WEB_PUSH_ENABLED", prefix: "/push" },
    ]);
  });
});
