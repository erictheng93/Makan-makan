/**
 * PrintStatisticsCollector 測試
 * 驗證列印統計收集器的各項功能
 */

import { describe, it, expect, beforeEach } from "vitest";
import { PrintStatisticsCollector } from "../utils/PrintStatisticsCollector";

describe("PrintStatisticsCollector", () => {
  let collector: PrintStatisticsCollector;

  beforeEach(() => {
    collector = new PrintStatisticsCollector();
  });

  describe("初始化 — 空統計", () => {
    it("初始化後所有統計值應為零", () => {
      const stats = collector.getStatistics("any-device");

      expect(stats.totalJobs).toBe(0);
      expect(stats.successfulJobs).toBe(0);
      expect(stats.failedJobs).toBe(0);
      expect(stats.averagePrintTime).toBe(0);
      expect(stats.totalPaperUsed).toBe(0);
      expect(stats.errorRate).toBe(0);
    });

    it("getOverallStatistics 在無資料時應回傳空統計", () => {
      const overall = collector.getOverallStatistics();

      expect(overall.totalJobs).toBe(0);
      expect(overall.successfulJobs).toBe(0);
      expect(overall.failedJobs).toBe(0);
      expect(overall.errorRate).toBe(0);
    });
  });

  describe("recordJobCompleted — 成功記錄", () => {
    it("應增加 totalJobs 和 successfulJobs", () => {
      collector.recordJobCompleted({
        deviceId: "printer-1",
        jobId: "job-1",
        duration: 500,
      });

      const stats = collector.getStatistics("printer-1");
      expect(stats.totalJobs).toBe(1);
      expect(stats.successfulJobs).toBe(1);
      expect(stats.failedJobs).toBe(0);
    });

    it("多次完成應累計", () => {
      collector.recordJobCompleted({
        deviceId: "printer-1",
        jobId: "job-1",
        duration: 400,
      });
      collector.recordJobCompleted({
        deviceId: "printer-1",
        jobId: "job-2",
        duration: 600,
      });

      const stats = collector.getStatistics("printer-1");
      expect(stats.totalJobs).toBe(2);
      expect(stats.successfulJobs).toBe(2);
      expect(stats.failedJobs).toBe(0);
    });
  });

  describe("recordJobFailed — 失敗記錄", () => {
    it("應增加 totalJobs 和 failedJobs", () => {
      collector.recordJobFailed({
        deviceId: "printer-1",
        jobId: "job-1",
        duration: 200,
        error: "Paper jam",
      });

      const stats = collector.getStatistics("printer-1");
      expect(stats.totalJobs).toBe(1);
      expect(stats.successfulJobs).toBe(0);
      expect(stats.failedJobs).toBe(1);
    });
  });

  describe("getStatistics — 計算 averagePrintTime 和 errorRate", () => {
    it("應正確計算平均列印時間", () => {
      collector.recordJobCompleted({
        deviceId: "printer-1",
        jobId: "job-1",
        duration: 300,
      });
      collector.recordJobCompleted({
        deviceId: "printer-1",
        jobId: "job-2",
        duration: 500,
      });

      const stats = collector.getStatistics("printer-1");
      // (300 + 500) / 2 = 400
      expect(stats.averagePrintTime).toBe(400);
    });

    it("應正確計算 errorRate", () => {
      collector.recordJobCompleted({
        deviceId: "printer-1",
        jobId: "job-1",
        duration: 300,
      });
      collector.recordJobFailed({
        deviceId: "printer-1",
        jobId: "job-2",
        duration: 100,
      });

      const stats = collector.getStatistics("printer-1");
      // 1 failed / 2 total = 0.5
      expect(stats.errorRate).toBe(0.5);
    });

    it("全部成功時 errorRate 應為 0", () => {
      collector.recordJobCompleted({
        deviceId: "printer-1",
        jobId: "job-1",
        duration: 300,
      });
      collector.recordJobCompleted({
        deviceId: "printer-1",
        jobId: "job-2",
        duration: 500,
      });

      const stats = collector.getStatistics("printer-1");
      expect(stats.errorRate).toBe(0);
    });

    it("全部失敗時 errorRate 應為 1", () => {
      collector.recordJobFailed({
        deviceId: "printer-1",
        jobId: "job-1",
        duration: 100,
      });
      collector.recordJobFailed({
        deviceId: "printer-1",
        jobId: "job-2",
        duration: 200,
      });

      const stats = collector.getStatistics("printer-1");
      expect(stats.errorRate).toBe(1);
    });
  });

  describe("設備分離統計", () => {
    it("不同設備應有各自獨立的統計", () => {
      collector.recordJobCompleted({
        deviceId: "printer-1",
        jobId: "job-1",
        duration: 300,
      });
      collector.recordJobCompleted({
        deviceId: "printer-1",
        jobId: "job-2",
        duration: 500,
      });
      collector.recordJobFailed({
        deviceId: "printer-2",
        jobId: "job-3",
        duration: 100,
      });

      const stats1 = collector.getStatistics("printer-1");
      expect(stats1.totalJobs).toBe(2);
      expect(stats1.successfulJobs).toBe(2);
      expect(stats1.failedJobs).toBe(0);

      const stats2 = collector.getStatistics("printer-2");
      expect(stats2.totalJobs).toBe(1);
      expect(stats2.successfulJobs).toBe(0);
      expect(stats2.failedJobs).toBe(1);
    });

    it("查詢不存在的設備應回傳空統計", () => {
      collector.recordJobCompleted({
        deviceId: "printer-1",
        jobId: "job-1",
        duration: 300,
      });

      const stats = collector.getStatistics("nonexistent");
      expect(stats.totalJobs).toBe(0);
    });
  });

  describe("getOverallStatistics — 跨設備彙總", () => {
    it("應彙總所有設備的統計數據", () => {
      collector.recordJobCompleted({
        deviceId: "printer-1",
        jobId: "job-1",
        duration: 400,
      });
      collector.recordJobCompleted({
        deviceId: "printer-1",
        jobId: "job-2",
        duration: 600,
      });
      collector.recordJobFailed({
        deviceId: "printer-2",
        jobId: "job-3",
        duration: 200,
      });

      const overall = collector.getOverallStatistics();

      // printer-1: 2 total, 2 success, 0 failed
      // printer-2: 1 total, 0 success, 1 failed
      expect(overall.totalJobs).toBe(3);
      expect(overall.successfulJobs).toBe(2);
      expect(overall.failedJobs).toBe(1);
    });

    it("彙總 errorRate 應為各設備 errorRate 的平均值", () => {
      // printer-1: 0 failures out of 2 → errorRate = 0
      collector.recordJobCompleted({
        deviceId: "printer-1",
        jobId: "job-1",
        duration: 400,
      });
      collector.recordJobCompleted({
        deviceId: "printer-1",
        jobId: "job-2",
        duration: 600,
      });
      // printer-2: 1 failure out of 1 → errorRate = 1
      collector.recordJobFailed({
        deviceId: "printer-2",
        jobId: "job-3",
        duration: 200,
      });

      const overall = collector.getOverallStatistics();

      // reduce 平均: (0 + 1) / 2 = 0.5
      expect(overall.errorRate).toBe(0.5);
    });
  });

  describe("shutdown — 清理", () => {
    it("shutdown 後所有指標和統計應被清除", async () => {
      collector.recordJobCompleted({
        deviceId: "printer-1",
        jobId: "job-1",
        duration: 300,
      });
      collector.recordJobFailed({
        deviceId: "printer-2",
        jobId: "job-2",
        duration: 100,
      });

      // 確認有資料
      expect(collector.getStatistics("printer-1").totalJobs).toBe(1);

      await collector.shutdown();

      // 清除後應回傳空統計
      expect(collector.getStatistics("printer-1").totalJobs).toBe(0);
      expect(collector.getOverallStatistics().totalJobs).toBe(0);
    });
  });
});
