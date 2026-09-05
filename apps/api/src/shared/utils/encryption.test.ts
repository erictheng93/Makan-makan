import { describe, expect, it } from "vitest";
import { MIN_ENCRYPTION_KEY_LENGTH } from "@makanmasak/utils";
import {
  AI_API_KEY_ENCRYPTION_SALT,
  encryptionSettings,
  PLATFORM_CREDENTIALS_ENCRYPTION_SALT,
  type EncryptionEnv,
} from "./encryption";

function buildEnv(overrides: Partial<EncryptionEnv> = {}): EncryptionEnv {
  return {
    NODE_ENV: "test",
    ENCRYPTION_KEY: "k".repeat(MIN_ENCRYPTION_KEY_LENGTH),
    ...overrides,
  } as EncryptionEnv;
}

describe("encryptionSettings", () => {
  it("arms the weak-key guard in production", () => {
    expect(encryptionSettings(buildEnv({ NODE_ENV: "production" }))).toEqual(
      expect.objectContaining({ requireStrongKey: true }),
    );
  });

  // The guard is production-only by design: apps/api/.dev.vars ships no
  // ENCRYPTION_KEY, and the unit fixtures use short placeholders. A blanket
  // guard would break local dev without protecting any real secret.
  it.each(["development", "test", "staging", "", undefined])(
    "leaves the guard off when NODE_ENV is %p",
    (nodeEnv) => {
      expect(
        encryptionSettings(buildEnv({ NODE_ENV: nodeEnv as string })),
      ).toEqual(expect.objectContaining({ requireStrongKey: false }));
    },
  );

  it("passes the configured key through", () => {
    expect(encryptionSettings(buildEnv({ ENCRYPTION_KEY: "secret" }))).toEqual(
      expect.objectContaining({ key: "secret" }),
    );
  });

  it("normalises an absent key to the empty string so the guard sees it", () => {
    // Production has no ENCRYPTION_KEY secret at all, so at runtime the binding
    // is undefined despite `Env` typing it as required.
    expect(
      encryptionSettings(
        buildEnv({ ENCRYPTION_KEY: undefined as unknown as string }),
      ),
    ).toEqual(expect.objectContaining({ key: "" }));
  });
});

describe("domain salts", () => {
  it("keeps the two encryption domains separate", () => {
    expect(AI_API_KEY_ENCRYPTION_SALT).not.toBe(
      PLATFORM_CREDENTIALS_ENCRYPTION_SALT,
    );
  });

  it("keeps the salt that already has ciphertext in the wild", () => {
    // Changing this string makes every stored LLM API key undecryptable.
    expect(AI_API_KEY_ENCRYPTION_SALT).toBe(
      "makanmakan-api-key-encryption-salt",
    );
  });
});
