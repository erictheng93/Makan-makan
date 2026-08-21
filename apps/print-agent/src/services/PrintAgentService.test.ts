import { afterEach, describe, expect, it } from "vitest";
import { PrintAgentService } from "./PrintAgentService";
import type { LocalPrintServiceConfig } from "../LocalPrintService";
import type { PrintRequest } from "@makanmasak/shared-types";

const buildConfig = (
  overrides: Partial<LocalPrintServiceConfig> = {},
): LocalPrintServiceConfig => ({
  port: 31003,
  wsPort: 31004,
  allowedOrigins: ["http://localhost:5173"],
  apiKey: "test-print-agent-api-key",
  cloudEndpoint: "https://api.example/v1",
  serviceName: "Print Agent",
  restaurantId: "restaurant-42",
  autoDiscovery: false,
  discoveryInterval: 30000,
  heartbeatInterval: 60000,
  maxQueueSize: 100,
  maxRetries: 3,
  retryDelay: 5000,
  ...overrides,
});

const buildPrintRequest = (overrides: Record<string, unknown> = {}) =>
  ({
    restaurantId: "restaurant-42",
    country: "TW",
    type: "order",
    data: {
      order: {
        id: "ORDER-1",
        items: [{ name: "Nasi Lemak", quantity: 1, price: 12 }],
        subtotal: 12,
        tax: 0,
        total: 12,
        createdAt: new Date(),
      },
    },
    ...overrides,
  }) as PrintRequest;

describe("PrintAgentService health semantics", () => {
  let agent: PrintAgentService | undefined;

  afterEach(async () => {
    if (agent?.initialized) {
      await agent.shutdown();
    }
    agent = undefined;
  });

  it("reports unhealthy before initialization", async () => {
    agent = new PrintAgentService(buildConfig());

    const health = await agent.healthCheck();

    expect(health).toEqual(
      expect.objectContaining({
        status: "unhealthy",
        services: expect.objectContaining({ initialized: false }),
      }),
    );
  });

  it("reports degraded when initialized with zero printers online", async () => {
    agent = new PrintAgentService(buildConfig());
    await agent.initialize();

    const health = await agent.healthCheck();

    expect(health).toEqual(
      expect.objectContaining({
        status: "degraded",
        services: expect.objectContaining({ initialized: true }),
        devices: expect.objectContaining({ total: 0, online: 0 }),
      }),
    );
  });
});

describe("PrintAgentService createPrintJob error contract", () => {
  let agent: PrintAgentService | undefined;

  afterEach(async () => {
    if (agent?.initialized) {
      await agent.shutdown();
    }
    agent = undefined;
  });

  it("returns VALIDATION_ERROR for a request missing required fields", async () => {
    agent = new PrintAgentService(buildConfig());
    await agent.initialize();

    const result = await agent.createPrintJob(
      buildPrintRequest({ country: undefined }),
    );

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
          message: expect.stringContaining("country"),
        }),
      }),
    );
  });

  it("returns NO_PRINTER_AVAILABLE for a valid request with no printers", async () => {
    agent = new PrintAgentService(buildConfig());
    await agent.initialize();

    const result = await agent.createPrintJob(buildPrintRequest());

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "NO_PRINTER_AVAILABLE" }),
      }),
    );
  });
});
