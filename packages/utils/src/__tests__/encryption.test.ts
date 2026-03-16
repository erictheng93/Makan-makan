import { describe, it, expect, vi } from "vitest";
import { encrypt, decrypt } from "../encryption";

const TEST_KEY = "test-encryption-key-for-testing-only-32chars";

describe("encryption", () => {
  describe("encrypt/decrypt roundtrip", () => {
    it("should encrypt and decrypt a string", async () => {
      const plaintext = "my-secret-api-key-12345";
      const encrypted = await encrypt(plaintext, TEST_KEY);
      const decrypted = await decrypt(encrypted, TEST_KEY);
      expect(decrypted).toBe(plaintext);
    });

    it("should produce different ciphertext each time (random IV)", async () => {
      const plaintext = "same-input";
      const encrypted1 = await encrypt(plaintext, TEST_KEY);
      const encrypted2 = await encrypt(plaintext, TEST_KEY);
      expect(encrypted1).not.toBe(encrypted2);
    });

    it("should handle empty string", async () => {
      const encrypted = await encrypt("", TEST_KEY);
      const decrypted = await decrypt(encrypted, TEST_KEY);
      expect(decrypted).toBe("");
    });

    it("should handle unicode content", async () => {
      const plaintext = "密鑰 🔐 キー";
      const encrypted = await encrypt(plaintext, TEST_KEY);
      const decrypted = await decrypt(encrypted, TEST_KEY);
      expect(decrypted).toBe(plaintext);
    });

    it("should handle long content", async () => {
      const plaintext = "a".repeat(10000);
      const encrypted = await encrypt(plaintext, TEST_KEY);
      const decrypted = await decrypt(encrypted, TEST_KEY);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe("output format", () => {
    it("should produce format with colon separator", async () => {
      const encrypted = await encrypt("test", TEST_KEY);
      expect(encrypted).toContain(":");
      const parts = encrypted.split(":");
      expect(parts).toHaveLength(2);
    });
  });

  describe("legacy base64 fallback", () => {
    it("should decrypt legacy base64 encoded data", async () => {
      const original = "my-legacy-token";
      const legacyEncrypted = btoa(original);
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const decrypted = await decrypt(legacyEncrypted, TEST_KEY);
      expect(decrypted).toBe(original);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("legacy base64"),
      );
      consoleSpy.mockRestore();
    });
  });

  describe("wrong key", () => {
    it("should fail to decrypt with wrong key", async () => {
      const encrypted = await encrypt("secret", TEST_KEY);
      await expect(
        decrypt(encrypted, "wrong-key-that-is-different-32chars"),
      ).rejects.toThrow();
    });
  });

  describe("custom salt isolation", () => {
    it("should produce different ciphertext with different salts", async () => {
      const plaintext = "same-data";
      const enc1 = await encrypt(plaintext, TEST_KEY, "salt-a");
      const enc2 = await encrypt(plaintext, TEST_KEY, "salt-b");
      // Different salts → different derived keys → cannot cross-decrypt
      await expect(decrypt(enc1, TEST_KEY, "salt-b")).rejects.toThrow();
      await expect(decrypt(enc2, TEST_KEY, "salt-a")).rejects.toThrow();
    });

    it("should roundtrip with custom salt", async () => {
      const plaintext = "custom-salt-data";
      const salt = "my-custom-salt";
      const encrypted = await encrypt(plaintext, TEST_KEY, salt);
      const decrypted = await decrypt(encrypted, TEST_KEY, salt);
      expect(decrypted).toBe(plaintext);
    });
  });
});
