import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Undo the global mock set by the database package's setup.ts
vi.unmock("../../utils/connection-manager");

import {
  ConnectionManager,
  getConnectionManager,
  resetConnectionManager,
} from "../connection-manager";

describe("ConnectionManager", () => {
  let manager: ConnectionManager;

  beforeEach(() => {
    manager = new ConnectionManager({
      maxRetries: 2,
      retryDelay: 10, // Very short for fast tests
      defaultTimeout: 5000,
      maxConcurrentQueries: 5,
      batchSize: 3,
      batchWindow: 50,
    });
  });

  afterEach(() => {
    manager.destroy();
  });

  describe("executeQuery", () => {
    it("should execute query and return result", async () => {
      const queryFn = vi.fn().mockResolvedValue({ rows: [1, 2, 3] });

      const result = await manager.executeQuery(queryFn);

      expect(result).toEqual({ rows: [1, 2, 3] });
      expect(queryFn).toHaveBeenCalledOnce();
    });

    it("should track successful queries in metrics", async () => {
      await manager.executeQuery(vi.fn().mockResolvedValue("ok"));

      const metrics = manager.getMetrics();
      expect(metrics.totalQueries).toBe(1);
      expect(metrics.successfulQueries).toBe(1);
      expect(metrics.failedQueries).toBe(0);
    });

    it("should not retry non-transient errors", async () => {
      const queryFn = vi
        .fn()
        .mockRejectedValue(new Error("Syntax error in SQL"));

      await expect(manager.executeQuery(queryFn)).rejects.toThrow(
        "Syntax error",
      );

      expect(queryFn).toHaveBeenCalledTimes(1);
      expect(manager.getMetrics().retriedQueries).toBe(0);
    });

    it("should timeout if query takes too long", async () => {
      const slowQuery = vi.fn(
        () => new Promise((resolve) => setTimeout(resolve, 10000)),
      );

      await expect(
        manager.executeQuery(slowQuery, { timeout: 50 }),
      ).rejects.toThrow("Query timeout");
    });
  });

  describe("getMetrics", () => {
    it("should return initial metrics", () => {
      const metrics = manager.getMetrics();

      expect(metrics.totalQueries).toBe(0);
      expect(metrics.successfulQueries).toBe(0);
      expect(metrics.failedQueries).toBe(0);
      expect(metrics.retriedQueries).toBe(0);
      expect(metrics.batchedQueries).toBe(0);
      expect(metrics.activeQueries).toBe(0);
      expect(metrics.queuedQueries).toBe(0);
      expect(metrics.successRate).toBe(0);
    });

    it("should calculate success rate", async () => {
      await manager.executeQuery(vi.fn().mockResolvedValue("ok"));
      await manager.executeQuery(vi.fn().mockResolvedValue("ok"));

      const metrics = manager.getMetrics();
      expect(metrics.successRate).toBe(100);
    });

    it("should track average query time", async () => {
      await manager.executeQuery(vi.fn().mockResolvedValue("ok"));

      const metrics = manager.getMetrics();
      expect(metrics.averageQueryTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe("resetMetrics", () => {
    it("should clear all metric counters", async () => {
      await manager.executeQuery(vi.fn().mockResolvedValue("ok"));
      expect(manager.getMetrics().totalQueries).toBe(1);

      manager.resetMetrics();

      expect(manager.getMetrics().totalQueries).toBe(0);
      expect(manager.getMetrics().successfulQueries).toBe(0);
    });
  });

  describe("destroy", () => {
    it("should clear query queue and timers", () => {
      manager.destroy();

      expect(manager.getMetrics().queuedQueries).toBe(0);
    });
  });
});

describe("global connection manager", () => {
  afterEach(() => {
    resetConnectionManager();
  });

  it("getConnectionManager should create a singleton", () => {
    const m1 = getConnectionManager();
    const m2 = getConnectionManager();
    expect(m1).toBe(m2);
  });

  it("resetConnectionManager should clear the singleton", () => {
    const m1 = getConnectionManager();
    resetConnectionManager();
    const m2 = getConnectionManager();
    expect(m1).not.toBe(m2);
  });
});
