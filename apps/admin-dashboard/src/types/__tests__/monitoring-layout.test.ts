/**
 * @vitest-environment jsdom
 */

import { describe, it, expect } from "vitest";
import {
  WIDGET_TYPES,
  WIDGET_SIZE_PRESETS,
  LAYOUT_PRESETS,
  DEFAULT_LAYOUT,
  generateWidgetId,
  checkWidgetOverlap,
  findNextAvailablePosition,
} from "../monitoring-layout";
import type { Widget, WidgetType } from "../monitoring-layout";

describe("monitoring-layout", () => {
  describe("WIDGET_TYPES", () => {
    it("should have all 12 widget types", () => {
      expect(WIDGET_TYPES).toHaveLength(12);

      const expectedTypes: WidgetType[] = [
        "health-overview",
        "key-metrics",
        "component-status",
        "active-alerts",
        "performance-chart",
        "error-log",
        "realtime-connections",
        "response-time-chart",
        "throughput-chart",
        "cache-metrics",
        "database-metrics",
        "custom-chart",
      ];

      const actualTypes = WIDGET_TYPES.map((w) => w.type);
      expectedTypes.forEach((type) => {
        expect(actualTypes).toContain(type);
      });
    });

    it("should have valid widget metadata", () => {
      WIDGET_TYPES.forEach((widget) => {
        expect(widget).toHaveProperty("type");
        expect(widget).toHaveProperty("name");
        expect(widget).toHaveProperty("description");
        expect(widget).toHaveProperty("icon");
        expect(widget).toHaveProperty("category");
        expect(widget).toHaveProperty("defaultSize");
        expect(widget).toHaveProperty("defaultConfig");
        expect(widget).toHaveProperty("configurable");

        expect(typeof widget.name).toBe("string");
        expect(typeof widget.description).toBe("string");
        expect(typeof widget.configurable).toBe("boolean");
        expect([
          "overview",
          "performance",
          "alerts",
          "metrics",
          "charts",
        ]).toContain(widget.category);
        expect(["small", "medium", "large", "xlarge"]).toContain(
          widget.defaultSize,
        );
      });
    });

    it("should categorize widgets correctly", () => {
      const overview = WIDGET_TYPES.filter((w) => w.category === "overview");
      const performance = WIDGET_TYPES.filter(
        (w) => w.category === "performance",
      );
      const alerts = WIDGET_TYPES.filter((w) => w.category === "alerts");
      const metrics = WIDGET_TYPES.filter((w) => w.category === "metrics");
      const charts = WIDGET_TYPES.filter((w) => w.category === "charts");

      expect(overview.length).toBeGreaterThan(0);
      expect(alerts.length).toBeGreaterThan(0);
      expect(charts.length).toBeGreaterThan(0);
    });

    it("should have default config for all widgets", () => {
      WIDGET_TYPES.forEach((widget) => {
        expect(widget.defaultConfig).toBeDefined();
        expect(typeof widget.defaultConfig).toBe("object");

        if (widget.category === "charts") {
          expect(widget.defaultConfig.chartType).toBeDefined();
        }
      });
    });
  });

  describe("WIDGET_SIZE_PRESETS", () => {
    it("should have all 4 size presets", () => {
      expect(WIDGET_SIZE_PRESETS.small).toBeDefined();
      expect(WIDGET_SIZE_PRESETS.medium).toBeDefined();
      expect(WIDGET_SIZE_PRESETS.large).toBeDefined();
      expect(WIDGET_SIZE_PRESETS.xlarge).toBeDefined();
    });

    it("should have increasing dimensions", () => {
      const sizes = [
        WIDGET_SIZE_PRESETS.small,
        WIDGET_SIZE_PRESETS.medium,
        WIDGET_SIZE_PRESETS.large,
        WIDGET_SIZE_PRESETS.xlarge,
      ];

      for (let i = 0; i < sizes.length - 1; i++) {
        expect(sizes[i].width).toBeLessThanOrEqual(sizes[i + 1].width);
        expect(sizes[i].height).toBeLessThanOrEqual(sizes[i + 1].height);
      }
    });

    it("should have valid min/max constraints", () => {
      Object.values(WIDGET_SIZE_PRESETS).forEach((size) => {
        if (size.minWidth) {
          expect(size.width).toBeGreaterThanOrEqual(size.minWidth);
        }
        if (size.minHeight) {
          expect(size.height).toBeGreaterThanOrEqual(size.minHeight);
        }
        if (size.maxWidth) {
          expect(size.width).toBeLessThanOrEqual(size.maxWidth);
        }
        if (size.maxHeight) {
          expect(size.height).toBeLessThanOrEqual(size.maxHeight);
        }
      });
    });

    it("small size should fit in 12-column grid", () => {
      expect(WIDGET_SIZE_PRESETS.small.width).toBeLessThanOrEqual(12);
    });

    it("xlarge size should span full width", () => {
      expect(WIDGET_SIZE_PRESETS.xlarge.width).toBe(12);
    });
  });

  describe("LAYOUT_PRESETS", () => {
    it("should have 4 layout presets", () => {
      expect(LAYOUT_PRESETS).toHaveLength(4);

      const expectedIds = [
        "default-overview",
        "performance-focused",
        "alerts-monitoring",
        "minimal",
      ];
      const actualIds = LAYOUT_PRESETS.map((p) => p.id);

      expectedIds.forEach((id) => {
        expect(actualIds).toContain(id);
      });
    });

    it("should have valid preset structures", () => {
      LAYOUT_PRESETS.forEach((preset) => {
        expect(preset).toHaveProperty("id");
        expect(preset).toHaveProperty("name");
        expect(preset).toHaveProperty("description");
        expect(preset).toHaveProperty("icon");
        expect(preset).toHaveProperty("layout");

        expect(preset.layout).toHaveProperty("name");
        expect(preset.layout).toHaveProperty("widgets");
        expect(preset.layout).toHaveProperty("gridColumns");
        expect(preset.layout).toHaveProperty("gridRowHeight");
        expect(preset.layout).toHaveProperty("isDefault");
        expect(preset.layout).toHaveProperty("isSystem");

        expect(Array.isArray(preset.layout.widgets)).toBe(true);
        expect(preset.layout.gridColumns).toBeGreaterThan(0);
        expect(preset.layout.gridRowHeight).toBeGreaterThan(0);
      });
    });

    it("default-overview should be marked as default", () => {
      const defaultPreset = LAYOUT_PRESETS.find(
        (p) => p.id === "default-overview",
      );
      expect(defaultPreset?.layout.isDefault).toBe(true);
    });

    it("all presets should be marked as system layouts", () => {
      LAYOUT_PRESETS.forEach((preset) => {
        expect(preset.layout.isSystem).toBe(true);
      });
    });

    it("minimal preset should have fewest widgets", () => {
      const minimalPreset = LAYOUT_PRESETS.find((p) => p.id === "minimal");
      const otherPresets = LAYOUT_PRESETS.filter((p) => p.id !== "minimal");

      otherPresets.forEach((preset) => {
        expect(minimalPreset!.layout.widgets.length).toBeLessThanOrEqual(
          preset.layout.widgets.length,
        );
      });
    });
  });

  describe("DEFAULT_LAYOUT", () => {
    it("should be based on first preset", () => {
      const firstPreset = LAYOUT_PRESETS[0];

      expect(DEFAULT_LAYOUT.name).toBe(firstPreset.layout.name);
      expect(DEFAULT_LAYOUT.gridColumns).toBe(firstPreset.layout.gridColumns);
      expect(DEFAULT_LAYOUT.widgets.length).toBe(
        firstPreset.layout.widgets.length,
      );
    });

    it("should have valid id and timestamps", () => {
      expect(DEFAULT_LAYOUT.id).toBe("default");
      expect(DEFAULT_LAYOUT.createdAt).toBeInstanceOf(Date);
      expect(DEFAULT_LAYOUT.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("generateWidgetId", () => {
    it("should generate unique IDs", () => {
      const id1 = generateWidgetId();
      const id2 = generateWidgetId();

      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe("string");
      expect(typeof id2).toBe("string");
    });

    it('should start with "widget-"', () => {
      const id = generateWidgetId();
      expect(id).toMatch(/^widget-/);
    });

    it("should generate IDs with consistent format", () => {
      const id = generateWidgetId();
      expect(id).toMatch(/^widget-\d+-[a-z0-9]+$/);
    });

    it("should generate different IDs in sequence", () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateWidgetId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe("checkWidgetOverlap", () => {
    it("should return false for non-overlapping widgets", () => {
      const widget1: Widget = {
        id: "w1",
        type: "health-overview",
        title: "Health",
        position: { x: 0, y: 0 },
        dimensions: { width: 3, height: 2 },
        visible: true,
        locked: false,
      };

      const widget2: Widget = {
        id: "w2",
        type: "key-metrics",
        title: "Metrics",
        position: { x: 4, y: 0 },
        dimensions: { width: 4, height: 2 },
        visible: true,
        locked: false,
      };

      expect(checkWidgetOverlap(widget1, widget2)).toBe(false);
    });

    it("should return true for overlapping widgets", () => {
      const widget1: Widget = {
        id: "w1",
        type: "health-overview",
        title: "Health",
        position: { x: 0, y: 0 },
        dimensions: { width: 4, height: 3 },
        visible: true,
        locked: false,
      };

      const widget2: Widget = {
        id: "w2",
        type: "key-metrics",
        title: "Metrics",
        position: { x: 2, y: 1 },
        dimensions: { width: 4, height: 3 },
        visible: true,
        locked: false,
      };

      expect(checkWidgetOverlap(widget1, widget2)).toBe(true);
    });

    it("should return false for widgets touching at edges", () => {
      const widget1: Widget = {
        id: "w1",
        type: "health-overview",
        title: "Health",
        position: { x: 0, y: 0 },
        dimensions: { width: 4, height: 2 },
        visible: true,
        locked: false,
      };

      const widget2: Widget = {
        id: "w2",
        type: "key-metrics",
        title: "Metrics",
        position: { x: 4, y: 0 }, // Starts where widget1 ends
        dimensions: { width: 4, height: 2 },
        visible: true,
        locked: false,
      };

      expect(checkWidgetOverlap(widget1, widget2)).toBe(false);
    });

    it("should return true for widget completely inside another", () => {
      const widget1: Widget = {
        id: "w1",
        type: "health-overview",
        title: "Health",
        position: { x: 0, y: 0 },
        dimensions: { width: 12, height: 6 },
        visible: true,
        locked: false,
      };

      const widget2: Widget = {
        id: "w2",
        type: "key-metrics",
        title: "Metrics",
        position: { x: 3, y: 2 },
        dimensions: { width: 3, height: 2 },
        visible: true,
        locked: false,
      };

      expect(checkWidgetOverlap(widget1, widget2)).toBe(true);
    });

    it("should be symmetric", () => {
      const widget1: Widget = {
        id: "w1",
        type: "health-overview",
        title: "Health",
        position: { x: 0, y: 0 },
        dimensions: { width: 4, height: 3 },
        visible: true,
        locked: false,
      };

      const widget2: Widget = {
        id: "w2",
        type: "key-metrics",
        title: "Metrics",
        position: { x: 2, y: 1 },
        dimensions: { width: 4, height: 3 },
        visible: true,
        locked: false,
      };

      expect(checkWidgetOverlap(widget1, widget2)).toBe(
        checkWidgetOverlap(widget2, widget1),
      );
    });
  });

  describe("findNextAvailablePosition", () => {
    it("should return (0, 0) for empty grid", () => {
      const position = findNextAvailablePosition(
        [],
        { width: 3, height: 2 },
        12,
      );

      expect(position.x).toBe(0);
      expect(position.y).toBe(0);
    });

    it("should find position after existing widget", () => {
      const existingWidgets: Widget[] = [
        {
          id: "w1",
          type: "health-overview",
          title: "Health",
          position: { x: 0, y: 0 },
          dimensions: { width: 6, height: 2 },
          visible: true,
          locked: false,
        },
      ];

      const position = findNextAvailablePosition(
        existingWidgets,
        { width: 3, height: 2 },
        12,
      );

      expect(position.x).toBeGreaterThanOrEqual(0);
      expect(position.y).toBeGreaterThanOrEqual(0);

      // Should not overlap with existing widget
      const testWidget: Widget = {
        id: "test",
        type: "key-metrics",
        title: "Test",
        position,
        dimensions: { width: 3, height: 2 },
        visible: true,
        locked: false,
      };

      existingWidgets.forEach((existing) => {
        expect(checkWidgetOverlap(testWidget, existing)).toBe(false);
      });
    });

    it("should respect grid column limit", () => {
      const gridColumns = 12;
      const widgetWidth = 4;

      const position = findNextAvailablePosition(
        [],
        { width: widgetWidth, height: 2 },
        gridColumns,
      );

      expect(position.x).toBeLessThanOrEqual(gridColumns - widgetWidth);
    });

    it("should find position in next row when current row is full", () => {
      const existingWidgets: Widget[] = [
        {
          id: "w1",
          type: "health-overview",
          title: "Health",
          position: { x: 0, y: 0 },
          dimensions: { width: 12, height: 2 },
          visible: true,
          locked: false,
        },
      ];

      const position = findNextAvailablePosition(
        existingWidgets,
        { width: 4, height: 2 },
        12,
      );

      expect(position.y).toBeGreaterThan(0);
    });

    it("should handle large widgets", () => {
      const position = findNextAvailablePosition(
        [],
        { width: 12, height: 5 },
        12,
      );

      expect(position.x).toBe(0);
      expect(position.y).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Edge cases", () => {
    it("should handle widget with zero dimensions", () => {
      const widget: Widget = {
        id: "w1",
        type: "health-overview",
        title: "Health",
        position: { x: 0, y: 0 },
        dimensions: { width: 0, height: 0 },
        visible: true,
        locked: false,
      };

      const position = findNextAvailablePosition(
        [widget],
        { width: 3, height: 2 },
        12,
      );
      expect(position).toBeDefined();
    });

    it("should handle very large grid", () => {
      const position = findNextAvailablePosition(
        [],
        { width: 1, height: 1 },
        24,
      );
      expect(position.x).toBe(0);
      expect(position.y).toBe(0);
    });
  });
});
