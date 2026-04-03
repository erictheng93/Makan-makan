import { describe, it, expect } from "vitest";
import {
  signQRPayload,
  verifyQRSignature,
  buildSignedQRUrl,
  parseSignedQRUrl,
  type QRSigningParams,
} from "../qr-signing";

const TEST_KEY = "test-signing-key-for-hmac-sha256-testing";
const TEST_KEY_ALT = "different-signing-key-for-testing-only";

const baseParams: QRSigningParams = {
  type: "table",
  restaurantId: "019469a0-0001-7000-8000-000000000001",
  identifier: "A1",
  version: 1,
};

describe("qr-signing", () => {
  describe("signQRPayload", () => {
    it("should produce a 16-char hex string", async () => {
      const sig = await signQRPayload(baseParams, TEST_KEY);
      expect(sig).toMatch(/^[0-9a-f]{16}$/);
    });

    it("should be deterministic — same params + same key produce same signature", async () => {
      const sig1 = await signQRPayload(baseParams, TEST_KEY);
      const sig2 = await signQRPayload(baseParams, TEST_KEY);
      expect(sig1).toBe(sig2);
    });

    it("should produce different signatures for different keys", async () => {
      const sig1 = await signQRPayload(baseParams, TEST_KEY);
      const sig2 = await signQRPayload(baseParams, TEST_KEY_ALT);
      expect(sig1).not.toBe(sig2);
    });

    it("should produce different signatures for different params", async () => {
      const sig1 = await signQRPayload(baseParams, TEST_KEY);
      const sig2 = await signQRPayload(
        { ...baseParams, identifier: "B2" },
        TEST_KEY,
      );
      expect(sig1).not.toBe(sig2);
    });

    it("should differ when type changes", async () => {
      const sigTable = await signQRPayload(baseParams, TEST_KEY);
      const sigSeat = await signQRPayload(
        { ...baseParams, type: "seat" },
        TEST_KEY,
      );
      expect(sigTable).not.toBe(sigSeat);
    });

    it("should differ when version changes", async () => {
      const sigV1 = await signQRPayload(baseParams, TEST_KEY);
      const sigV2 = await signQRPayload(
        { ...baseParams, version: 2 },
        TEST_KEY,
      );
      expect(sigV1).not.toBe(sigV2);
    });

    it("should differ when restaurantId changes", async () => {
      const sig1 = await signQRPayload(baseParams, TEST_KEY);
      const sig2 = await signQRPayload(
        {
          ...baseParams,
          restaurantId: "019469a0-0002-7000-8000-000000000002",
        },
        TEST_KEY,
      );
      expect(sig1).not.toBe(sig2);
    });
  });

  describe("verifyQRSignature", () => {
    it("should return true for valid signature", async () => {
      const sig = await signQRPayload(baseParams, TEST_KEY);
      const valid = await verifyQRSignature(baseParams, sig, TEST_KEY);
      expect(valid).toBe(true);
    });

    it("should return false for tampered signature", async () => {
      const sig = await signQRPayload(baseParams, TEST_KEY);
      const tampered = sig.slice(0, -1) + (sig.endsWith("0") ? "1" : "0");
      const valid = await verifyQRSignature(baseParams, tampered, TEST_KEY);
      expect(valid).toBe(false);
    });

    it("should return false for wrong key", async () => {
      const sig = await signQRPayload(baseParams, TEST_KEY);
      const valid = await verifyQRSignature(baseParams, sig, TEST_KEY_ALT);
      expect(valid).toBe(false);
    });

    it("should return false for modified params", async () => {
      const sig = await signQRPayload(baseParams, TEST_KEY);
      const valid = await verifyQRSignature(
        { ...baseParams, identifier: "TAMPERED" },
        sig,
        TEST_KEY,
      );
      expect(valid).toBe(false);
    });

    it("should return false for different-length signature", async () => {
      const valid = await verifyQRSignature(baseParams, "short", TEST_KEY);
      expect(valid).toBe(false);
    });

    it("should return false for empty signature", async () => {
      const valid = await verifyQRSignature(baseParams, "", TEST_KEY);
      expect(valid).toBe(false);
    });
  });

  describe("buildSignedQRUrl", () => {
    it("should produce a valid URL with all query params", async () => {
      const urlStr = await buildSignedQRUrl(
        "https://app.makanmakan.com",
        baseParams,
        TEST_KEY,
      );
      const url = new URL(urlStr);

      expect(url.pathname).toBe("/order");
      expect(url.searchParams.get("t")).toBe("table");
      expect(url.searchParams.get("r")).toBe(baseParams.restaurantId);
      expect(url.searchParams.get("n")).toBe("A1");
      expect(url.searchParams.get("v")).toBe("1");
      expect(url.searchParams.get("ts")).toMatch(/^\d+$/);
      expect(url.searchParams.get("sig")).toMatch(/^[0-9a-f]{16}$/);
    });

    it("should produce a verifiable signature in the URL", async () => {
      const urlStr = await buildSignedQRUrl(
        "https://app.makanmakan.com",
        baseParams,
        TEST_KEY,
      );
      const parsed = parseSignedQRUrl(urlStr);
      expect(parsed).not.toBeNull();

      const valid = await verifyQRSignature(
        {
          type: parsed!.type,
          restaurantId: parsed!.restaurantId,
          identifier: parsed!.identifier,
          version: parsed!.version,
        },
        parsed!.signature,
        TEST_KEY,
      );
      expect(valid).toBe(true);
    });

    it("should work with seat type", async () => {
      const seatParams: QRSigningParams = {
        ...baseParams,
        type: "seat",
        identifier: "01",
      };
      const urlStr = await buildSignedQRUrl(
        "https://app.makanmakan.com",
        seatParams,
        TEST_KEY,
      );
      const url = new URL(urlStr);
      expect(url.searchParams.get("t")).toBe("seat");
      expect(url.searchParams.get("n")).toBe("01");
    });
  });

  describe("parseSignedQRUrl", () => {
    it("should roundtrip with buildSignedQRUrl", async () => {
      const urlStr = await buildSignedQRUrl(
        "https://app.makanmakan.com",
        baseParams,
        TEST_KEY,
      );
      const parsed = parseSignedQRUrl(urlStr);

      expect(parsed).not.toBeNull();
      expect(parsed!.type).toBe("table");
      expect(parsed!.restaurantId).toBe(baseParams.restaurantId);
      expect(parsed!.identifier).toBe("A1");
      expect(parsed!.version).toBe(1);
      expect(parsed!.signature).toMatch(/^[0-9a-f]{16}$/);
      expect(parsed!.timestamp).toBeGreaterThan(0);
    });

    it("should return null for missing type param", () => {
      const result = parseSignedQRUrl(
        "https://app.makanmakan.com/order?r=uuid&n=A1&v=1&sig=abc123",
      );
      expect(result).toBeNull();
    });

    it("should return null for invalid type param", () => {
      const result = parseSignedQRUrl(
        "https://app.makanmakan.com/order?t=invalid&r=uuid&n=A1&v=1&sig=abc123",
      );
      expect(result).toBeNull();
    });

    it("should return null for missing signature", () => {
      const result = parseSignedQRUrl(
        "https://app.makanmakan.com/order?t=table&r=uuid&n=A1&v=1",
      );
      expect(result).toBeNull();
    });

    it("should return null for missing restaurant ID", () => {
      const result = parseSignedQRUrl(
        "https://app.makanmakan.com/order?t=table&n=A1&v=1&sig=abc123",
      );
      expect(result).toBeNull();
    });

    it("should return null for malformed URL", () => {
      const result = parseSignedQRUrl("not-a-url");
      expect(result).toBeNull();
    });

    it("should default timestamp to 0 when missing", () => {
      const result = parseSignedQRUrl(
        "https://app.makanmakan.com/order?t=table&r=uuid&n=A1&v=1&sig=a1b2c3d4e5f6a7b8",
      );
      expect(result).not.toBeNull();
      expect(result!.timestamp).toBe(0);
    });
  });
});
