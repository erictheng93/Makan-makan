/**
 * Guest Auth Middleware Tests
 * 訪客令牌認證中間件測試
 */

import { describe, it, expect } from "vitest";
import { generateGuestToken } from "../../../middleware/guestAuth";

describe("Guest Auth Middleware", () => {
  describe("generateGuestToken", () => {
    it("should generate a token with gt_ prefix", () => {
      const token = generateGuestToken();
      expect(token).toMatch(/^gt_[a-f0-9]{64}$/);
    });

    it("should generate unique tokens", () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateGuestToken());
      }
      expect(tokens.size).toBe(100);
    });

    it("should generate tokens of consistent length", () => {
      const token = generateGuestToken();
      // "gt_" (3) + 64 hex chars = 67 total
      expect(token.length).toBe(67);
    });
  });
});
