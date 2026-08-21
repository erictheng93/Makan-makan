import { createServer } from "node:net";
import type { AddressInfo, Server as NetServer } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import type { PrintJob } from "@makanmasak/shared-types";
import { LocalPrintService } from "./LocalPrintService";
import type { LocalPrintServiceConfig } from "./LocalPrintService";

const API_KEY = "test-print-agent-api-key";
const CLOUD_ENDPOINT = "https://api.example/v1";
const CLOUD_KEY = "mmpa_test_cloud_key";

const createConfig = (
  overrides: Partial<LocalPrintServiceConfig> = {},
): LocalPrintServiceConfig => ({
  port: 31003,
  wsPort: 31004,
  allowedOrigins: ["http://localhost:5173"],
  apiKey: API_KEY,
  cloudEndpoint: CLOUD_ENDPOINT,
  serviceName: "Print Agent",
  restaurantId: "restaurant-42",
  cloudKey: CLOUD_KEY,
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

/**
 * Cloud calls are stubbed for every test in this file. Without this the agent
 * would resolve api.example over real DNS on each start(), which is both slow
 * and a hidden dependency on the poll being non-fatal.
 */
let cloudCalls: Array<{ url: string; init?: RequestInit }> = [];
let cloudHandler: (url: string) => Response = () =>
  Response.json({ success: true, data: null });

beforeEach(() => {
  const realFetch = globalThis.fetch;
  cloudCalls = [];
  cloudHandler = () => Response.json({ success: true, data: null });

  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!url.startsWith(CLOUD_ENDPOINT)) {
      return realFetch(input, init);
    }
    cloudCalls.push({ url, init });
    return cloudHandler(url);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
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

describe("LocalPrintService cloud job dispatch", () => {
  let service: LocalPrintService | undefined;

  afterEach(async () => {
    if (service?.isServiceRunning()) {
      await service.stop();
    }
    service = undefined;
  });

  const pollCloudJobs = (target: LocalPrintService): Promise<void> =>
    (target as unknown as { pollCloudJobs(): Promise<void> }).pollCloudJobs();

  const pendingJob = () => ({
    success: true,
    data: {
      receiptId: "receipt-1",
      request: {
        country: "TW",
        type: "receipt",
        restaurantId: "restaurant-42",
        data: {
          order: {
            id: "order-1",
            items: [{ name: "Nasi Lemak", quantity: 1, price: 12 }],
            subtotal: 12,
            tax: 0,
            total: 12,
            createdAt: "2025-08-12T12:00:00.000Z",
          },
        },
      },
    },
  });

  const serveOneJob = () => {
    cloudHandler = (url) =>
      url.includes("/ack")
        ? Response.json({ success: true })
        : Response.json(pendingJob());
  };

  const acknowledgement = () =>
    JSON.parse(String(cloudCalls.at(-1)?.init?.body)) as Record<
      string,
      unknown
    >;

  it("claims a job for its own register and acknowledges a completed print", async () => {
    service = new LocalPrintService(createConfig());
    const agent = service.getPrintAgentService();
    const createPrintJob = vi
      .spyOn(agent, "createPrintJob")
      .mockResolvedValue({ success: true, jobId: "job-1" });
    vi.spyOn(agent, "getJobStatus").mockResolvedValue({
      id: "job-1",
      status: "completed",
      deviceId: "USB-1",
    } as unknown as PrintJob);
    serveOneJob();

    await pollCloudJobs(service);

    const polled = new URL(String(cloudCalls[0]?.url));
    expect(polled.origin + polled.pathname).toBe(
      `${CLOUD_ENDPOINT}/print/jobs`,
    );
    // No register and no restaurant anywhere on the wire: the cloud derives
    // both from the credential, so this agent cannot ask for another shop's
    // receipts. Asserted per-parameter rather than against a whole URL string,
    // which would also break every time an unrelated parameter is added.
    expect(polled.searchParams.get("registerId")).toBeNull();
    expect(polled.searchParams.get("restaurantId")).toBeNull();
    expect(cloudCalls[0]?.init?.headers).toEqual({
      "X-Print-Agent-Key": CLOUD_KEY,
    });
    expect(createPrintJob).toHaveBeenCalledOnce();
    // The ESC/POS formatter calls Date methods on this field, but JSON only
    // ever carries a string.
    expect(
      createPrintJob.mock.calls[0]?.[0].data.order.createdAt,
    ).toBeInstanceOf(Date);

    expect(cloudCalls[1]?.url).toBe(
      `${CLOUD_ENDPOINT}/print/jobs/receipt-1/ack`,
    );
    expect(cloudCalls[1]?.init?.method).toBe("POST");
    expect(acknowledgement()).toEqual({
      status: "printed",
      printerName: "USB-1",
    });
  });

  it("acknowledges failure when the local queue refuses the job", async () => {
    service = new LocalPrintService(createConfig());
    const agent = service.getPrintAgentService();
    vi.spyOn(agent, "createPrintJob").mockResolvedValue({
      success: false,
      error: { code: "NO_PRINTER_AVAILABLE", message: "No printer available" },
    });
    const getJobStatus = vi.spyOn(agent, "getJobStatus");
    serveOneJob();

    await pollCloudJobs(service);

    // A claimed receipt that is never acknowledged stays "printing" forever —
    // there is no reclaim path on the cloud side.
    expect(getJobStatus).not.toHaveBeenCalled();
    expect(acknowledgement()).toEqual({
      status: "failed",
      response: "No printer available",
    });
  });

  it("acknowledges failure when the printer reports a failed job", async () => {
    service = new LocalPrintService(createConfig());
    const agent = service.getPrintAgentService();
    vi.spyOn(agent, "createPrintJob").mockResolvedValue({
      success: true,
      jobId: "job-1",
    });
    vi.spyOn(agent, "getJobStatus").mockResolvedValue({
      id: "job-1",
      status: "failed",
      deviceId: "USB-1",
      error: { code: "PAPER_OUT", message: "Paper out" },
    } as unknown as PrintJob);
    serveOneJob();

    await pollCloudJobs(service);

    expect(acknowledgement()).toEqual({
      status: "failed",
      printerName: "USB-1",
      response: "Paper out",
    });
  });

  it("stays a local-only print server when no cloud credential is configured", async () => {
    // A shop can run the agent purely for the POS on the same LAN. Without a
    // credential there is no tenant to poll for, so it must not call out at
    // all rather than poll and be rejected every minute.
    service = new LocalPrintService(createConfig({ cloudKey: undefined }));
    const agent = service.getPrintAgentService();
    const createPrintJob = vi.spyOn(agent, "createPrintJob");

    await pollCloudJobs(service);

    expect(cloudCalls).toHaveLength(0);
    expect(createPrintJob).not.toHaveBeenCalled();
  });

  it("prints nothing and acknowledges nothing when the queue is empty", async () => {
    service = new LocalPrintService(createConfig());
    const agent = service.getPrintAgentService();
    const createPrintJob = vi.spyOn(agent, "createPrintJob");

    await pollCloudJobs(service);

    expect(createPrintJob).not.toHaveBeenCalled();
    expect(cloudCalls).toHaveLength(1);
  });

  it("keeps serving local print jobs when the startup cloud poll fails", async () => {
    // index.ts turns a rejected start() into process.exit(1). Coupling the
    // daemon's startup to cloud reachability means an offline uplink takes out
    // the shop's local printing too, which used to work on its own.
    cloudHandler = () => {
      throw new Error("getaddrinfo ENOTFOUND api.example");
    };
    const [port, wsPort] = await reservePorts(2);
    service = new LocalPrintService(createConfig({ port, wsPort }));

    await expect(service.start()).resolves.toBeUndefined();

    expect(service.isServiceRunning()).toBe(true);
    const response = await apiFetch(port, "/health");
    expect(response.status).toBe(200);
  });
});
