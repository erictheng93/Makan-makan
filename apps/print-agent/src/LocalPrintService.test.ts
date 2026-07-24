import { createServer } from "node:net";
import type { AddressInfo, Server as NetServer } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { LocalPrintService } from "./LocalPrintService";
import type { LocalPrintServiceConfig } from "./LocalPrintService";

const API_KEY = "test-print-agent-api-key";

const createConfig = (
  overrides: Partial<LocalPrintServiceConfig> = {},
): LocalPrintServiceConfig => ({
  port: 31003,
  wsPort: 31004,
  allowedOrigins: ["http://localhost:5173"],
  apiKey: API_KEY,
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

const reservePorts = async (count: number): Promise<number[]> => {
  const servers = await Promise.all(
    Array.from(
      { length: count },
      () =>
        new Promise<NetServer>((resolve, reject) => {
          const server = createServer();
          server.once("error", reject);
          server.listen(0, "127.0.0.1", () => resolve(server));
        }),
    ),
  );

  const ports = servers.map((server) => {
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected TCP server to have an address");
    }
    return address.port;
  });

  await Promise.all(
    servers.map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }
            resolve();
          });
        }),
    ),
  );

  return ports;
};

const getPrivateServers = (service: LocalPrintService) => {
  const internals = service as unknown as {
    httpServer?: { address(): AddressInfo | string | null };
    wsServer?: { address(): AddressInfo | string | null };
  };

  if (!internals.httpServer || !internals.wsServer) {
    throw new Error("Expected local print service servers to be initialized");
  }

  return {
    httpServer: internals.httpServer,
    wsServer: internals.wsServer,
  };
};

const addressOf = (server: {
  address(): AddressInfo | string | null;
}): string => {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected server to expose a TCP address");
  }
  return address.address;
};

const buildPrintRequest = (overrides: Record<string, unknown> = {}) => ({
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
      createdAt: new Date().toISOString(),
    },
  },
  ...overrides,
});

const apiFetch = (
  port: number,
  path: string,
  init: RequestInit = {},
): Promise<Response> =>
  fetch(`http://127.0.0.1:${port}/api/v1${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-api-key": API_KEY,
      ...(init.headers ?? {}),
    },
  });

const connectWebSocket = (
  port: number,
  apiKey?: string,
): Promise<WebSocket> => {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`, {
      headers: apiKey ? { "x-api-key": apiKey } : undefined,
    });

    ws.once("open", () => resolve(ws));
    ws.once("error", reject);
  });
};

describe("LocalPrintService network boundary", () => {
  let service: LocalPrintService | undefined;

  afterEach(async () => {
    if (service?.isServiceRunning()) {
      await service.stop();
    }
    service = undefined;
  });

  it("binds HTTP and WebSocket listeners to loopback", async () => {
    const [port, wsPort] = await reservePorts(2);
    service = new LocalPrintService(createConfig({ port, wsPort }));

    await service.start();

    const { httpServer, wsServer } = getPrivateServers(service);
    expect(addressOf(httpServer)).toBe("127.0.0.1");
    expect(addressOf(wsServer)).toBe("127.0.0.1");
  });

  it("requires the API key during WebSocket handshake", async () => {
    const [port, wsPort] = await reservePorts(2);
    service = new LocalPrintService(createConfig({ port, wsPort }));

    await service.start();

    await expect(connectWebSocket(wsPort)).rejects.toThrow(
      /Unexpected server response: 401/,
    );

    const ws = await connectWebSocket(wsPort, API_KEY);
    try {
      expect(service.getConnectedClientsCount()).toBe(1);
    } finally {
      ws.close();
    }
  });
});

describe("LocalPrintService HTTP API contract", () => {
  let service: LocalPrintService | undefined;

  afterEach(async () => {
    if (service?.isServiceRunning()) {
      await service.stop();
    }
    service = undefined;
  });

  const startService = async (): Promise<number> => {
    const [port, wsPort] = await reservePorts(2);
    service = new LocalPrintService(createConfig({ port, wsPort }));
    await service.start();
    return port;
  };

  it("initializes the print agent service during start()", async () => {
    await startService();

    expect(service!.getPrintAgentService().initialized).toBe(true);
  });

  it("reports degraded (not unhealthy) health when running with no printers", async () => {
    const port = await startService();

    const response = await apiFetch(port, "/health");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          status: "degraded",
          services: expect.objectContaining({ initialized: true }),
          devices: expect.objectContaining({ total: 0, online: 0 }),
        }),
      }),
    );
  });

  it("returns 503 NO_PRINTER_AVAILABLE when printing with no printers", async () => {
    const port = await startService();

    const response = await apiFetch(port, "/print", {
      method: "POST",
      body: JSON.stringify(buildPrintRequest()),
    });
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "NO_PRINTER_AVAILABLE",
          message: expect.any(String),
        }),
      }),
    );
  });

  it("returns 400 VALIDATION_ERROR for a malformed print request", async () => {
    const port = await startService();

    const response = await apiFetch(port, "/print", {
      method: "POST",
      body: JSON.stringify(buildPrintRequest({ country: undefined })),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "VALIDATION_ERROR",
          message: expect.stringContaining("country"),
        }),
      }),
    );
  });

  it("returns 400 VALIDATION_ERROR for a mismatched restaurant ID", async () => {
    const port = await startService();

    const response = await apiFetch(port, "/print", {
      method: "POST",
      body: JSON.stringify(buildPrintRequest({ restaurantId: "other-shop" })),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "VALIDATION_ERROR" }),
      }),
    );
  });

  it("returns 404 JOB_NOT_FOUND when cancelling an unknown job", async () => {
    const port = await startService();

    const response = await apiFetch(port, "/print/unknown-job", {
      method: "DELETE",
    });
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "JOB_NOT_FOUND" }),
      }),
    );
  });

  it("rejects HTTP requests without the API key", async () => {
    const port = await startService();

    const response = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: "UNAUTHORIZED" }),
      }),
    );
  });
});
