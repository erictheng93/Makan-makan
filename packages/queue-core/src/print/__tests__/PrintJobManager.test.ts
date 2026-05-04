/**
 * 列印作業管理器測試
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PrintJobManager } from "../services/PrintJobManager";
import type {
  PrintContent,
  PrintRequest,
  OrderData,
} from "@makanmasak/shared-types";

describe("PrintJobManager", () => {
  let jobManager: PrintJobManager;

  beforeEach(async () => {
    jobManager = new PrintJobManager({
      maxConcurrentJobs: 2,
      maxRetries: 2,
      retryDelay: 100, // Faster for testing
      jobTimeout: 5000,
      maxQueueSize: 10,
    });

    await jobManager.initialize();
  });

  afterEach(async () => {
    await jobManager.shutdown();
  });

  // Helper function to create complete test data
  function createTestPrintRequest(
    content: PrintContent,
    overrides: Partial<PrintRequest> = {},
  ): PrintRequest & { deviceId: string; content: PrintContent } {
    const orderData: OrderData = {
      id: "order-123",
      items: [
        {
          name: "Test Item",
          quantity: 1,
          price: 10.0,
          modifiers: [],
        },
      ],
      subtotal: 10.0,
      tax: 1.0,
      total: 11.0,
      createdAt: new Date(),
    };

    return {
      country: "TW",
      type: "receipt",
      priority: "normal",
      deviceId: "test-device",
      restaurantId: 1,
      userId: "user-123",
      data: {
        order: orderData,
      },
      content,
      ...overrides,
    } as PrintRequest & { deviceId: string; content: PrintContent };
  }

  describe("Job Creation", () => {
    it("should create a new print job", async () => {
      const mockContent: PrintContent = {
        header: {
          restaurantInfo: {
            name: "Test Restaurant",
            address: "123 Test St",
            phone: "123-456-7890",
          },
          transactionInfo: {
            orderId: "order-123",
            cashier: "Test Cashier",
            timestamp: new Date(),
            receiptNumber: "R001",
          },
        },
        items: [
          {
            name: "Test Item",
            quantity: 1,
            unitPrice: 10.0,
            totalPrice: 10.0,
          },
        ],
        summary: {
          subtotal: 10.0,
          tax: [
            {
              name: "Tax",
              rate: 0.05,
              amount: 0.5,
              taxableAmount: 10.0,
            },
          ],
          total: 10.5,
          payment: [],
        },
        footer: {
          thankYouMessage: "Thank you!",
        },
      };

      const request = createTestPrintRequest(mockContent);

      const job = await jobManager.createJob(request);

      expect(job.id).toBeDefined();
      expect(job.type).toBe("receipt");
      expect(job.status).toBe("pending");
      expect(job.deviceId).toBe("test-device");
      expect(job.priority).toBe("normal");
      expect(job.attempts).toBe(0);
    });

    it("should reject job when queue is full", async () => {
      const mockContent: PrintContent = {
        header: {
          restaurantInfo: { name: "Test", address: "Test", phone: "Test" },
          transactionInfo: {
            orderId: "test",
            cashier: "test",
            timestamp: new Date(),
            receiptNumber: "test",
          },
        },
        items: [],
        summary: { subtotal: 0, tax: [], total: 0, payment: [] },
        footer: { thankYouMessage: "Test" },
      };

      // Fill the queue
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          jobManager.createJob(
            createTestPrintRequest(mockContent, {
              deviceId: `device-${i}`,
            }),
          ),
        );
      }

      await Promise.all(promises);

      // This should exceed the queue limit
      await expect(
        jobManager.createJob(
          createTestPrintRequest(mockContent, {
            deviceId: "overflow-device",
          }),
        ),
      ).rejects.toThrow("Print queue is full");
    });
  });

  describe("Job Status Management", () => {
    it("should retrieve job by ID", async () => {
      const mockContent: PrintContent = {
        header: {
          restaurantInfo: { name: "Test", address: "Test", phone: "Test" },
          transactionInfo: {
            orderId: "test",
            cashier: "test",
            timestamp: new Date(),
            receiptNumber: "test",
          },
        },
        items: [],
        summary: { subtotal: 0, tax: [], total: 0, payment: [] },
        footer: { thankYouMessage: "Test" },
      };

      const job = await jobManager.createJob(
        createTestPrintRequest(mockContent),
      );

      const retrievedJob = jobManager.getJob(job.id);
      expect(retrievedJob).toEqual(job);
    });

    it("should return null for non-existent job", () => {
      const job = jobManager.getJob("non-existent-id");
      expect(job).toBeNull();
    });

    it("should filter jobs by status", async () => {
      const mockContent: PrintContent = {
        header: {
          restaurantInfo: { name: "Test", address: "Test", phone: "Test" },
          transactionInfo: {
            orderId: "test",
            cashier: "test",
            timestamp: new Date(),
            receiptNumber: "test",
          },
        },
        items: [],
        summary: { subtotal: 0, tax: [], total: 0, payment: [] },
        footer: { thankYouMessage: "Test" },
      };

      const job1 = await jobManager.createJob(
        createTestPrintRequest(mockContent, {
          deviceId: "device-1",
        }),
      );

      const job2 = await jobManager.createJob(
        createTestPrintRequest(mockContent, {
          deviceId: "device-2",
        }),
      );

      const pendingJobs = jobManager.getJobsByStatus("pending");
      expect(pendingJobs).toHaveLength(2);
      expect(pendingJobs.map((j) => j.id)).toContain(job1.id);
      expect(pendingJobs.map((j) => j.id)).toContain(job2.id);
    });
  });

  describe("Job Cancellation", () => {
    it("should cancel pending job", async () => {
      const mockContent: PrintContent = {
        header: {
          restaurantInfo: { name: "Test", address: "Test", phone: "Test" },
          transactionInfo: {
            orderId: "test",
            cashier: "test",
            timestamp: new Date(),
            receiptNumber: "test",
          },
        },
        items: [],
        summary: { subtotal: 0, tax: [], total: 0, payment: [] },
        footer: { thankYouMessage: "Test" },
      };

      const job = await jobManager.createJob(
        createTestPrintRequest(mockContent),
      );

      const cancelled = await jobManager.cancelJob(job.id);
      expect(cancelled).toBe(true);

      const updatedJob = jobManager.getJob(job.id);
      expect(updatedJob?.status).toBe("cancelled");
    });

    it("should not cancel non-pending job", async () => {
      const mockContent: PrintContent = {
        header: {
          restaurantInfo: { name: "Test", address: "Test", phone: "Test" },
          transactionInfo: {
            orderId: "test",
            cashier: "test",
            timestamp: new Date(),
            receiptNumber: "test",
          },
        },
        items: [],
        summary: { subtotal: 0, tax: [], total: 0, payment: [] },
        footer: { thankYouMessage: "Test" },
      };

      const job = await jobManager.createJob(
        createTestPrintRequest(mockContent),
      );

      // Manually change status (simulate job processing)
      jobManager["updateJob"](job.id, { status: "printing" });

      const cancelled = await jobManager.cancelJob(job.id);
      expect(cancelled).toBe(false);
    });
  });

  describe("Device Job Management", () => {
    it("should get jobs by device", async () => {
      const mockContent: PrintContent = {
        header: {
          restaurantInfo: { name: "Test", address: "Test", phone: "Test" },
          transactionInfo: {
            orderId: "test",
            cashier: "test",
            timestamp: new Date(),
            receiptNumber: "test",
          },
        },
        items: [],
        summary: { subtotal: 0, tax: [], total: 0, payment: [] },
        footer: { thankYouMessage: "Test" },
      };

      await jobManager.createJob(
        createTestPrintRequest(mockContent, {
          deviceId: "device-1",
        }),
      );

      await jobManager.createJob(
        createTestPrintRequest(mockContent, {
          deviceId: "device-1",
        }),
      );

      await jobManager.createJob(
        createTestPrintRequest(mockContent, {
          deviceId: "device-2",
        }),
      );

      const device1Jobs = jobManager.getJobsByDevice("device-1");
      expect(device1Jobs).toHaveLength(2);

      const device2Jobs = jobManager.getJobsByDevice("device-2");
      expect(device2Jobs).toHaveLength(1);
    });

    it("should pause and resume device jobs", async () => {
      const mockContent: PrintContent = {
        header: {
          restaurantInfo: { name: "Test", address: "Test", phone: "Test" },
          transactionInfo: {
            orderId: "test",
            cashier: "test",
            timestamp: new Date(),
            receiptNumber: "test",
          },
        },
        items: [],
        summary: { subtotal: 0, tax: [], total: 0, payment: [] },
        footer: { thankYouMessage: "Test" },
      };

      const job = await jobManager.createJob(
        createTestPrintRequest(mockContent),
      );

      // Simulate job being in printing state
      jobManager["updateJob"](job.id, { status: "printing" });

      await jobManager.pauseDeviceJobs("test-device");

      const updatedJob = jobManager.getJob(job.id);
      expect(updatedJob?.status).toBe("paused");

      await jobManager.resumeDeviceJobs("test-device");

      const resumedJob = jobManager.getJob(job.id);
      expect(resumedJob?.status).toBe("pending");
    });
  });

  describe("Statistics", () => {
    it("should return queue statistics", async () => {
      const stats = jobManager.getQueueStatistics();

      expect(stats.total).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.processing).toBe(0);
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.cancelled).toBe(0);
      expect(stats.paused).toBe(0);
    });

    it("should clean up completed jobs", async () => {
      const mockContent: PrintContent = {
        header: {
          restaurantInfo: { name: "Test", address: "Test", phone: "Test" },
          transactionInfo: {
            orderId: "test",
            cashier: "test",
            timestamp: new Date(),
            receiptNumber: "test",
          },
        },
        items: [],
        summary: { subtotal: 0, tax: [], total: 0, payment: [] },
        footer: { thankYouMessage: "Test" },
      };

      const job = await jobManager.createJob(
        createTestPrintRequest(mockContent),
      );

      // Simulate old completed job
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      jobManager["updateJob"](job.id, {
        status: "completed",
        updatedAt: oldDate,
      });

      const removedCount = jobManager.cleanupCompletedJobs(24); // Remove jobs older than 24 hours
      expect(removedCount).toBe(1);

      const retrievedJob = jobManager.getJob(job.id);
      expect(retrievedJob).toBeNull();
    });
  });
});
