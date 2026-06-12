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
