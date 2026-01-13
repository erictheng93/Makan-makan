/**
 * TokenBlacklistService Unit Tests
 * 測試 Token 黑名單服務的核心功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  TokenBlacklistService,
  type RevokeReason,
} from "../services/TokenBlacklistService";

// Mock ConsoleLogger
vi.mock("../../../core/monitoring", () => ({
  ConsoleLogger: vi.fn(function () {
    return {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };
  }),
}));

describe("TokenBlacklistService", () => {
  let service: TokenBlacklistService;
  let mockKV: {
    get: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
  };

  const testToken =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb29tVHlwZSI6ImN1c3RvbWVyIiwicm9vbUlkIjoicm9vbV8xMjMiLCJyZXN0YXVyYW50SWQiOiJyZXN0XzEiLCJyb2xlIjoiY3VzdG9tZXIiLCJleHAiOjE3MzM0MjQwMDAsImlhdCI6MTczMzQyMzcwMH0.abc123";
  const shortToken = "short-token-123";

  beforeEach(() => {
    mockKV = {
      get: vi.fn(),
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      list: vi.fn(),
    };

    service = new TokenBlacklistService(mockKV as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("revokeToken", () => {
    it("應該成功撤銷 token", async () => {
      const result = await service.revokeToken(testToken, "logout");

      expect(result.success).toBe(true);
      expect(result.tokenId).toBeDefined();
      expect(mockKV.put).toHaveBeenCalledTimes(1);

      // 驗證 put 調用的參數
      const putCall = mockKV.put.mock.calls[0];
      expect(putCall[0]).toContain("token:revoked:");
      expect(JSON.parse(putCall[1])).toMatchObject({
        reason: "logout",
        revokedAt: expect.any(Number),
      });
      expect(putCall[2]).toHaveProperty("expirationTtl", 300); // 5 minutes
    });

    it("應該使用自定義 TTL 撤銷 token", async () => {
      await service.revokeToken(testToken, "security_breach", {
        ttlSeconds: 600,
        revokedBy: "admin_1",
      });

      const putCall = mockKV.put.mock.calls[0];
      expect(putCall[2]).toHaveProperty("expirationTtl", 600);

      const record = JSON.parse(putCall[1]);
      expect(record.revokedBy).toBe("admin_1");
    });

    it("應該記錄撤銷原因", async () => {
      const reasons: RevokeReason[] = [
        "logout",
        "password_change",
        "permission_change",
        "security_breach",
        "admin_action",
        "session_expired",
        "manual",
      ];

      for (const reason of reasons) {
        mockKV.put.mockClear();
        await service.revokeToken(testToken, reason);

        const record = JSON.parse(mockKV.put.mock.calls[0][1]);
        expect(record.reason).toBe(reason);
      }
    });

    it("應該包含 metadata", async () => {
      await service.revokeToken(testToken, "admin_action", {
        metadata: { ipAddress: "192.168.1.1", userAgent: "Test Browser" },
      });

      const record = JSON.parse(mockKV.put.mock.calls[0][1]);
      expect(record.metadata).toEqual({
        ipAddress: "192.168.1.1",
        userAgent: "Test Browser",
      });
    });

    it("應該在 KV 錯誤時拋出異常", async () => {
      mockKV.put.mockRejectedValue(new Error("KV error"));

      await expect(service.revokeToken(testToken, "logout")).rejects.toThrow(
        "KV error",
      );
    });
  });

  describe("isTokenRevoked", () => {
    it("應該返回 true 當 token 在黑名單中", async () => {
      mockKV.get.mockResolvedValue(
        JSON.stringify({
          tokenId: "test",
          revokedAt: Date.now(),
          reason: "logout",
        }),
      );

      const result = await service.isTokenRevoked(testToken);

      expect(result).toBe(true);
      expect(mockKV.get).toHaveBeenCalledTimes(1);
    });

    it("應該返回 false 當 token 不在黑名單中", async () => {
      mockKV.get.mockResolvedValue(null);

      const result = await service.isTokenRevoked(testToken);

      expect(result).toBe(false);
    });

    it("應該在 KV 錯誤時返回 true（安全起見）", async () => {
      mockKV.get.mockRejectedValue(new Error("KV error"));

      const result = await service.isTokenRevoked(testToken);

      expect(result).toBe(true); // 安全起見，返回 true
    });

    it("應該正確處理短 token", async () => {
      mockKV.get.mockResolvedValue(null);

      const result = await service.isTokenRevoked(shortToken);

      expect(result).toBe(false);
      // 短 token 應該直接使用原始值作為 key
      expect(mockKV.get.mock.calls[0][0]).toContain(shortToken);
    });
  });

  describe("getRevokeRecord", () => {
    it("應該返回撤銷記錄", async () => {
      const record = {
        tokenId: "test-id",
        revokedAt: 1733424000000,
        reason: "logout" as const,
        revokedBy: "user_1",
      };
      mockKV.get.mockResolvedValue(JSON.stringify(record));

      const result = await service.getRevokeRecord(testToken);

      expect(result).toEqual(record);
    });

    it("應該返回 null 當記錄不存在", async () => {
      mockKV.get.mockResolvedValue(null);

      const result = await service.getRevokeRecord(testToken);

      expect(result).toBeNull();
    });

    it("應該在 KV 錯誤時返回 null", async () => {
      mockKV.get.mockRejectedValue(new Error("KV error"));

      const result = await service.getRevokeRecord(testToken);

      expect(result).toBeNull();
    });
  });

  describe("revokeUserTokens", () => {
    it("應該撤銷用戶的所有 token", async () => {
      const tokenIds = ["token1", "token2", "token3"];
      mockKV.get.mockResolvedValueOnce(JSON.stringify(tokenIds));

      const result = await service.revokeUserTokens(
        "user_1",
        "password_change",
        "admin_1",
      );

      expect(result.success).toBe(true);
      expect(result.count).toBe(3);
      expect(mockKV.put).toHaveBeenCalledTimes(3);
      expect(mockKV.delete).toHaveBeenCalledTimes(1); // 清除用戶 token 列表
    });

    it("應該返回 0 當用戶沒有 token", async () => {
      mockKV.get.mockResolvedValue(null);

      const result = await service.revokeUserTokens("user_2", "logout");

      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
      expect(mockKV.put).not.toHaveBeenCalled();
    });

    it("應該在 KV 錯誤時拋出異常", async () => {
      mockKV.get.mockRejectedValue(new Error("KV error"));

      await expect(
        service.revokeUserTokens("user_1", "logout"),
      ).rejects.toThrow("KV error");
    });
  });

  describe("trackUserToken", () => {
    it("應該記錄新的用戶 token", async () => {
      mockKV.get.mockResolvedValue(null);

      await service.trackUserToken("user_1", testToken);

      expect(mockKV.put).toHaveBeenCalledTimes(1);
      const putCall = mockKV.put.mock.calls[0];
      expect(putCall[0]).toContain("user:tokens:user_1");

      const tokenIds = JSON.parse(putCall[1]);
      expect(tokenIds).toHaveLength(1);
    });

    it("應該追加到現有的 token 列表", async () => {
      mockKV.get.mockResolvedValue(JSON.stringify(["existing_token"]));

      await service.trackUserToken("user_1", testToken);

      const tokenIds = JSON.parse(mockKV.put.mock.calls[0][1]);
      expect(tokenIds).toHaveLength(2);
      expect(tokenIds[0]).toBe("existing_token");
    });

    it("應該限制最多 10 個 token", async () => {
      const existingTokens = Array.from({ length: 10 }, (_, i) => `token_${i}`);
      mockKV.get.mockResolvedValue(JSON.stringify(existingTokens));

      await service.trackUserToken("user_1", testToken);

      const tokenIds = JSON.parse(mockKV.put.mock.calls[0][1]);
      expect(tokenIds).toHaveLength(10);
      expect(tokenIds[0]).not.toBe("token_0"); // 最舊的被移除
    });

    it("應該在 KV 錯誤時靜默失敗", async () => {
      mockKV.get.mockRejectedValue(new Error("KV error"));

      // 不應該拋出異常
      await expect(
        service.trackUserToken("user_1", testToken),
      ).resolves.toBeUndefined();
    });
  });

  describe("getStats", () => {
    it("應該返回黑名單統計", async () => {
      const keys = [
        { name: "token:revoked:abc", expiration: 123 },
        { name: "token:revoked:def", expiration: 456 },
      ];
      mockKV.list.mockResolvedValue({ keys });
      mockKV.get.mockResolvedValue(
        JSON.stringify({
          tokenId: "test",
          revokedAt: Date.now(),
          reason: "logout",
        }),
      );

      const stats = await service.getStats();

      expect(stats.estimatedCount).toBe(2);
      expect(stats.sampleRecords).toHaveLength(2);
    });

    it("應該在錯誤時返回空統計", async () => {
      mockKV.list.mockRejectedValue(new Error("KV error"));

      const stats = await service.getStats();

      expect(stats.estimatedCount).toBe(0);
      expect(stats.sampleRecords).toEqual([]);
    });
  });

  describe("Token ID 生成", () => {
    it("應該為長 token 生成縮短的 ID", async () => {
      mockKV.get.mockResolvedValue(null);
      await service.isTokenRevoked(testToken);

      const key = mockKV.get.mock.calls[0][0];
      expect(key).not.toContain(testToken); // 不應包含完整 token
      expect(key).toContain("..."); // 應該包含省略號
    });

    it("應該為短 token 使用完整值", async () => {
      mockKV.get.mockResolvedValue(null);
      await service.isTokenRevoked(shortToken);

      const key = mockKV.get.mock.calls[0][0];
      expect(key).toContain(shortToken);
    });
  });
});
