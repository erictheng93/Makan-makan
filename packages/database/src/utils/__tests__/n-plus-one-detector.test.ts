import { describe, it, expect, beforeEach } from "vitest";
import {
  N1Detector,
  getN1Detector,
  resetN1Detector,
  EAGER_LOADING_PATTERNS,
} from "../n-plus-one-detector";

describe("N1Detector", () => {
  let detector: N1Detector;

  beforeEach(() => {
    detector = new N1Detector(true);
  });

  describe("logQuery", () => {
    it("should store queries when enabled", () => {
      detector.logQuery("SELECT * FROM orders WHERE id = 1", 10);

      const stats = detector.getStats();
      expect(stats.totalQueries).toBe(1);
    });

    it("should not store queries when disabled", () => {
      const disabledDetector = new N1Detector(false);
      disabledDetector.logQuery("SELECT * FROM orders", 5);

      expect(disabledDetector.getStats().totalQueries).toBe(0);
    });

    it("should keep only last 1000 queries", () => {
      for (let i = 0; i < 1010; i++) {
        detector.logQuery(`SELECT * FROM table WHERE id = ${i}`, 1);
      }

      expect(detector.getStats().totalQueries).toBe(1000);
    });
  });

  describe("analyze", () => {
    it("should detect N+1 pattern when 5+ similar queries exist", () => {
      for (let i = 0; i < 6; i++) {
        detector.logQuery(`SELECT * FROM order_items WHERE order_id = ${i}`, 5);
      }

      const results = detector.analyze();

      expect(results.length).toBe(1);
      expect(results[0].isN1Pattern).toBe(true);
      expect(results[0].queryCount).toBe(6);
    });

    it("should NOT flag queries below threshold", () => {
      for (let i = 0; i < 3; i++) {
        detector.logQuery(`SELECT * FROM orders WHERE id = ${i}`, 5);
      }

      const results = detector.analyze();
      expect(results.length).toBe(0);
    });

    it("should classify severity as low for 5-9 queries", () => {
      for (let i = 0; i < 5; i++) {
        detector.logQuery(`SELECT * FROM items WHERE id = ${i}`, 3);
      }

      const results = detector.analyze();
      expect(results[0].severity).toBe("low");
    });

    it("should classify severity as medium for 10-14 queries", () => {
      for (let i = 0; i < 10; i++) {
        detector.logQuery(`SELECT * FROM items WHERE id = ${i}`, 3);
      }

      const results = detector.analyze();
      expect(results[0].severity).toBe("medium");
    });

    it("should classify severity as high for 15-19 queries", () => {
      for (let i = 0; i < 15; i++) {
        detector.logQuery(`SELECT * FROM items WHERE id = ${i}`, 3);
      }

      const results = detector.analyze();
      expect(results[0].severity).toBe("high");
    });

    it("should classify severity as critical for 20+ queries", () => {
      for (let i = 0; i < 25; i++) {
        detector.logQuery(`SELECT * FROM items WHERE id = ${i}`, 3);
      }

      const results = detector.analyze();
      expect(results[0].severity).toBe("critical");
    });

    it("should group queries by normalized pattern", () => {
      // These should all normalize to the same pattern
      detector.logQuery("SELECT * FROM orders WHERE id = 1", 5);
      detector.logQuery("SELECT * FROM orders WHERE id = 2", 5);
      detector.logQuery("SELECT * FROM orders WHERE id = 3", 5);
      detector.logQuery("SELECT * FROM orders WHERE id = 4", 5);
      detector.logQuery("SELECT * FROM orders WHERE id = 5", 5);

      const results = detector.analyze();
      expect(results.length).toBe(1);
      expect(results[0].queryCount).toBe(5);
    });

    it("should include suggestion text", () => {
      for (let i = 0; i < 6; i++) {
        detector.logQuery(`SELECT * FROM items WHERE id = ${i}`, 3);
      }

      const results = detector.analyze();
      expect(results[0].suggestion).toBeDefined();
      expect(results[0].suggestion!.length).toBeGreaterThan(0);
    });

    it("should sort results by query count descending", () => {
      // Group A: 10 queries
      for (let i = 0; i < 10; i++) {
        detector.logQuery(`SELECT * FROM table_a WHERE id = ${i}`, 3);
      }
      // Group B: 20 queries
      for (let i = 0; i < 20; i++) {
        detector.logQuery(`SELECT * FROM table_b WHERE id = ${i}`, 3);
      }

      const results = detector.analyze();
      expect(results[0].queryCount).toBeGreaterThan(results[1].queryCount);
    });
  });

  describe("getStats", () => {
    it("should return query statistics", () => {
      detector.logQuery("SELECT 1", 10);
      detector.logQuery("SELECT 2", 20);

      const stats = detector.getStats();

      expect(stats.totalQueries).toBe(2);
      expect(stats.uniquePatterns).toBeGreaterThanOrEqual(1);
      expect(stats.avgDuration).toBe(15);
    });

    it("should return zero avg duration when no queries", () => {
      const stats = detector.getStats();
      expect(stats.avgDuration).toBe(0);
    });
  });

  describe("clear", () => {
    it("should reset all query logs", () => {
      detector.logQuery("SELECT 1", 5);
      detector.logQuery("SELECT 2", 5);
      expect(detector.getStats().totalQueries).toBe(2);

      detector.clear();

      expect(detector.getStats().totalQueries).toBe(0);
    });
  });

  describe("setEnabled", () => {
    it("should enable detection", () => {
      const d = new N1Detector(false);
      d.setEnabled(true);
      d.logQuery("SELECT 1", 5);
      expect(d.getStats().totalQueries).toBe(1);
    });

    it("should disable detection and clear logs", () => {
      detector.logQuery("SELECT 1", 5);
      detector.setEnabled(false);

      expect(detector.getStats().totalQueries).toBe(0);
    });
  });

  describe("generateReport", () => {
    it("should generate clean report when no issues", () => {
      const report = detector.generateReport();

      expect(report).toContain("N+1 Query Detection Report");
      expect(report).toContain("No N+1 query patterns detected");
      expect(report).toContain("✅");
    });

    it("should include detected issues in report", () => {
      for (let i = 0; i < 6; i++) {
        detector.logQuery(`SELECT * FROM items WHERE id = ${i}`, 3);
      }

      const report = detector.generateReport();

      expect(report).toContain("Detected Issues");
      expect(report).toContain("LOW");
      expect(report).toContain("6 queries");
    });
  });
});

describe("global detector", () => {
  beforeEach(() => {
    resetN1Detector();
  });

  it("getN1Detector should create a singleton", () => {
    const d1 = getN1Detector();
    const d2 = getN1Detector();
    expect(d1).toBe(d2);
  });

  it("resetN1Detector should clear the singleton", () => {
    const d1 = getN1Detector();
    resetN1Detector();
    const d2 = getN1Detector();
    expect(d1).not.toBe(d2);
  });
});

describe("EAGER_LOADING_PATTERNS", () => {
  it("should have documented patterns", () => {
    expect(EAGER_LOADING_PATTERNS.menuWithCategories).toBeDefined();
    expect(EAGER_LOADING_PATTERNS.ordersWithItems).toBeDefined();
    expect(EAGER_LOADING_PATTERNS.restaurantWithSettings).toBeDefined();
    expect(EAGER_LOADING_PATTERNS.batchLoadingPattern).toBeDefined();
  });
});
