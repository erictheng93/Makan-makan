import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertStrongEncryptionKey,
  decrypt,
  encrypt,
  MIN_ENCRYPTION_KEY_LENGTH,
  resetEncryptionKeyCache,
  type EncryptionOptions,
} from "./encryption";

const STRONG_KEY = "k".repeat(MIN_ENCRYPTION_KEY_LENGTH);

/**
 * `requireStrongKey` has no default in the production API on purpose, so tests
 * state it too. `lenient()` is the shape every non-production caller uses.
 */
function lenient(
  overrides: Partial<EncryptionOptions> = {},
): EncryptionOptions {
  return { requireStrongKey: false, ...overrides };
}

function strict(overrides: Partial<EncryptionOptions> = {}): EncryptionOptions {
  return { requireStrongKey: true, ...overrides };
}

describe("encrypt/decrypt", () => {
  it("round-trips a payload through the iv:ciphertext framing", async () => {
    const ciphertext = await encrypt("sk-secret", STRONG_KEY, lenient());

    expect(ciphertext).toContain(":");
    expect(ciphertext).not.toContain("sk-secret");
    await expect(decrypt(ciphertext, STRONG_KEY, lenient())).resolves.toBe(
      "sk-secret",
    );
  });

  it("produces a different ciphertext per call for the same plaintext", async () => {
    const first = await encrypt("sk-secret", STRONG_KEY, lenient());
    const second = await encrypt("sk-secret", STRONG_KEY, lenient());

    expect(first).not.toBe(second);
  });

  it("separates domains by salt so one caller cannot read another's data", async () => {
    const ciphertext = await encrypt(
      "sk-secret",
      STRONG_KEY,
      lenient({ salt: "salt-a" }),
    );

    await expect(
      decrypt(ciphertext, STRONG_KEY, lenient({ salt: "salt-b" })),
    ).rejects.toThrow();
    await expect(
      decrypt(ciphertext, STRONG_KEY, lenient({ salt: "salt-a" })),
    ).resolves.toBe("sk-secret");
  });

  it("rejects a malformed iv:ciphertext pair", async () => {
    await expect(decrypt("abc:", STRONG_KEY, lenient())).rejects.toThrow(
      "Invalid encrypted data format",
    );
  });

  it("falls back to base64 for legacy separator-less values", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(
      decrypt(btoa("sk-legacy"), STRONG_KEY, lenient()),
    ).resolves.toBe("sk-legacy");
    expect(warn).toHaveBeenCalledOnce();

    warn.mockRestore();
  });
});

describe("weak-key guard", () => {
  // The whole point of issue #300: an absent ENCRYPTION_KEY used to derive a
  // valid AES-256 key from "" over a salt that is a public constant in this
  // file. These assert the refusal, and that it is opt-in.
  const unusable: Array<[string, string | undefined]> = [
    ["undefined", undefined],
    ["empty", ""],
    ["shorter than the minimum", "k".repeat(MIN_ENCRYPTION_KEY_LENGTH - 1)],
  ];

  it.each(unusable)("assertStrongEncryptionKey rejects %s keys", (_, key) => {
    expect(() => assertStrongEncryptionKey(key)).toThrow(/ENCRYPTION_KEY/);
    expect(() => assertStrongEncryptionKey(key)).toThrow(
      /refusing to encrypt or decrypt/,
    );
  });

  it("accepts a key at the minimum length", () => {
    expect(() => assertStrongEncryptionKey(STRONG_KEY)).not.toThrow();
  });

  it.each(unusable)(
    "encrypt refuses a %s key when requireStrongKey is set",
    async (_, key) => {
      await expect(
        encrypt("sk-secret", key as string, strict()),
      ).rejects.toThrow(/ENCRYPTION_KEY/);
    },
  );

  it.each(unusable)(
    "decrypt refuses a %s key when requireStrongKey is set",
    async (_, key) => {
      await expect(
        decrypt("aXY=:Y3Q=", key as string, strict()),
      ).rejects.toThrow(/ENCRYPTION_KEY/);
    },
  );

  it("refuses before the legacy base64 branch can hand a secret back", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(decrypt(btoa("sk-legacy"), "", strict())).rejects.toThrow(
      /ENCRYPTION_KEY/,
    );
    expect(warn).not.toHaveBeenCalled();

    warn.mockRestore();
  });

  it("still derives a key from a weak secret when requireStrongKey is off", async () => {
    // Local dev and the existing fixtures depend on this: apps/api/.dev.vars
    // ships no ENCRYPTION_KEY at all.
    const ciphertext = await encrypt("sk-secret", "", lenient());

    await expect(decrypt(ciphertext, "", lenient())).resolves.toBe("sk-secret");
  });

  it("round-trips a strong key with the guard on", async () => {
    const ciphertext = await encrypt("sk-secret", STRONG_KEY, strict());

    await expect(decrypt(ciphertext, STRONG_KEY, strict())).resolves.toBe(
      "sk-secret",
    );
  });
});

describe("derived-key memo", () => {
  beforeEach(() => {
    resetEncryptionKeyCache();
  });

  it("derives each (key, salt) pair once and reuses it", async () => {
    const deriveKey = vi.spyOn(crypto.subtle, "deriveKey");

    await encrypt("a", STRONG_KEY, lenient());
    await encrypt("b", STRONG_KEY, lenient());
    await decrypt(
      await encrypt("c", STRONG_KEY, lenient()),
      STRONG_KEY,
      lenient(),
    );

    expect(deriveKey).toHaveBeenCalledOnce();

    deriveKey.mockRestore();
  });

  it("does not reuse a key across salts or secrets", async () => {
    const deriveKey = vi.spyOn(crypto.subtle, "deriveKey");

    await encrypt("a", STRONG_KEY, lenient({ salt: "salt-a" }));
    await encrypt("a", STRONG_KEY, lenient({ salt: "salt-b" }));
    await encrypt("a", "j".repeat(MIN_ENCRYPTION_KEY_LENGTH), lenient());

    expect(deriveKey).toHaveBeenCalledTimes(3);

    deriveKey.mockRestore();
  });

  it("re-derives after the cache is reset", async () => {
    const deriveKey = vi.spyOn(crypto.subtle, "deriveKey");

    await encrypt("a", STRONG_KEY, lenient());
    resetEncryptionKeyCache();
    await encrypt("a", STRONG_KEY, lenient());

    expect(deriveKey).toHaveBeenCalledTimes(2);

    deriveKey.mockRestore();
  });

  it("still refuses a weak key when its derivation is already cached", async () => {
    // A cache hit must not smuggle a call past the guard: warm the entry for
    // the empty key with a lenient call, then demand strictness.
    await encrypt("a", "", lenient());

    await expect(encrypt("a", "", strict())).rejects.toThrow(/ENCRYPTION_KEY/);
    await expect(decrypt("aXY=:Y3Q=", "", strict())).rejects.toThrow(
      /ENCRYPTION_KEY/,
    );
  });

  it("does not cache a failed derivation", async () => {
    const deriveKey = vi
      .spyOn(crypto.subtle, "deriveKey")
      .mockRejectedValueOnce(new Error("kdf unavailable"));

    await expect(encrypt("a", STRONG_KEY, lenient())).rejects.toThrow(
      "kdf unavailable",
    );
    await expect(encrypt("a", STRONG_KEY, lenient())).resolves.toContain(":");

    expect(deriveKey).toHaveBeenCalledTimes(2);

    deriveKey.mockRestore();
  });
});
