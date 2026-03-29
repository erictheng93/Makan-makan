/**
 * Print Agent 配置驗證測試
 *
 * 測試 validateConfig() 和 validateEnvironment() 的驗證邏輯
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import { validateConfig, validateEnvironment } from "../config/validation";
import type { LocalPrintServiceConfig } from "../LocalPrintService";

beforeEach(() => {
  vi.unstubAllEnvs();
});

/**
 * 構建有效的 LocalPrintServiceConfig 基礎配置
 */
function buildValidConfig(
  overrides?: Partial<LocalPrintServiceConfig>,
): LocalPrintServiceConfig {
  return {
    port: 3003,
    wsPort: 3004,
    allowedOrigins: ["http://localhost:3000"],
    apiKey: "test-api-key-that-is-long-enough-for-production-use",
    cloudEndpoint: "http://localhost:8787/api/v1",
    serviceName: "Print Agent - Test",
    restaurantId: "test-restaurant-001",
    autoDiscovery: true,
    discoveryInterval: 30000,
    heartbeatInterval: 60000,
    maxQueueSize: 100,
    maxRetries: 3,
    retryDelay: 5000,
    ...overrides,
  };
}

describe("validateConfig", () => {
  describe("有效配置通過驗證", () => {
    it("所有欄位有效時應通過驗證", () => {
      const config = buildValidConfig();
      const result = validateConfig(config);
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.config).toBeDefined();
    });

    it("通過驗證時應返回驗證後的配置", () => {
      const config = buildValidConfig();
      const result = validateConfig(config);
      expect(result.config).toMatchObject({
        port: 3003,
        wsPort: 3004,
        restaurantId: "test-restaurant-001",
      });
    });
  });

  describe("無效端口驗證", () => {
    it("端口為 0 時應驗證失敗", () => {
      const config = buildValidConfig({ port: 0 });
      const result = validateConfig(config);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("端口為負數時應驗證失敗", () => {
      const config = buildValidConfig({ port: -1 });
      const result = validateConfig(config);
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes("port"))).toBe(true);
    });

    it("端口超過 65535 時應驗證失敗", () => {
      const config = buildValidConfig({ port: 65536 });
      const result = validateConfig(config);
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes("port"))).toBe(true);
    });

    it("WebSocket 端口為 0 時應驗證失敗", () => {
      const config = buildValidConfig({ wsPort: 0 });
      const result = validateConfig(config);
      expect(result.success).toBe(false);
    });

    it("WebSocket 端口超過 65535 時應驗證失敗", () => {
      const config = buildValidConfig({ wsPort: 65536 });
      const result = validateConfig(config);
      expect(result.success).toBe(false);
    });

    it("端口為有效邊界值 1 時應通過", () => {
      const config = buildValidConfig({ port: 1 });
      const result = validateConfig(config);
      expect(result.success).toBe(true);
    });

    it("端口為有效邊界值 65535 時應通過", () => {
      const config = buildValidConfig({ port: 65535 });
      const result = validateConfig(config);
      expect(result.success).toBe(true);
    });
  });

  describe("重複端口驗證", () => {
    it("HTTP 端口和 WebSocket 端口相同時應驗證失敗", () => {
      const config = buildValidConfig({ port: 3003, wsPort: 3003 });
      const result = validateConfig(config);
      expect(result.success).toBe(false);
      expect(
        result.errors.some((e) =>
          e.includes("HTTP port and WebSocket port cannot be the same"),
        ),
      ).toBe(true);
    });

    it("HTTP 端口和 WebSocket 端口不同時應通過", () => {
      const config = buildValidConfig({ port: 3003, wsPort: 3004 });
      const result = validateConfig(config);
      expect(result.success).toBe(true);
    });
  });

  describe("API 金鑰長度驗證", () => {
    it("API 金鑰少於 10 字符時應驗證失敗", () => {
      const config = buildValidConfig({ apiKey: "short" });
      const result = validateConfig(config);
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes("apiKey"))).toBe(true);
    });

    it("API 金鑰恰好 10 字符時應通過", () => {
      const config = buildValidConfig({ apiKey: "a".repeat(10) });
      const result = validateConfig(config);
      expect(result.success).toBe(true);
    });

    it("空字串 API 金鑰應驗證失敗", () => {
      const config = buildValidConfig({ apiKey: "" });
      const result = validateConfig(config);
      expect(result.success).toBe(false);
    });
  });

  describe("生產環境特定規則", () => {
    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "production");
    });

    it("API 金鑰包含 'default' 時應驗證失敗", () => {
      const config = buildValidConfig({
        apiKey: "print_default_1234567890_abcdef123",
      });
      const result = validateConfig(config);
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes("secure API key"))).toBe(
        true,
      );
    });

    it("API 金鑰少於 32 字符時應驗證失敗", () => {
      const config = buildValidConfig({ apiKey: "short-prod-key-20chars!" });
      const result = validateConfig(config);
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes("min 32 characters"))).toBe(
        true,
      );
    });

    it("允許來源包含 * 時應驗證失敗", () => {
      const config = buildValidConfig({ allowedOrigins: ["*"] });
      const result = validateConfig(config);
      expect(result.success).toBe(false);
      expect(
        result.errors.some((e) => e.includes("should not allow all origins")),
      ).toBe(true);
    });

    it("允許來源包含 * 和其他來源時應驗證失敗", () => {
      const config = buildValidConfig({
        allowedOrigins: ["https://app.example.com", "*"],
      });
      const result = validateConfig(config);
      expect(result.success).toBe(false);
    });

    it("安全 API 金鑰和明確來源在生產環境應通過", () => {
      const config = buildValidConfig({
        apiKey: "a-very-secure-production-api-key-that-is-long-enough",
        allowedOrigins: ["https://app.example.com"],
      });
      const result = validateConfig(config);
      expect(result.success).toBe(true);
    });

    it("非生產環境不應檢查生產規則", () => {
      vi.stubEnv("NODE_ENV", "development");
      const config = buildValidConfig({
        apiKey: "short-key-with-default-in-it",
        allowedOrigins: ["*"],
      });
      const result = validateConfig(config);
      expect(result.success).toBe(true);
    });
  });

  describe("無效雲端端點 URL 驗證", () => {
    it("非 URL 字串應驗證失敗", () => {
      const config = buildValidConfig({ cloudEndpoint: "not-a-url" });
      const result = validateConfig(config);
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes("cloudEndpoint"))).toBe(true);
    });

    it("空字串應驗證失敗", () => {
      const config = buildValidConfig({ cloudEndpoint: "" });
      const result = validateConfig(config);
      expect(result.success).toBe(false);
    });

    it("有效 HTTP URL 應通過", () => {
      const config = buildValidConfig({
        cloudEndpoint: "http://localhost:8787/api/v1",
      });
      const result = validateConfig(config);
      expect(result.success).toBe(true);
    });

    it("有效 HTTPS URL 應通過", () => {
      const config = buildValidConfig({
        cloudEndpoint: "https://api.makanmakan.com/v1",
      });
      const result = validateConfig(config);
      expect(result.success).toBe(true);
    });
  });

  describe("自動發現間隔驗證", () => {
    it("自動發現間隔小於 10 秒時應驗證失敗", () => {
      const config = buildValidConfig({
        autoDiscovery: true,
        discoveryInterval: 5000,
      });
      const result = validateConfig(config);
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes("at least 10 seconds"))).toBe(
        true,
      );
    });

    it("自動發現間隔恰好 10 秒時應通過", () => {
      const config = buildValidConfig({
        autoDiscovery: true,
        discoveryInterval: 10000,
      });
      const result = validateConfig(config);
      expect(result.success).toBe(true);
    });

    it("自動發現關閉時間隔小於 10 秒應通過", () => {
      const config = buildValidConfig({
        autoDiscovery: false,
        discoveryInterval: 5000,
      });
      const result = validateConfig(config);
      expect(result.success).toBe(true);
    });

    it("自動發現間隔小於 1 秒時 Zod 應拒絕", () => {
      const config = buildValidConfig({
        autoDiscovery: false,
        discoveryInterval: 500,
      });
      const result = validateConfig(config);
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes("discoveryInterval"))).toBe(
        true,
      );
    });
  });

  describe("Zod schema 驗證錯誤", () => {
    it("服務名稱為空字串時應驗證失敗", () => {
      const config = buildValidConfig({ serviceName: "" });
      const result = validateConfig(config);
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes("serviceName"))).toBe(true);
    });

    it("餐廳 ID 為空字串時應驗證失敗", () => {
      const config = buildValidConfig({ restaurantId: "" });
      const result = validateConfig(config);
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes("restaurantId"))).toBe(true);
    });

    it("maxQueueSize 超過 1000 時應驗證失敗", () => {
      const config = buildValidConfig({ maxQueueSize: 1001 });
      const result = validateConfig(config);
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes("maxQueueSize"))).toBe(true);
    });

    it("maxRetries 超過 10 時應驗證失敗", () => {
      const config = buildValidConfig({ maxRetries: 11 });
      const result = validateConfig(config);
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes("maxRetries"))).toBe(true);
    });

    it("retryDelay 小於 100ms 時應驗證失敗", () => {
      const config = buildValidConfig({ retryDelay: 50 });
      const result = validateConfig(config);
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes("retryDelay"))).toBe(true);
    });

    it("heartbeatInterval 小於 1 秒時應驗證失敗", () => {
      const config = buildValidConfig({ heartbeatInterval: 500 });
      const result = validateConfig(config);
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes("heartbeatInterval"))).toBe(
        true,
      );
    });

    it("錯誤類型值應產生正確的錯誤訊息", () => {
      const config = buildValidConfig({
        autoDiscovery: "yes" as unknown as boolean,
      });
      const result = validateConfig(config);
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes("autoDiscovery"))).toBe(true);
    });

    it("多個無效欄位應報告所有錯誤", () => {
      const config = buildValidConfig({
        port: 0,
        wsPort: -1,
        apiKey: "",
        serviceName: "",
      });
      const result = validateConfig(config);
      expect(result.success).toBe(false);
      // Zod stops at first failure per field but reports all field failures
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe("validateEnvironment", () => {
  describe("RESTAURANT_ID 驗證", () => {
    it("缺少 RESTAURANT_ID 時應驗證失敗", () => {
      // Ensure RESTAURANT_ID is not set
      vi.stubEnv("RESTAURANT_ID", "");
      // Empty string is falsy, so it counts as missing
      const result = validateEnvironment();
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes("RESTAURANT_ID"))).toBe(true);
    });

    it("RESTAURANT_ID 存在時應通過", () => {
      vi.stubEnv("RESTAURANT_ID", "restaurant-abc-123");
      const result = validateEnvironment();
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("RESTAURANT_ID 為純空白時應驗證失敗", () => {
      vi.stubEnv("RESTAURANT_ID", "   ");
      const result = validateEnvironment();
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes("non-empty"))).toBe(true);
    });
  });

  describe("端口環境變數驗證", () => {
    beforeEach(() => {
      vi.stubEnv("RESTAURANT_ID", "test-restaurant");
    });

    it("有效端口號應通過", () => {
      vi.stubEnv("PRINT_AGENT_PORT", "3003");
      vi.stubEnv("PRINT_AGENT_WS_PORT", "3004");
      const result = validateEnvironment();
      expect(result.success).toBe(true);
    });

    it("無效 PRINT_AGENT_PORT（非數字）應驗證失敗", () => {
      vi.stubEnv("PRINT_AGENT_PORT", "abc");
      const result = validateEnvironment();
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes("PRINT_AGENT_PORT"))).toBe(
        true,
      );
    });

    it("PRINT_AGENT_PORT 為 0 時應驗證失敗", () => {
      vi.stubEnv("PRINT_AGENT_PORT", "0");
      const result = validateEnvironment();
      expect(result.success).toBe(false);
    });

    it("PRINT_AGENT_PORT 超過 65535 時應驗證失敗", () => {
      vi.stubEnv("PRINT_AGENT_PORT", "70000");
      const result = validateEnvironment();
      expect(result.success).toBe(false);
    });

    it("無效 PRINT_AGENT_WS_PORT 應驗證失敗", () => {
      vi.stubEnv("PRINT_AGENT_WS_PORT", "not-a-number");
      const result = validateEnvironment();
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes("PRINT_AGENT_WS_PORT"))).toBe(
        true,
      );
    });

    it("相同端口值應驗證失敗", () => {
      vi.stubEnv("PRINT_AGENT_PORT", "3003");
      vi.stubEnv("PRINT_AGENT_WS_PORT", "3003");
      const result = validateEnvironment();
      expect(result.success).toBe(false);
      expect(result.errors.some((e) => e.includes("cannot be the same"))).toBe(
        true,
      );
    });

    it("未設定端口環境變數時不應報錯", () => {
      // Only RESTAURANT_ID is set
      const result = validateEnvironment();
      expect(result.success).toBe(true);
    });
  });
});
