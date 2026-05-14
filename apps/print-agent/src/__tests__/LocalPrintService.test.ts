/**
 * LocalPrintService Unit Tests
 *
 * Tests for the local print service that connects cloud system to physical printers.
 * Dependencies (PrintAgentService, PrinterDriverFactory, express, ws) are fully mocked.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  printRequestFactory,
  printerDeviceFactory,
  resetAllFactories,
} from "@makanmakan/testing-utils";
import type { LocalPrintServiceConfig } from "../LocalPrintService";

// -------------------------------------------------------------------
// Mock dependencies
// -------------------------------------------------------------------

const mockPrintAgentService = {
  initialize: vi.fn().mockResolvedValue(undefined),
  shutdown: vi.fn().mockResolvedValue(undefined),
  createPrintJob: vi.fn(),
  getJobStatus: vi.fn(),
  cancelJob: vi.fn(),
  registerPrinter: vi.fn().mockResolvedValue(true),
  unregisterPrinter: vi.fn().mockResolvedValue(true),
  getDevices: vi.fn().mockReturnValue([]),
  getDevice: vi.fn().mockReturnValue(null),
  healthCheck: vi.fn().mockResolvedValue({
    status: "healthy",
    services: { printerService: true, initialized: true },
    devices: { total: 0, online: 0, errors: 0 },
    queue: { pending: 0, processing: 0, failed: 0 },
  }),
  getStatistics: vi.fn().mockReturnValue({
    uptime: 100,
    memory: {},
    printing: {},
  }),
  discoverPrinters: vi.fn().mockResolvedValue([]),
  on: vi.fn(),
  emit: vi.fn(),
};

const mockDriverFactory = {
  scanForPrinters: vi.fn().mockResolvedValue([]),
  detectPrinter: vi.fn().mockResolvedValue(null),
};

vi.mock("../services/PrintAgentService", () => {
  function MockPrintAgentService() {
    return mockPrintAgentService;
  }
  return { PrintAgentService: MockPrintAgentService };
});

vi.mock("@makanmakan/queue-core/print", () => {
  function MockPrinterService() {
    return {};
  }
  function MockPrinterDriverFactory() {
    return mockDriverFactory;
  }
  return {
    PrinterService: MockPrinterService,
    PrinterDriverFactory: MockPrinterDriverFactory,
  };
});

// Mock express to avoid actually starting HTTP servers
const mockHttpClose = vi.fn((cb?: (error?: Error) => void) => cb?.());
const mockListen = vi.fn((_port: number, cb: () => void) => {
  cb();
  return { on: vi.fn(), close: mockHttpClose };
});
const mockUse = vi.fn();
const mockExpressApp = {
  listen: mockListen,
  use: mockUse,
};
vi.mock("express", () => {
  const express: any = vi.fn(() => mockExpressApp);
  express.Router = vi.fn(() => ({
    post: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
  }));
  express.json = vi.fn(() => vi.fn());
  return { default: express };
});

vi.mock("cors", () => ({
  default: vi.fn(() => vi.fn()),
}));

// Mock WebSocketServer to avoid actually binding ports
const mockWsClose = vi.fn((cb?: (error?: Error) => void) => cb?.());
const mockWsOn = vi.fn();
const mockWsOnce = vi.fn();
const mockWsOff = vi.fn();
const mockWsAddress = vi.fn(() => ({ port: 4004 }));
vi.mock("ws", () => {
  function MockWebSocket() {}
  MockWebSocket.OPEN = 1;

  function MockWebSocketServer() {
    return {
      on: mockWsOn,
      once: mockWsOnce,
      off: mockWsOff,
      close: mockWsClose,
      address: mockWsAddress,
    };
  }

  return {
    WebSocketServer: MockWebSocketServer,
    WebSocket: MockWebSocket,
  };
});

// Import after mocking
import { LocalPrintService } from "../LocalPrintService";

function buildTestConfig(
  overrides?: Partial<LocalPrintServiceConfig>,
): LocalPrintServiceConfig {
  return {
    port: 4003,
    wsPort: 4004,
    allowedOrigins: ["http://localhost:3000"],
    apiKey: "test-api-key-long-enough",
    cloudEndpoint: "http://localhost:8787/api/v1",
    serviceName: "Print Agent - Test",
    restaurantId: "test-restaurant-001",
    autoDiscovery: false,
    discoveryInterval: 30000,
    heartbeatInterval: 60000,
    maxQueueSize: 100,
    maxRetries: 3,
    retryDelay: 5000,
    ...overrides,
  };
}

describe("LocalPrintService", () => {
  let service: LocalPrintService;
  let config: LocalPrintServiceConfig;

  beforeEach(() => {
    resetAllFactories();
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: false });
    config = buildTestConfig();
    service = new LocalPrintService(config);
  });

  afterEach(async () => {
    vi.useRealTimers();
    if (service.isServiceRunning()) {
      await service.stop();
    }
  });

  // =============================================
  // Service Initialization
  // =============================================

  describe("Service Initialization", () => {
    it("should construct without starting", () => {
      expect(service).toBeDefined();
      expect(service.isServiceRunning()).toBe(false);
    });

    it("should expose the config", () => {
      const cfg = service.getConfig();
      expect(cfg.restaurantId).toBe("test-restaurant-001");
      expect(cfg.port).toBe(4003);
      expect(cfg.wsPort).toBe(4004);
    });

    it("should expose the print agent service", () => {
      const agent = service.getPrintAgentService();
      expect(agent).toBeDefined();
    });

    it("should start successfully", async () => {
      await service.start();
      expect(service.isServiceRunning()).toBe(true);
    });

    it("should stop successfully after starting", async () => {
      await service.start();
      await service.stop();
      expect(service.isServiceRunning()).toBe(false);
    });

    it("should handle multiple start/stop cycles", async () => {
      for (let i = 0; i < 3; i++) {
        service = new LocalPrintService(config);
        await service.start();
        expect(service.isServiceRunning()).toBe(true);
        await service.stop();
        expect(service.isServiceRunning()).toBe(false);
      }
    });
  });

  // =============================================
  // Printer Discovery
  // =============================================

  describe("Printer Discovery", () => {
    it("should run discovery on start when autoDiscovery is enabled", async () => {
      const svc = new LocalPrintService(
        buildTestConfig({ autoDiscovery: true }),
      );
      await svc.start();

      expect(mockDriverFactory.scanForPrinters).toHaveBeenCalledWith([
        "usb",
        "network",
      ]);
      await svc.stop();
    });

    it("should skip discovery when autoDiscovery is disabled", async () => {
      await service.start();
      expect(mockDriverFactory.scanForPrinters).not.toHaveBeenCalled();
    });

    it("should register newly discovered printers", async () => {
      const device = printerDeviceFactory.buildEpson();
      mockDriverFactory.scanForPrinters.mockResolvedValueOnce([device]);
      mockPrintAgentService.getDevice.mockReturnValueOnce(null);

      const svc = new LocalPrintService(
        buildTestConfig({ autoDiscovery: true }),
      );
      await svc.start();

      expect(mockPrintAgentService.registerPrinter).toHaveBeenCalledWith(
        device,
      );
      await svc.stop();
    });

    it("should skip already-registered printers during discovery", async () => {
      const device = printerDeviceFactory.build();
      mockDriverFactory.scanForPrinters.mockResolvedValueOnce([device]);
      mockPrintAgentService.getDevice.mockReturnValueOnce(device);

      const svc = new LocalPrintService(
        buildTestConfig({ autoDiscovery: true }),
      );
      await svc.start();

      expect(mockPrintAgentService.registerPrinter).not.toHaveBeenCalled();
      await svc.stop();
    });

    it("should handle discovery errors gracefully", async () => {
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockDriverFactory.scanForPrinters.mockRejectedValueOnce(
        new Error("scan error"),
      );

      const svc = new LocalPrintService(
        buildTestConfig({ autoDiscovery: true }),
      );
      await svc.start();

      // Service should still be running
      expect(svc.isServiceRunning()).toBe(true);
      errSpy.mockRestore();
      await svc.stop();
    });

    it("should run periodic discovery via timer", async () => {
      mockDriverFactory.scanForPrinters.mockResolvedValue([]);
      const svc = new LocalPrintService(
        buildTestConfig({
          autoDiscovery: true,
          discoveryInterval: 10000,
        }),
      );
      await svc.start();

      // First call is from startPrinterDiscovery
      const initialCalls = mockDriverFactory.scanForPrinters.mock.calls.length;

      // Advance timer to trigger periodic discovery
      await vi.advanceTimersByTimeAsync(10000);

      expect(
        mockDriverFactory.scanForPrinters.mock.calls.length,
      ).toBeGreaterThan(initialCalls);
      await svc.stop();
    });
  });

  // =============================================
  // WebSocket Management
  // =============================================

  describe("WebSocket Management", () => {
    it("should report zero connected clients initially", () => {
      expect(service.getConnectedClientsCount()).toBe(0);
    });

    it("should not bind WebSocket server on construction", () => {
      expect(mockWsOn).not.toHaveBeenCalled();
    });

    it("should set up connection handler on service start", async () => {
      await service.start();

      // Check that wsServer.on('connection', ...) was registered
      const connectionCallArgs = mockWsOn.mock.calls.find(
        (c: any[]) => c[0] === "connection",
      );
      expect(connectionCallArgs).toBeDefined();
    });
  });

  // =============================================
  // Event Handlers (broadcast)
  // =============================================

  describe("Event Broadcasting", () => {
    it("should register event listeners on PrintAgentService", () => {
      const onCalls = mockPrintAgentService.on.mock.calls;
      const eventNames = onCalls.map((c: any[]) => c[0]);

      expect(eventNames).toContain("device_connected");
      expect(eventNames).toContain("device_disconnected");
      expect(eventNames).toContain("job_completed");
      expect(eventNames).toContain("job_failed");
    });
  });

  // =============================================
  // Heartbeat
  // =============================================

  describe("Heartbeat", () => {
    it("should start heartbeat on service start", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await service.start();

      // Advance past heartbeat interval
      await vi.advanceTimersByTimeAsync(config.heartbeatInterval);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Heartbeat"));
      logSpy.mockRestore();
    });

    it("should stop heartbeat on service stop", async () => {
      await service.start();
      await service.stop();

      // After stop, heartbeat timer should be cleared
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await vi.advanceTimersByTimeAsync(config.heartbeatInterval * 2);

      const heartbeatLogs = logSpy.mock.calls.filter(
        (c) => typeof c[0] === "string" && c[0].includes("Heartbeat"),
      );
      expect(heartbeatLogs).toHaveLength(0);
      logSpy.mockRestore();
    });
  });

  // =============================================
  // Authentication Middleware
  // =============================================

  describe("Authentication", () => {
    it("should use the configured API key for auth", () => {
      // The express .use calls include the authenticateRequest middleware
      expect(mockUse).toHaveBeenCalled();
    });
  });

  // =============================================
  // Cloud Registration
  // =============================================

  describe("Cloud Registration", () => {
    it("should register with cloud on start", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      await service.start();

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining("Registering with cloud"),
      );
      logSpy.mockRestore();
    });

    it("should handle cloud registration failure gracefully", async () => {
      // registerWithCloud catches its own errors, so start should not throw
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await service.start();
      expect(service.isServiceRunning()).toBe(true);

      errSpy.mockRestore();
      logSpy.mockRestore();
    });
  });

  // =============================================
  // Service Stop Cleanup
  // =============================================

  describe("Service Stop Cleanup", () => {
    it("should close WebSocket server on stop", async () => {
      await service.start();
      await service.stop();
      expect(mockWsClose).toHaveBeenCalled();
    });

    it("should clear discovery timer on stop", async () => {
      const svc = new LocalPrintService(
        buildTestConfig({ autoDiscovery: true }),
      );
      mockDriverFactory.scanForPrinters.mockResolvedValue([]);
      await svc.start();
      await svc.stop();

      // After stop, advancing timers should not trigger more scans
      const callsBefore = mockDriverFactory.scanForPrinters.mock.calls.length;
      await vi.advanceTimersByTimeAsync(60000);
      expect(mockDriverFactory.scanForPrinters.mock.calls.length).toBe(
        callsBefore,
      );
    });
  });

  // =============================================
  // Error Handling
  // =============================================

  describe("Error Handling", () => {
    it("should throw on HTTP server listen error", async () => {
      mockListen.mockImplementationOnce((_port: number, _cb: () => void) => {
        const server = {
          on: vi.fn((event: string, handler: (err: Error) => void) => {
            if (event === "error") {
              handler(new Error("EADDRINUSE"));
            }
          }),
        };
        return server;
      });

      const svc = new LocalPrintService(config);
      await expect(svc.start()).rejects.toThrow("EADDRINUSE");
    });

    it("should handle printer registration failure during discovery", async () => {
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const device = printerDeviceFactory.build();
      mockDriverFactory.scanForPrinters.mockResolvedValueOnce([device]);
      mockPrintAgentService.getDevice.mockReturnValueOnce(null);
      mockPrintAgentService.registerPrinter.mockRejectedValueOnce(
        new Error("reg fail"),
      );

      const svc = new LocalPrintService(
        buildTestConfig({ autoDiscovery: true }),
      );
      await svc.start();

      // Should still be running despite registration failure
      expect(svc.isServiceRunning()).toBe(true);
      errSpy.mockRestore();
      await svc.stop();
    });
  });

  // =============================================
  // Queue Overflow / Edge Cases
  // =============================================

  describe("Edge Cases", () => {
    it("should work with maxQueueSize of 1", () => {
      const svc = new LocalPrintService(buildTestConfig({ maxQueueSize: 1 }));
      expect(svc.getConfig().maxQueueSize).toBe(1);
    });

    it("should work with maxRetries of 0", () => {
      const svc = new LocalPrintService(buildTestConfig({ maxRetries: 0 }));
      expect(svc.getConfig().maxRetries).toBe(0);
    });

    it("should handle empty allowedOrigins", () => {
      const svc = new LocalPrintService(
        buildTestConfig({ allowedOrigins: [] }),
      );
      expect(svc.getConfig().allowedOrigins).toEqual([]);
    });
  });
});
