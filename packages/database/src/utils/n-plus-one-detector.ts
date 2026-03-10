/**
 * N+1 Query Detection and Prevention Utility
 *
 * Helps detect and prevent N+1 query patterns in the application
 *
 * N+1 Pattern Example:
 * ```
 * // BAD - N+1 Query Pattern
 * const orders = await db.select().from(orders).where(...)
 * for (const order of orders) {
 *   const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id))
 * }
 *
 * // GOOD - Eager Loading
 * const orders = await db.query.orders.findMany({
 *   with: { orderItems: true }
 * })
 * ```
 */

export interface QueryLog {
  query: string;
  duration: number;
  stackTrace: string;
  timestamp: number;
}

export interface N1DetectionResult {
  isN1Pattern: boolean;
  severity: "low" | "medium" | "high" | "critical";
  queryCount: number;
  suggestion?: string;
  affectedQueries: QueryLog[];
}

export class N1Detector {
  private queryLogs: QueryLog[] = [];
  private enabled: boolean;
  private threshold = {
    warning: 5, // Queries in loop > 5 = warning
    critical: 20, // Queries in loop > 20 = critical
  };

  constructor(enabled = false) {
    this.enabled = enabled;
  }

  /**
   * Log a database query for analysis
   */
  logQuery(query: string, duration: number): void {
    if (!this.enabled) return;

    const stackTrace = new Error().stack || "";
    this.queryLogs.push({
      query,
      duration,
      stackTrace,
      timestamp: Date.now(),
    });

    // Keep only last 1000 queries to prevent memory leak
    if (this.queryLogs.length > 1000) {
      this.queryLogs.shift();
    }
  }

  /**
   * Analyze query logs for N+1 patterns
   */
  analyze(): N1DetectionResult[] {
    const results: N1DetectionResult[] = [];
    const queryGroups = this.groupSimilarQueries();

    for (const [pattern, queries] of queryGroups.entries()) {
      if (queries.length >= this.threshold.warning) {
        const result = this.createDetectionResult(pattern, queries);
        results.push(result);
      }
    }

    return results.sort((a, b) => b.queryCount - a.queryCount);
  }

  /**
   * Group similar queries together
   */
  private groupSimilarQueries(): Map<string, QueryLog[]> {
    const groups = new Map<string, QueryLog[]>();

    for (const log of this.queryLogs) {
      // Normalize query by removing specific values
      const pattern = this.normalizeQuery(log.query);

      if (!groups.has(pattern)) {
        groups.set(pattern, []);
      }
      groups.get(pattern)!.push(log);
    }

    return groups;
  }

  /**
   * Normalize query to detect patterns
   */
  private normalizeQuery(query: string): string {
    return query
      .replace(/\d+/g, "?") // Replace numbers with placeholders
      .replace(/'[^']*'/g, "?") // Replace string literals
      .replace(/"[^"]*"/g, "?") // Replace quoted identifiers
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();
  }

  /**
   * Create detection result with severity and suggestions
   */
  private createDetectionResult(
    pattern: string,
    queries: QueryLog[],
  ): N1DetectionResult {
    const queryCount = queries.length;
    let severity: "low" | "medium" | "high" | "critical" = "low";
    let suggestion = "";

    if (queryCount >= this.threshold.critical) {
      severity = "critical";
      suggestion = `CRITICAL: ${queryCount} similar queries detected. This is likely an N+1 query problem. Consider using eager loading with 'with' clause or batch loading with 'inArray'.`;
    } else if (queryCount >= this.threshold.warning * 3) {
      severity = "high";
      suggestion = `HIGH: ${queryCount} similar queries detected. Consider eager loading to reduce database round trips.`;
    } else if (queryCount >= this.threshold.warning * 2) {
      severity = "medium";
      suggestion = `MEDIUM: ${queryCount} similar queries detected. Review if eager loading would be beneficial.`;
    } else {
      severity = "low";
      suggestion = `LOW: ${queryCount} similar queries detected. Monitor if this increases.`;
    }

    return {
      isN1Pattern: queryCount >= this.threshold.warning,
      severity,
      queryCount,
      suggestion,
      affectedQueries: queries,
    };
  }

  /**
   * Get statistics about query patterns
   */
  getStats() {
    const totalQueries = this.queryLogs.length;
    const uniquePatterns = this.groupSimilarQueries().size;
    const avgDuration =
      totalQueries > 0
        ? this.queryLogs.reduce((sum, log) => sum + log.duration, 0) /
          totalQueries
        : 0;

    return {
      totalQueries,
      uniquePatterns,
      avgDuration,
      suspiciousPatterns: this.analyze().filter((r) => r.severity !== "low")
        .length,
    };
  }

  /**
   * Clear query logs
   */
  clear(): void {
    this.queryLogs = [];
  }

  /**
   * Enable/disable detection
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.clear();
    }
  }

  /**
   * Generate report of N+1 patterns
   */
  generateReport(): string {
    const results = this.analyze();
    const stats = this.getStats();

    let report = `
===========================================
N+1 Query Detection Report
===========================================

Statistics:
- Total Queries: ${stats.totalQueries}
- Unique Patterns: ${stats.uniquePatterns}
- Average Duration: ${stats.avgDuration.toFixed(2)}ms
- Suspicious Patterns: ${stats.suspiciousPatterns}

`;

    if (results.length === 0) {
      report += "No N+1 query patterns detected. ✅\n";
    } else {
      report += "Detected Issues:\n\n";
      results.forEach((result, index) => {
        report += `${index + 1}. [${result.severity.toUpperCase()}] ${result.queryCount} queries\n`;
        report += `   ${result.suggestion}\n`;
        report += `   Sample Query: ${result.affectedQueries[0].query.substring(0, 100)}...\n\n`;
      });
    }

    report += "===========================================\n";
    return report;
  }
}

/**
 * Global detector instance
 */
let globalDetector: N1Detector | null = null;

export function getN1Detector(enabled = false): N1Detector {
  if (!globalDetector) {
    globalDetector = new N1Detector(enabled);
  }
  return globalDetector;
}

export function resetN1Detector(): void {
  globalDetector = null;
}

/**
 * Eager Loading Best Practices Documentation
 */
export const EAGER_LOADING_PATTERNS = {
  // Menu with categories and items
  menuWithCategories: `
    const menu = await db.query.restaurants.findFirst({
      where: eq(restaurants.id, restaurantId),
      with: {
        categories: {
          with: {
            menuItems: true
          }
        }
      }
    })
  `,

  // Orders with items and menu details
  ordersWithItems: `
    const orders = await db.query.orders.findMany({
      where: eq(orders.restaurantId, restaurantId),
      with: {
        orderItems: {
          with: {
            menuItem: true
          }
        }
      }
    })
  `,

  // Restaurant with settings
  restaurantWithSettings: `
    const restaurant = await db.query.restaurants.findFirst({
      where: eq(restaurants.id, restaurantId),
      with: {
        settings: true,
        businessHours: true
      }
    })
  `,

  // Batch loading pattern for multiple IDs
  batchLoadingPattern: `
    // Instead of:
    // for (const id of ids) {
    //   await db.select().from(table).where(eq(table.id, id))
    // }

    // Use inArray:
    const results = await db
      .select()
      .from(table)
      .where(inArray(table.id, ids))
  `,
};
