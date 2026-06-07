import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultConfig, generateDefaultApiKey } from "./defaults";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe("createDefaultConfig", () => {
  it("builds defaults from environment variables", () => {
    process.env.RESTAURANT_ID = "restaurant-42";
    process.env.PRINT_AGENT_PORT = "4100";
    process.env.PRINT_AGENT_WS_PORT = "4101";
    process.env.ALLOWED_ORIGINS = "https://owner.example, https://pos.example";
    process.env.PRINT_AGENT_API_KEY = "explicit-api-key";
    process.env.CLOUD_API_ENDPOINT = "https://api.example/v1";
    process.env.AUTO_DISCOVERY = "false";
    process.env.DISCOVERY_INTERVAL = "45000";
    process.env.HEARTBEAT_INTERVAL = "90000";
    process.env.MAX_QUEUE_SIZE = "250";
    process.env.MAX_RETRIES = "5";
    process.env.RETRY_DELAY = "3000";

    expect(createDefaultConfig()).toEqual({
      port: 4100,
      wsPort: 4101,
      allowedOrigins: ["https://owner.example", "https://pos.example"],
      apiKey: "explicit-api-key",
      cloudEndpoint: "https://api.example/v1",
      serviceName: "Print Agent - Restaurant restaurant-42",
      restaurantId: "restaurant-42",
      autoDiscovery: false,
      discoveryInterval: 45000,
      heartbeatInterval: 90000,
      maxQueueSize: 250,
      maxRetries: 5,
      retryDelay: 3000,
    });
  });

  it("generates development API keys scoped to the restaurant", () => {
    vi.spyOn(Date, "now").mockReturnValue(1770000000000);
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "12345678-1234-1234-1234-123456789abc",
    );

    expect(generateDefaultApiKey("restaurant-42")).toBe(
      "print_restaurant-42_1770000000000_123456781",
    );
  });
});
