/**
 * PrinterHealthMonitor 測試
 * 驗證印表機健康狀態監控器的各項功能
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { PrinterHealthMonitor } from "../utils/PrinterHealthMonitor";

describe("PrinterHealthMonitor", () => {
  let monitor: PrinterHealthMonitor;

  beforeEach(() => {
    monitor = new PrinterHealthMonitor();
  });

  describe("生命週期管理", () => {
    it("初始化後 isReady 應為 true", async () => {
      expect(monitor.isReady()).toBe(false);

      await monitor.initialize();

      expect(monitor.isReady()).toBe(true);
    });

    it("shutdown 後 isReady 應為 false", async () => {
      await monitor.initialize();
      expect(monitor.isReady()).toBe(true);

      await monitor.shutdown();

      expect(monitor.isReady()).toBe(false);
    });

    it("shutdown 應清除事件處理器", async () => {
      await monitor.initialize();
      const handler = vi.fn();
      monitor.on("health-changed", handler);

      await monitor.shutdown();

      // shutdown 後觸發事件不應呼叫 handler
      monitor.updateHealth("device-1", "online");
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("addDevice / removeDevice — 設備追蹤", () => {
    it("addDevice 應將設備加入監控，狀態為 unknown", () => {
      monitor.addDevice("printer-1");

      const health = monitor.getHealth("printer-1");
      expect(health).not.toBeNull();
      expect(health!.status).toBe("unknown");
      expect(health!.errorCount).toBe(0);
      expect(health!.averageResponseTime).toBe(0);
    });

    it("addDevice 對已存在的設備不應覆蓋", () => {
      monitor.addDevice("printer-1");
      monitor.updateHealth("printer-1", "online", 100);

      const avgBefore = monitor.getHealth("printer-1")!.averageResponseTime;

      // 再次 add 不應重置
      monitor.addDevice("printer-1");

      const health = monitor.getHealth("printer-1");
      expect(health!.status).toBe("online");
      expect(health!.averageResponseTime).toBe(avgBefore);
    });

    it("removeDevice 應將設備從監控中移除", () => {
      monitor.addDevice("printer-1");
      expect(monitor.getHealth("printer-1")).not.toBeNull();

      monitor.removeDevice("printer-1");

      expect(monitor.getHealth("printer-1")).toBeNull();
    });

    it("removeDevice 對不存在的設備不應報錯", () => {
      expect(() => monitor.removeDevice("nonexistent")).not.toThrow();
    });
  });

  describe("updateHealth — 狀態更新", () => {
    it("更新為 online 狀態", () => {
      monitor.updateHealth("device-1", "online");

      const health = monitor.getHealth("device-1");
      expect(health!.status).toBe("online");
    });

    it("更新為 error 狀態時 errorCount 應遞增", () => {
      monitor.updateHealth("device-1", "error");
      expect(monitor.getHealth("device-1")!.errorCount).toBe(1);

      monitor.updateHealth("device-1", "error");
      expect(monitor.getHealth("device-1")!.errorCount).toBe(2);

      monitor.updateHealth("device-1", "error");
      expect(monitor.getHealth("device-1")!.errorCount).toBe(3);
    });

    it("非 error 狀態不應增加 errorCount", () => {
      monitor.updateHealth("device-1", "error");
      expect(monitor.getHealth("device-1")!.errorCount).toBe(1);

      monitor.updateHealth("device-1", "online");
      expect(monitor.getHealth("device-1")!.errorCount).toBe(1);
    });

    it("應更新 lastSeen 時間", () => {
      const before = new Date();
      monitor.updateHealth("device-1", "online");
      const after = new Date();

      const health = monitor.getHealth("device-1");
      expect(health!.lastSeen.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(health!.lastSeen.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("提供 responseTime 時應計算 averageResponseTime", () => {
      monitor.updateHealth("device-1", "online", 100);
      // 初始 avg=0，計算 (0 + 100) / 2 = 50
      expect(monitor.getHealth("device-1")!.averageResponseTime).toBe(50);

      monitor.updateHealth("device-1", "online", 200);
      // (50 + 200) / 2 = 125
      expect(monitor.getHealth("device-1")!.averageResponseTime).toBe(125);
    });

    it("未提供 responseTime 時 averageResponseTime 不變", () => {
      monitor.updateHealth("device-1", "online", 100);
      const avg = monitor.getHealth("device-1")!.averageResponseTime;

      monitor.updateHealth("device-1", "online");
      expect(monitor.getHealth("device-1")!.averageResponseTime).toBe(avg);
    });
  });

  describe("getHealth / getAllHealth — 查詢", () => {
    it("getHealth 對不存在的設備應回傳 null", () => {
      expect(monitor.getHealth("nonexistent")).toBeNull();
    });

    it("getAllHealth 應回傳所有設備的健康資訊副本", () => {
      monitor.addDevice("printer-1");
      monitor.addDevice("printer-2");

      const all = monitor.getAllHealth();
      expect(all.size).toBe(2);
      expect(all.has("printer-1")).toBe(true);
      expect(all.has("printer-2")).toBe(true);
    });

    it("getAllHealth 回傳的是副本，修改不影響原始資料", () => {
      monitor.addDevice("printer-1");

      const all = monitor.getAllHealth();
      all.delete("printer-1");

      // 原始資料不受影響
      expect(monitor.getHealth("printer-1")).not.toBeNull();
    });
  });

  describe("isHealthy — 健康檢查", () => {
    it("狀態為 online 時應回傳 true", () => {
      monitor.updateHealth("device-1", "online");

      expect(monitor.isHealthy("device-1")).toBe(true);
    });

    it("狀態為 offline 時應回傳 false", () => {
      monitor.updateHealth("device-1", "offline");

      expect(monitor.isHealthy("device-1")).toBe(false);
    });

    it("狀態為 error 時應回傳 false", () => {
      monitor.updateHealth("device-1", "error");

      expect(monitor.isHealthy("device-1")).toBe(false);
    });

    it("狀態為 unknown 時應回傳 false", () => {
      monitor.addDevice("device-1");

      expect(monitor.isHealthy("device-1")).toBe(false);
    });

    it("設備不存在時應回傳 false", () => {
      expect(monitor.isHealthy("nonexistent")).toBe(false);
    });
  });

  describe("getDeviceStatuses — 設備狀態 Map", () => {
    it("應回傳所有設備 id 與其狀態的 Map", () => {
      monitor.updateHealth("printer-1", "online");
      monitor.updateHealth("printer-2", "offline");
      monitor.updateHealth("printer-3", "error");

      const statuses = monitor.getDeviceStatuses();

      expect(statuses.size).toBe(3);
      expect(statuses.get("printer-1")).toBe("online");
      expect(statuses.get("printer-2")).toBe("offline");
      expect(statuses.get("printer-3")).toBe("error");
    });

    it("無設備時應回傳空 Map", () => {
      const statuses = monitor.getDeviceStatuses();

      expect(statuses.size).toBe(0);
    });
  });

  describe("事件機制 — health-changed 事件", () => {
    it("狀態更新時應觸發 health-changed 事件", () => {
      const handler = vi.fn();
      monitor.on("health-changed", handler);

      monitor.updateHealth("device-1", "online");

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({
        deviceId: "device-1",
        health: expect.objectContaining({
          status: "online",
        }),
      });
    });

    it("多次更新應觸發多次事件", () => {
      const handler = vi.fn();
      monitor.on("health-changed", handler);

      monitor.updateHealth("device-1", "online");
      monitor.updateHealth("device-1", "error");
      monitor.updateHealth("device-1", "offline");

      expect(handler).toHaveBeenCalledTimes(3);
    });

    it("可透過 off 移除事件監聽器", () => {
      const handler = vi.fn();
      monitor.on("health-changed", handler);

      monitor.updateHealth("device-1", "online");
      expect(handler).toHaveBeenCalledTimes(1);

      monitor.off("health-changed", handler);

      monitor.updateHealth("device-1", "offline");
      expect(handler).toHaveBeenCalledTimes(1); // 不再增加
    });

    it("多個監聽器應各自被呼叫", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      monitor.on("health-changed", handler1);
      monitor.on("health-changed", handler2);

      monitor.updateHealth("device-1", "online");

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });
});
