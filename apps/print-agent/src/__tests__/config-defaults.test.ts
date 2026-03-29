/**
 * Print Agent 配置默認值測試
 *
 * 測試 createDefaultConfig() 和 generateDefaultApiKey() 的行為
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import { createDefaultConfig, generateDefaultApiKey } from "../config/defaults";

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe("createDefaultConfig", () => {
  describe("默認值（無環境變數）", () => {
    it("應使用默認端口 3003", () => {
      const config = createDefaultConfig();
      expect(config.port).toBe(3003);
    });

    it("應使用默認 WebSocket 端口 3004", () => {
      const config = createDefaultConfig();
      expect(config.wsPort).toBe(3004);
    });

    it("應使用 * 作為默認允許的來源", () => {
      const config = createDefaultConfig();
      expect(config.allowedOrigins).toEqual(["*"]);
    });

    it("應使用 'default' 作為默認餐廳 ID", () => {
      const config = createDefaultConfig();
      expect(config.restaurantId).toBe("default");
    });

    it("應使用默認的雲端端點", () => {
      const config = createDefaultConfig();
      expect(config.cloudEndpoint).toBe("http://localhost:8787/api/v1");
    });

    it("應包含餐廳 ID 在服務名稱中", () => {
      const config = createDefaultConfig();
      expect(config.serviceName).toBe("Print Agent - Restaurant default");
    });

    it("應啟用自動發現", () => {
      const config = createDefaultConfig();
      expect(config.autoDiscovery).toBe(true);
    });

    it("應使用 30 秒作為默認發現間隔", () => {
      const config = createDefaultConfig();
      expect(config.discoveryInterval).toBe(30000);
    });

    it("應使用 60 秒作為默認心跳間隔", () => {
      const config = createDefaultConfig();
      expect(config.heartbeatInterval).toBe(60000);
    });

    it("應使用 100 作為默認佇列大小", () => {
      const config = createDefaultConfig();
      expect(config.maxQueueSize).toBe(100);
    });

    it("應使用 3 作為默認最大重試次數", () => {
      const config = createDefaultConfig();
      expect(config.maxRetries).toBe(3);
    });

    it("應使用 5 秒作為默認重試延遲", () => {
      const config = createDefaultConfig();
      expect(config.retryDelay).toBe(5000);
    });

    it("應自動生成 API 金鑰（未設定環境變數時）", () => {
      const config = createDefaultConfig();
      expect(config.apiKey).toMatch(/^print_default_\d+_[a-f0-9]{9}$/);
    });
  });

  describe("自定義環境變數覆蓋默認值", () => {
    it("應使用 RESTAURANT_ID 覆蓋餐廳 ID", () => {
      vi.stubEnv("RESTAURANT_ID", "my-restaurant-123");
      const config = createDefaultConfig();
      expect(config.restaurantId).toBe("my-restaurant-123");
      expect(config.serviceName).toBe(
        "Print Agent - Restaurant my-restaurant-123",
      );
    });

    it("應使用 PRINT_AGENT_PORT 覆蓋端口", () => {
      vi.stubEnv("PRINT_AGENT_PORT", "4000");
      const config = createDefaultConfig();
      expect(config.port).toBe(4000);
    });

    it("應使用 PRINT_AGENT_WS_PORT 覆蓋 WebSocket 端口", () => {
      vi.stubEnv("PRINT_AGENT_WS_PORT", "4001");
      const config = createDefaultConfig();
      expect(config.wsPort).toBe(4001);
    });

    it("應使用 PRINT_AGENT_API_KEY 覆蓋 API 金鑰", () => {
      vi.stubEnv("PRINT_AGENT_API_KEY", "my-custom-api-key-1234567890");
      const config = createDefaultConfig();
      expect(config.apiKey).toBe("my-custom-api-key-1234567890");
    });

    it("應使用 CLOUD_API_ENDPOINT 覆蓋雲端端點", () => {
      vi.stubEnv("CLOUD_API_ENDPOINT", "https://api.example.com/v1");
      const config = createDefaultConfig();
      expect(config.cloudEndpoint).toBe("https://api.example.com/v1");
    });

    it("應使用 AUTO_DISCOVERY=false 停用自動發現", () => {
      vi.stubEnv("AUTO_DISCOVERY", "false");
      const config = createDefaultConfig();
      expect(config.autoDiscovery).toBe(false);
    });

    it("應在 AUTO_DISCOVERY 為其他值時啟用自動發現", () => {
      vi.stubEnv("AUTO_DISCOVERY", "true");
      const config = createDefaultConfig();
      expect(config.autoDiscovery).toBe(true);
    });

    it("應使用 DISCOVERY_INTERVAL 覆蓋發現間隔", () => {
      vi.stubEnv("DISCOVERY_INTERVAL", "15000");
      const config = createDefaultConfig();
      expect(config.discoveryInterval).toBe(15000);
    });

    it("應使用 HEARTBEAT_INTERVAL 覆蓋心跳間隔", () => {
      vi.stubEnv("HEARTBEAT_INTERVAL", "120000");
      const config = createDefaultConfig();
      expect(config.heartbeatInterval).toBe(120000);
    });

    it("應使用 MAX_QUEUE_SIZE 覆蓋佇列大小", () => {
      vi.stubEnv("MAX_QUEUE_SIZE", "500");
      const config = createDefaultConfig();
      expect(config.maxQueueSize).toBe(500);
    });

    it("應使用 MAX_RETRIES 覆蓋最大重試次數", () => {
      vi.stubEnv("MAX_RETRIES", "5");
      const config = createDefaultConfig();
      expect(config.maxRetries).toBe(5);
    });

    it("應使用 RETRY_DELAY 覆蓋重試延遲", () => {
      vi.stubEnv("RETRY_DELAY", "10000");
      const config = createDefaultConfig();
      expect(config.retryDelay).toBe(10000);
    });
  });

  describe("端口字串轉數字解析", () => {
    it("應將字串端口正確轉換為數字", () => {
      vi.stubEnv("PRINT_AGENT_PORT", "8080");
      vi.stubEnv("PRINT_AGENT_WS_PORT", "8081");
      const config = createDefaultConfig();
      expect(typeof config.port).toBe("number");
      expect(typeof config.wsPort).toBe("number");
      expect(config.port).toBe(8080);
      expect(config.wsPort).toBe(8081);
    });

    it("應將數字字串正確解析為整數", () => {
      vi.stubEnv("DISCOVERY_INTERVAL", "45000");
      vi.stubEnv("MAX_QUEUE_SIZE", "200");
      vi.stubEnv("MAX_RETRIES", "7");
      vi.stubEnv("RETRY_DELAY", "3000");
      const config = createDefaultConfig();
      expect(config.discoveryInterval).toBe(45000);
      expect(config.maxQueueSize).toBe(200);
      expect(config.maxRetries).toBe(7);
      expect(config.retryDelay).toBe(3000);
    });
  });

  describe("ALLOWED_ORIGINS 解析", () => {
    it("應將逗號分隔的字串拆分為陣列", () => {
      vi.stubEnv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,https://app.example.com",
      );
      const config = createDefaultConfig();
      expect(config.allowedOrigins).toEqual([
        "http://localhost:3000",
        "https://app.example.com",
      ]);
    });

    it("應去除來源字串的前後空白", () => {
      vi.stubEnv(
        "ALLOWED_ORIGINS",
        " http://localhost:3000 , https://app.example.com ",
      );
      const config = createDefaultConfig();
      expect(config.allowedOrigins).toEqual([
        "http://localhost:3000",
        "https://app.example.com",
      ]);
    });

    it("應正確處理單一來源", () => {
      vi.stubEnv("ALLOWED_ORIGINS", "https://only-one.example.com");
      const config = createDefaultConfig();
      expect(config.allowedOrigins).toEqual(["https://only-one.example.com"]);
    });

    it("應正確處理三個以上的來源", () => {
      vi.stubEnv("ALLOWED_ORIGINS", "http://a.com,http://b.com,http://c.com");
      const config = createDefaultConfig();
      expect(config.allowedOrigins).toHaveLength(3);
    });
  });
});

describe("generateDefaultApiKey", () => {
  it("應基於餐廳 ID 生成 API 金鑰", () => {
    const key = generateDefaultApiKey("test-restaurant");
    expect(key).toMatch(/^print_test-restaurant_\d+_[a-f0-9]{9}$/);
  });

  it("應包含 print_ 前綴", () => {
    const key = generateDefaultApiKey("any-id");
    expect(key.startsWith("print_")).toBe(true);
  });

  it("應包含時間戳", () => {
    const before = Date.now();
    const key = generateDefaultApiKey("r1");
    const after = Date.now();

    const parts = key.split("_");
    // parts: ["print", "r1", "<timestamp>", "<random>"]
    const timestamp = parseInt(parts[2]);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it("應包含 9 位隨機十六進制字符", () => {
    const key = generateDefaultApiKey("r1");
    const parts = key.split("_");
    const random = parts[parts.length - 1];
    expect(random).toMatch(/^[a-f0-9]{9}$/);
  });

  it("每次呼叫應產生不同的金鑰", () => {
    const key1 = generateDefaultApiKey("same-id");
    const key2 = generateDefaultApiKey("same-id");
    expect(key1).not.toBe(key2);
  });

  it("不同餐廳 ID 應產生不同前綴的金鑰", () => {
    const key1 = generateDefaultApiKey("restaurant-a");
    const key2 = generateDefaultApiKey("restaurant-b");
    expect(key1).toContain("restaurant-a");
    expect(key2).toContain("restaurant-b");
    expect(key1).not.toEqual(key2);
  });

  describe("API 金鑰自動生成（環境變數未設定時）", () => {
    it("createDefaultConfig 未設定 PRINT_AGENT_API_KEY 時應自動生成金鑰", () => {
      const config = createDefaultConfig();
      expect(config.apiKey).toBeTruthy();
      expect(config.apiKey.length).toBeGreaterThan(10);
      expect(config.apiKey).toMatch(/^print_/);
    });
  });

  describe("API 金鑰來自環境變數", () => {
    it("設定 PRINT_AGENT_API_KEY 時應直接使用該值", () => {
      vi.stubEnv("PRINT_AGENT_API_KEY", "custom-key-from-env-1234567890");
      const config = createDefaultConfig();
      expect(config.apiKey).toBe("custom-key-from-env-1234567890");
    });

    it("設定 PRINT_AGENT_API_KEY 時不應生成 UUID 式金鑰", () => {
      vi.stubEnv("PRINT_AGENT_API_KEY", "my-secret-key-abcdef1234");
      const config = createDefaultConfig();
      expect(config.apiKey).not.toMatch(/^print_/);
    });
  });
});
