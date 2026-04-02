/**
 * PrintAgentService Unit Tests
 *
 * Tests for the print agent service that integrates with queue-core printing modules
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  printRequestFactory,
  printJobFactory,
  printerDeviceFactory,
  resetAllFactories,
} from "@makanmakan/testing-utils";
import type { LocalPrintServiceConfig } from "../LocalPrintService";

// -------------------------------------------------------------------
// Mock @makanmakan/queue-core/print
// -------------------------------------------------------------------

const mockPrinterService = {
  initialize: vi.fn().mockResolvedValue(undefined),
  shutdown: vi.fn().mockResolvedValue(undefined),
  print: vi.fn(),
  getJobStatus: vi.fn(),
  cancelJob: vi.fn(),
  registerPrinter: vi.fn().mockResolvedValue(undefined),
  unregisterPrinter: vi.fn().mockResolvedValue(undefined),
  getDevices: vi.fn().mockReturnValue([]),
  getDevice: vi.fn().mockReturnValue(null),
  healthCheck: vi.fn(),
  getStatistics: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
};

const mockDriverFactory = {
  scanForPrinters: vi.fn().mockResolvedValue([]),
  detectPrinter: vi.fn().mockResolvedValue(null),
};

vi.mock("@makanmakan/queue-core/print", () => {
  function MockPrinterService() {
    return mockPrinterService;
  }
  function MockPrinterDriverFactory() {
    return mockDriverFactory;
  }
  return {
    PrinterService: MockPrinterService,
    PrinterDriverFactory: MockPrinterDriverFactory,
  };
});

// Import after mocking
import { PrintAgentService } from "../services/PrintAgentService";

function buildTestConfig(
  overrides?: Partial<LocalPrintServiceConfig>,
): LocalPrintServiceConfig {
  return {
    port: 3003,
    wsPort: 3004,
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

describe("PrintAgentService", () => {
  let service: PrintAgentService;
  let config: LocalPrintServiceConfig;

  beforeEach(() => {
    resetAllFactories();
    vi.clearAllMocks();
    config = buildTestConfig();
    service = new PrintAgentService(config);
  });

  afterEach(async () => {
    if (service.initialized) {
      await service.shutdown();
    }
  });

  // =============================================
  // Service Lifecycle
  // =============================================

  describe("Service Lifecycle", () => {
    it("should construct without initializing", () => {
      expect(service).toBeDefined();
      expect(service.initialized).toBe(false);
    });

    it("should initialize the printer service", async () => {
      await service.initialize();
      expect(service.initialized).toBe(true);
      expect(mockPrinterService.initialize).toHaveBeenCalledOnce();
    });

    it("should not initialize twice", async () => {
      await service.initialize();
      await service.initialize();
      expect(mockPrinterService.initialize).toHaveBeenCalledOnce();
    });

    it("should auto-discover printers on initialize when enabled", async () => {
      const svc = new PrintAgentService(
        buildTestConfig({ autoDiscovery: true }),
      );
      await svc.initialize();
      expect(mockDriverFactory.scanForPrinters).toHaveBeenCalled();
      await svc.shutdown();
    });

    it("should not discover printers when autoDiscovery is disabled", async () => {
      await service.initialize();
      expect(mockDriverFactory.scanForPrinters).not.toHaveBeenCalled();
    });

    it("should shut down the printer service", async () => {
      await service.initialize();
      await service.shutdown();
      expect(service.initialized).toBe(false);
      expect(mockPrinterService.shutdown).toHaveBeenCalledOnce();
    });

    it("should be a no-op to shut down when not initialized", async () => {
      await service.shutdown();
      expect(mockPrinterService.shutdown).not.toHaveBeenCalled();
    });

    it("should propagate initialization errors", async () => {
      mockPrinterService.initialize.mockRejectedValueOnce(
        new Error("init fail"),
      );
      await expect(service.initialize()).rejects.toThrow("init fail");
    });

    it("should propagate shutdown errors", async () => {
      await service.initialize();
      mockPrinterService.shutdown.mockRejectedValueOnce(
        new Error("shutdown fail"),
      );
      await expect(service.shutdown()).rejects.toThrow("shutdown fail");
    });
  });

  // =============================================
  // Print Job Management
  // =============================================

  describe("Print Job Management", () => {
    it("should auto-initialize when creating a print job", async () => {
      const request = printRequestFactory.build({
        overrides: { restaurantId: config.restaurantId },
      });
      mockPrinterService.print.mockResolvedValueOnce({
        success: true,
        jobId: "job-1",
      });

      await service.createPrintJob(request);
      expect(service.initialized).toBe(true);
    });

    it("should create a print job and return the response", async () => {
      await service.initialize();
      const request = printRequestFactory.build({
        overrides: { restaurantId: config.restaurantId },
      });
      mockPrinterService.print.mockResolvedValueOnce({
        success: true,
        jobId: "job-1",
      });

      const result = await service.createPrintJob(request);
      expect(result.success).toBe(true);
      expect(result.jobId).toBe("job-1");
      expect(mockPrinterService.print).toHaveBeenCalledWith(request);
    });

    it("should return error response when print fails", async () => {
      await service.initialize();
      const request = printRequestFactory.build({
        overrides: { restaurantId: config.restaurantId },
      });
      mockPrinterService.print.mockRejectedValueOnce(new Error("Print failed"));

      const result = await service.createPrintJob(request);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe("JOB_CREATION_FAILED");
    });

    it("should validate missing country field", async () => {
      await service.initialize();
      const request = printRequestFactory.build({
        overrides: {
          restaurantId: config.restaurantId,
          country: "" as any,
        },
      });

      const result = await service.createPrintJob(request);
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("country");
    });

    it("should validate mismatched restaurant ID", async () => {
      await service.initialize();
      const request = printRequestFactory.build({
        overrides: { restaurantId: "wrong-restaurant" },
      });

      const result = await service.createPrintJob(request);
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("Invalid restaurant ID");
    });

    it("should validate missing type field", async () => {
      await service.initialize();
      const request = printRequestFactory.build({
        overrides: {
          restaurantId: config.restaurantId,
          type: "" as any,
        },
      });

      const result = await service.createPrintJob(request);
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("type");
    });

    it("should validate missing data field", async () => {
      await service.initialize();
      const request = printRequestFactory.build({
        overrides: {
          restaurantId: config.restaurantId,
          data: undefined as any,
        },
      });

      const result = await service.createPrintJob(request);
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("data");
    });

    it("should validate missing data.order field", async () => {
      await service.initialize();
      const request = printRequestFactory.build({
        overrides: {
          restaurantId: config.restaurantId,
          data: {} as any,
        },
      });

      const result = await service.createPrintJob(request);
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("data.order");
    });

    it("should get job status by ID", async () => {
      const job = printJobFactory.buildCompleted();
      mockPrinterService.getJobStatus.mockResolvedValueOnce(job);

      const result = await service.getJobStatus("job-1");
      expect(result).toEqual(job);
      expect(mockPrinterService.getJobStatus).toHaveBeenCalledWith("job-1");
    });

    it("should return null for non-existent job", async () => {
      mockPrinterService.getJobStatus.mockResolvedValueOnce(null);
      const result = await service.getJobStatus("non-existent");
      expect(result).toBeNull();
    });

    it("should cancel a job", async () => {
      mockPrinterService.cancelJob.mockResolvedValueOnce(true);
      const result = await service.cancelJob("job-1");
      expect(result).toBe(true);
    });

    it("should return false when cancellation fails", async () => {
      mockPrinterService.cancelJob.mockRejectedValueOnce(
        new Error("cancel fail"),
      );
      const result = await service.cancelJob("job-1");
      expect(result).toBe(false);
    });
  });

  // =============================================
  // Device Management
  // =============================================

  describe("Device Management", () => {
    it("should discover printers", async () => {
      const devices = [
        printerDeviceFactory.buildEpson(),
        printerDeviceFactory.buildStar(),
      ];
      mockDriverFactory.scanForPrinters.mockResolvedValueOnce(devices);

      const result = await service.discoverPrinters();
      expect(result).toHaveLength(2);
      expect(mockDriverFactory.scanForPrinters).toHaveBeenCalledWith([
        "usb",
        "network",
        "bluetooth",
      ]);
    });

    it("should return empty array when discovery fails", async () => {
      mockDriverFactory.scanForPrinters.mockRejectedValueOnce(
        new Error("scan fail"),
      );
      const result = await service.discoverPrinters();
      expect(result).toEqual([]);
    });

    it("should register a printer device", async () => {
      const device = printerDeviceFactory.build();
      mockPrinterService.getDevice.mockReturnValueOnce(null);

      const result = await service.registerPrinter(device);
      expect(result).toBe(true);
      expect(mockPrinterService.registerPrinter).toHaveBeenCalledWith({
        id: device.id,
        brand: device.brand,
        model: device.model,
        connectionType: device.connection,
        connectionParams: { address: device.address },
        capabilities: device.capabilities,
        isDefault: false,
      });
    });

    it("should skip registration for already-registered printer", async () => {
      const device = printerDeviceFactory.build();
      mockPrinterService.getDevice.mockReturnValueOnce(device);

      const result = await service.registerPrinter(device);
      expect(result).toBe(true);
      expect(mockPrinterService.registerPrinter).not.toHaveBeenCalled();
    });

    it("should return false when registration fails", async () => {
      const device = printerDeviceFactory.build();
      mockPrinterService.getDevice.mockReturnValueOnce(null);
      mockPrinterService.registerPrinter.mockRejectedValueOnce(
        new Error("reg fail"),
      );

      const result = await service.registerPrinter(device);
      expect(result).toBe(false);
    });

    it("should unregister a printer", async () => {
      const result = await service.unregisterPrinter("device-1");
      expect(result).toBe(true);
      expect(mockPrinterService.unregisterPrinter).toHaveBeenCalledWith(
        "device-1",
      );
    });

    it("should return false when unregistration fails", async () => {
      mockPrinterService.unregisterPrinter.mockRejectedValueOnce(
        new Error("unreg fail"),
      );
      const result = await service.unregisterPrinter("device-1");
      expect(result).toBe(false);
    });

    it("should return all devices", () => {
      const devices = [
        printerDeviceFactory.build(),
        printerDeviceFactory.build(),
      ];
      mockPrinterService.getDevices.mockReturnValueOnce(devices);

      const result = service.getDevices();
      expect(result).toEqual(devices);
    });

    it("should return a specific device by ID", () => {
      const device = printerDeviceFactory.build();
      mockPrinterService.getDevice.mockReturnValueOnce(device);

      const result = service.getDevice(device.id);
      expect(result).toEqual(device);
    });

    it("should return null for non-existent device", () => {
      mockPrinterService.getDevice.mockReturnValueOnce(null);
      const result = service.getDevice("non-existent");
      expect(result).toBeNull();
    });
  });

  // =============================================
  // Health and Statistics
  // =============================================

  describe("Health and Statistics", () => {
    it("should return health check data", async () => {
      await service.initialize();
      mockPrinterService.healthCheck.mockResolvedValueOnce({
        service: "healthy",
        devices: [],
        queue: { pending: 0, processing: 0, failed: 0 },
      });
      mockPrinterService.getDevices.mockReturnValueOnce([]);

      const health = await service.healthCheck();
      expect(health.status).toBe("healthy");
      expect(health.services.printerService).toBe(true);
      expect(health.devices.total).toBe(0);
      expect(health.queue).toEqual({ pending: 0, processing: 0, failed: 0 });
    });

    it("should report device counts correctly", async () => {
      await service.initialize();
      const onlineDevice = printerDeviceFactory.build({
        overrides: { status: "online" },
      });
      const errorDevice = printerDeviceFactory.build({
        overrides: { status: "error" },
      });
      const offlineDevice = printerDeviceFactory.buildOffline();

      mockPrinterService.healthCheck.mockResolvedValueOnce({
        service: "degraded",
        devices: [],
        queue: { pending: 2, processing: 1, failed: 0 },
      });
      mockPrinterService.getDevices.mockReturnValueOnce([
        onlineDevice,
        errorDevice,
        offlineDevice,
      ]);

      const health = await service.healthCheck();
      expect(health.devices.total).toBe(3);
      expect(health.devices.online).toBe(1);
      expect(health.devices.errors).toBe(1);
    });

    it("should return statistics", () => {
      const mockStats = {
        totalJobs: 100,
        completedJobs: 90,
        failedJobs: 5,
        averageJobTime: 2000,
        paperUsage: 500,
        deviceUptime: 0,
        errorRate: 0.05,
        busyHours: [],
      };
      mockPrinterService.getStatistics.mockReturnValueOnce(mockStats);

      const stats = service.getStatistics();
      expect(stats.printing).toEqual(mockStats);
      expect(stats.uptime).toBeGreaterThanOrEqual(0);
      expect(stats.memory).toBeDefined();
    });
  });

  // =============================================
  // Event Handling
  // =============================================

  describe("Event Handling", () => {
    it("should register and emit events", () => {
      const listener = vi.fn();
      service.on("job_completed", listener);

      service.emit("job_completed", { jobId: "j1" });
      expect(listener).toHaveBeenCalledWith({ jobId: "j1" });
    });

    it("should support multiple listeners for the same event", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      service.on("job_failed", listener1);
      service.on("job_failed", listener2);

      service.emit("job_failed", { error: "test" });
      expect(listener1).toHaveBeenCalledOnce();
      expect(listener2).toHaveBeenCalledOnce();
    });

    it("should not throw when emitting with no listeners", () => {
      expect(() => service.emit("unknown_event", {})).not.toThrow();
    });

    it("should catch listener errors without propagating", () => {
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      service.on("test_event", () => {
        throw new Error("listener error");
      });

      expect(() => service.emit("test_event", {})).not.toThrow();
      expect(errSpy).toHaveBeenCalled();
      errSpy.mockRestore();
    });

    it("should forward printer service events to agent events", () => {
      // The PrinterService mock's .on is called during constructor.
      // Verify the event mapping was set up.
      const onCalls = mockPrinterService.on.mock.calls;
      const eventNames = onCalls.map((c: any[]) => c[0]);

      expect(eventNames).toContain("device_registered");
      expect(eventNames).toContain("device_unregistered");
      expect(eventNames).toContain("job_completed");
      expect(eventNames).toContain("job_failed");
    });
  });

  // =============================================
  // Configuration
  // =============================================

  describe("Configuration", () => {
    it("should expose a copy of the configuration", () => {
      const exposed = service.configuration;
      expect(exposed.restaurantId).toBe(config.restaurantId);
      expect(exposed.port).toBe(config.port);
    });

    it("should not allow mutation of the original config via the getter", () => {
      const exposed = service.configuration;
      (exposed as any).restaurantId = "mutated";
      expect(service.configuration.restaurantId).toBe(config.restaurantId);
    });
  });
});
