import { afterEach, describe, expect, it } from "vitest";
import { validateConfig, validateEnvironment } from "./validation";
import type { LocalPrintServiceConfig } from "../LocalPrintService";

const ORIGINAL_ENV = { ...process.env };

const validConfig = (): LocalPrintServiceConfig => ({
  port: 3003,
  wsPort: 3004,
  allowedOrigins: ["https://owner.example"],
  apiKey: "secure-development-key",
  cloudEndpoint: "https://api.example/v1",
  serviceName: "Print Agent",
  restaurantId: "restaurant-42",
  autoDiscovery: true,
  discoveryInterval: 30000,
  heartbeatInterval: 60000,
  maxQueueSize: 100,
  maxRetries: 3,
  retryDelay: 5000,
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("validateConfig", () => {
  it("accepts a valid local print agent configuration", () => {
    process.env.NODE_ENV = "test";

    expect(validateConfig(validConfig())).toMatchObject({
      success: true,
      errors: [],
      config: validConfig(),
    });
  });

  it("rejects conflicting HTTP and WebSocket ports", () => {
    process.env.NODE_ENV = "test";
    const config = validConfig();
    config.wsPort = config.port;

    expect(validateConfig(config)).toEqual({
      success: false,
      errors: ["HTTP port and WebSocket port cannot be the same"],
    });
  });

  it("enforces production API key and origin restrictions", () => {
    process.env.NODE_ENV = "production";
    const config = validConfig();
    config.apiKey = "default-key";
    config.allowedOrigins = ["*"];

    expect(validateConfig(config)).toEqual({
      success: false,
      errors: [
        "Production environment requires a secure API key (min 32 characters)",
        "Production environment should not allow all origins (*)",
      ],
    });
  });

  it("rejects auto discovery intervals that would spam the network", () => {
    process.env.NODE_ENV = "test";
    const config = validConfig();
    config.discoveryInterval = 5000;

    expect(validateConfig(config)).toEqual({
      success: false,
      errors: [
        "Auto discovery interval should be at least 10 seconds to avoid network spam",
      ],
    });
  });
});

describe("validateEnvironment", () => {
  it("requires restaurant identity and valid optional ports", () => {
    delete process.env.RESTAURANT_ID;
    process.env.PRINT_AGENT_PORT = "70000";
    process.env.PRINT_AGENT_WS_PORT = "not-a-port";

    expect(validateEnvironment()).toEqual({
      success: false,
      errors: [
        "Missing required environment variable: RESTAURANT_ID",
        "PRINT_AGENT_PORT must be a valid port number (1-65535)",
        "PRINT_AGENT_WS_PORT must be a valid port number (1-65535)",
      ],
    });
  });

  it("rejects identical HTTP and WebSocket ports from environment", () => {
    process.env.RESTAURANT_ID = "restaurant-42";
    process.env.PRINT_AGENT_PORT = "3003";
    process.env.PRINT_AGENT_WS_PORT = "3003";

    expect(validateEnvironment()).toEqual({
      success: false,
      errors: ["PRINT_AGENT_PORT and PRINT_AGENT_WS_PORT cannot be the same"],
    });
  });
});
