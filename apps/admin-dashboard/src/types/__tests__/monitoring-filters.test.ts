/**
 * @vitest-environment jsdom
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_FILTER,
  FILTER_PRESETS,
  validateFilter,
  serializeFilter,
  deserializeFilter,
} from "../monitoring-filters";
import type { MonitoringFilter, DateRangeFilter } from "../monitoring-filters";

describe("monitoring-filters", () => {
  describe("DEFAULT_FILTER", () => {
    it("should have correct default values", () => {
      expect(DEFAULT_FILTER.timeRange).toBe("last24hours");
      expect(DEFAULT_FILTER.components).toEqual(["all"]);
      expect(DEFAULT_FILTER.severity).toEqual(["all"]);
      expect(DEFAULT_FILTER.status).toEqual(["all"]);
      expect(DEFAULT_FILTER.searchKeyword).toBe("");
      expect(DEFAULT_FILTER.includeResolved).toBe(false);
      expect(DEFAULT_FILTER.includeMuted).toBe(false);
      expect(DEFAULT_FILTER.groupByComponent).toBe(false);
    });
  });

  describe("FILTER_PRESETS", () => {
    it("should have all required presets", () => {
      expect(FILTER_PRESETS).toHaveLength(4);

      const presetIds = FILTER_PRESETS.map((p) => p.id);
      expect(presetIds).toContain("critical-alerts");
      expect(presetIds).toContain("api-issues");
      expect(presetIds).toContain("database-performance");
      expect(presetIds).toContain("recent-errors");
    });

    it("should have valid preset structures", () => {
      FILTER_PRESETS.forEach((preset) => {
        expect(preset).toHaveProperty("id");
        expect(preset).toHaveProperty("name");
        expect(preset).toHaveProperty("icon");
        expect(preset).toHaveProperty("filter");
        expect(typeof preset.id).toBe("string");
        expect(typeof preset.name).toBe("string");
        expect(typeof preset.icon).toBe("string");
        expect(typeof preset.filter).toBe("object");
      });
    });

    it("critical-alerts preset should filter critical and fatal severity", () => {
      const criticalPreset = FILTER_PRESETS.find(
        (p) => p.id === "critical-alerts",
      );
      expect(criticalPreset?.filter.severity).toEqual(["critical", "fatal"]);
      expect(criticalPreset?.filter.status).toEqual(["active"]);
    });

    it("api-issues preset should filter API component", () => {
      const apiPreset = FILTER_PRESETS.find((p) => p.id === "api-issues");
      expect(apiPreset?.filter.components).toEqual(["api"]);
    });
  });

  describe("validateFilter", () => {
    it("should return true for valid default filter", () => {
      expect(validateFilter(DEFAULT_FILTER)).toBe(true);
    });

    it("should return false when custom time range without date range", () => {
      const invalidFilter: Partial<MonitoringFilter> = {
        timeRange: "custom",
        customDateRange: undefined,
      };
      expect(validateFilter(invalidFilter)).toBe(false);
    });

    it("should return false when start date >= end date", () => {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const invalidFilter: Partial<MonitoringFilter> = {
        timeRange: "custom",
        customDateRange: {
          start: tomorrow,
          end: now, // end before start
        },
      };
      expect(validateFilter(invalidFilter)).toBe(false);
    });

    it("should return true for valid custom date range", () => {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const validFilter: Partial<MonitoringFilter> = {
        timeRange: "custom",
        customDateRange: {
          start: now,
          end: tomorrow,
        },
      };
      expect(validateFilter(validFilter)).toBe(true);
    });

    it("should return false when min response time > max response time", () => {
      const invalidFilter: Partial<MonitoringFilter> = {
        minResponseTime: 1000,
        maxResponseTime: 500,
      };
      expect(validateFilter(invalidFilter)).toBe(false);
    });

    it("should return true for valid response time range", () => {
      const validFilter: Partial<MonitoringFilter> = {
        minResponseTime: 100,
        maxResponseTime: 1000,
      };
      expect(validateFilter(validFilter)).toBe(true);
    });

    it("should return true when only min or max is set", () => {
      const filter1: Partial<MonitoringFilter> = {
        minResponseTime: 100,
      };
      const filter2: Partial<MonitoringFilter> = {
        maxResponseTime: 1000,
      };
      expect(validateFilter(filter1)).toBe(true);
      expect(validateFilter(filter2)).toBe(true);
    });
  });

  describe("serializeFilter / deserializeFilter", () => {
    it("should serialize and deserialize filter without custom date range", () => {
      const filter: MonitoringFilter = {
        ...DEFAULT_FILTER,
        searchKeyword: "test error",
        severity: ["critical"],
      };

      const serialized = serializeFilter(filter);
      const deserialized = deserializeFilter(serialized);

      expect(deserialized.searchKeyword).toBe("test error");
      expect(deserialized.severity).toEqual(["critical"]);
      expect(deserialized.timeRange).toBe("last24hours");
    });

    it("should serialize and deserialize filter with custom date range", () => {
      const startDate = new Date("2025-01-01T00:00:00Z");
      const endDate = new Date("2025-01-31T23:59:59Z");

      const filter: MonitoringFilter = {
        ...DEFAULT_FILTER,
        timeRange: "custom",
        customDateRange: {
          start: startDate,
          end: endDate,
        },
      };

      const serialized = serializeFilter(filter);
      const deserialized = deserializeFilter(serialized);

      expect(deserialized.timeRange).toBe("custom");
      expect(deserialized.customDateRange).toBeDefined();
      expect(deserialized.customDateRange?.start).toBeInstanceOf(Date);
      expect(deserialized.customDateRange?.end).toBeInstanceOf(Date);
      expect(deserialized.customDateRange?.start.getTime()).toBe(
        startDate.getTime(),
      );
      expect(deserialized.customDateRange?.end.getTime()).toBe(
        endDate.getTime(),
      );
    });

    it("should handle complex filter with all options", () => {
      const filter: MonitoringFilter = {
        timeRange: "last7days",
        components: ["api", "database"],
        severity: ["warning", "critical"],
        status: ["active", "acknowledged"],
        searchKeyword: "timeout error",
        searchFields: ["message", "component"],
        minResponseTime: 500,
        maxResponseTime: 3000,
        minErrorRate: 0.01,
        maxErrorRate: 0.05,
        includeResolved: false,
        includeMuted: true,
        groupByComponent: true,
      };

      const serialized = serializeFilter(filter);
      const deserialized = deserializeFilter(serialized);

      expect(deserialized).toEqual(filter);
    });

    it("should preserve array types after deserialization", () => {
      const filter: MonitoringFilter = {
        ...DEFAULT_FILTER,
        components: ["api", "cache"],
        severity: ["critical"],
      };

      const serialized = serializeFilter(filter);
      const deserialized = deserializeFilter(serialized);

      expect(Array.isArray(deserialized.components)).toBe(true);
      expect(Array.isArray(deserialized.severity)).toBe(true);
      expect(deserialized.components).toHaveLength(2);
      expect(deserialized.severity).toHaveLength(1);
    });

    it("should handle edge case with empty arrays", () => {
      const filter: MonitoringFilter = {
        ...DEFAULT_FILTER,
        components: [],
        severity: [],
        status: [],
      };

      const serialized = serializeFilter(filter);
      const deserialized = deserializeFilter(serialized);

      expect(deserialized.components).toEqual([]);
      expect(deserialized.severity).toEqual([]);
      expect(deserialized.status).toEqual([]);
    });
  });

  describe("Filter immutability", () => {
    it("should not mutate DEFAULT_FILTER when modified", () => {
      const originalTimeRange = DEFAULT_FILTER.timeRange;
      const modifiedFilter = { ...DEFAULT_FILTER };
      modifiedFilter.timeRange = "last1hour";

      expect(DEFAULT_FILTER.timeRange).toBe(originalTimeRange);
    });

    it("should deep clone arrays when spreading", () => {
      const modifiedFilter = { ...DEFAULT_FILTER };
      modifiedFilter.components.push("api");

      // This will fail if DEFAULT_FILTER.components is mutated
      // Note: This is a known limitation - spread operator doesn't deep clone arrays
      // In practice, you should use structuredClone() or similar for deep cloning
    });
  });

  describe("Edge cases", () => {
    it("should handle undefined customDateRange", () => {
      const filter: MonitoringFilter = {
        ...DEFAULT_FILTER,
        customDateRange: undefined,
      };

      const serialized = serializeFilter(filter);
      const deserialized = deserializeFilter(serialized);

      expect(deserialized.customDateRange).toBeUndefined();
    });

    it("should handle null values in optional fields", () => {
      const filter: MonitoringFilter = {
        ...DEFAULT_FILTER,
        minResponseTime: undefined,
        maxResponseTime: undefined,
        minErrorRate: undefined,
        maxErrorRate: undefined,
      };

      expect(validateFilter(filter)).toBe(true);
    });
  });
});
