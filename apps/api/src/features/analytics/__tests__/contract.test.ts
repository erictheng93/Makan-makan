/**
 * Contract Tests for Analytics API
 *
 * Validates that analytics-related API responses match their declared
 * Zod schemas. Analytics endpoints return flexible data payloads (z.unknown)
 * so these tests primarily validate the envelope structure and any
 * top-level metadata fields like timestamp.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetAllFactories } from "@makanmakan/testing-utils";
import { assertMatchesSchema } from "../../../contracts/helpers";
import {
  DashboardResponse,
  RevenueResponse,
  CustomerAnalyticsResponse,
  RealtimeDashboardResponse,
  FinancialReportResponse,
  OwnerDashboardResponse,
  ProductAnalyticsResponse,
  PerformanceResponse,
} from "../../../contracts/schemas/analytics";

describe("Analytics API Response Contracts", () => {
  beforeEach(() => {
    resetAllFactories();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Dashboard
  // -------------------------------------------------------------------------
  describe("DashboardResponse", () => {
    it("should match schema with dashboard data and timestamp", () => {
      const mockResponse = {
        success: true as const,
        data: {
          totalOrders: 1250,
          totalRevenue: 45000.5,
          averageOrderValue: 36.0,
          topItems: [
            { name: "Nasi Lemak", count: 320 },
            { name: "Roti Canai", count: 285 },
          ],
        },
        timestamp: new Date().toISOString(),
      };

      assertMatchesSchema(
        DashboardResponse,
        mockResponse,
        "GET /analytics/dashboard",
      );
    });

    it("should match schema without optional timestamp", () => {
      const mockResponse = {
        success: true as const,
        data: {
          totalOrders: 0,
          totalRevenue: 0,
        },
      };

      assertMatchesSchema(
        DashboardResponse,
        mockResponse,
        "GET /analytics/dashboard (no timestamp)",
      );
    });

    it("should match schema with numeric timestamp", () => {
      const mockResponse = {
        success: true as const,
        data: { summary: "daily" },
        timestamp: Date.now(),
      };

      assertMatchesSchema(
        DashboardResponse,
        mockResponse,
        "GET /analytics/dashboard (numeric ts)",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Revenue
  // -------------------------------------------------------------------------
  describe("RevenueResponse", () => {
    it("should match schema with revenue data", () => {
      const mockResponse = {
        success: true as const,
        data: {
          daily: [
            { date: "2026-03-30", revenue: 1500.0, orders: 42 },
            { date: "2026-03-29", revenue: 1350.0, orders: 38 },
          ],
          total: 2850.0,
          period: "7d",
        },
      };

      assertMatchesSchema(
        RevenueResponse,
        mockResponse,
        "GET /analytics/revenue",
      );
    });

    it("should match schema with minimal data", () => {
      const mockResponse = {
        success: true as const,
        data: null,
      };

      assertMatchesSchema(
        RevenueResponse,
        mockResponse,
        "GET /analytics/revenue (null data)",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Customer Analytics
  // -------------------------------------------------------------------------
  describe("CustomerAnalyticsResponse", () => {
    it("should match schema with customer analytics data", () => {
      const mockResponse = {
        success: true as const,
        data: {
          newCustomers: 15,
          returningCustomers: 85,
          averageVisitFrequency: 2.3,
          topCustomers: [{ name: "John Doe", totalSpent: 500.0, visits: 12 }],
          retentionRate: 0.72,
        },
      };

      assertMatchesSchema(
        CustomerAnalyticsResponse,
        mockResponse,
        "GET /analytics/customers",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Realtime Dashboard
  // -------------------------------------------------------------------------
  describe("RealtimeDashboardResponse", () => {
    it("should match schema with realtime data and timestamp", () => {
      const mockResponse = {
        success: true as const,
        data: {
          activeOrders: 8,
          activeConnections: 15,
          ordersInQueue: 3,
          averageWaitTime: 12.5,
          tablesOccupied: 20,
          tablesAvailable: 10,
        },
        timestamp: new Date().toISOString(),
      };

      assertMatchesSchema(
        RealtimeDashboardResponse,
        mockResponse,
        "GET /analytics/realtime",
      );
    });

    it("should match schema without optional timestamp", () => {
      const mockResponse = {
        success: true as const,
        data: {
          activeOrders: 0,
          activeConnections: 0,
        },
      };

      assertMatchesSchema(
        RealtimeDashboardResponse,
        mockResponse,
        "GET /analytics/realtime (no timestamp)",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Financial Report
  // -------------------------------------------------------------------------
  describe("FinancialReportResponse", () => {
    it("should match schema with financial report data", () => {
      const mockResponse = {
        success: true as const,
        data: {
          revenue: 120000.0,
          expenses: 45000.0,
          profit: 75000.0,
          taxCollected: 7200.0,
          periodStart: "2026-03-01",
          periodEnd: "2026-03-31",
          breakdown: {
            food: 95000.0,
            beverages: 25000.0,
          },
        },
      };

      assertMatchesSchema(
        FinancialReportResponse,
        mockResponse,
        "GET /analytics/financial-report",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Owner Dashboard
  // -------------------------------------------------------------------------
  describe("OwnerDashboardResponse", () => {
    it("should match schema with owner dashboard data and timestamp", () => {
      const mockResponse = {
        success: true as const,
        data: {
          restaurants: [
            { id: "rest-001", name: "MakanMakan KL", todayRevenue: 3500 },
            { id: "rest-002", name: "MakanMakan PJ", todayRevenue: 2800 },
          ],
          totalRevenue: 6300,
          totalOrders: 180,
        },
        timestamp: new Date().toISOString(),
      };

      assertMatchesSchema(
        OwnerDashboardResponse,
        mockResponse,
        "GET /analytics/owner-dashboard",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Product Analytics
  // -------------------------------------------------------------------------
  describe("ProductAnalyticsResponse", () => {
    it("should match schema with product analytics data", () => {
      const mockResponse = {
        success: true as const,
        data: {
          topSellers: [
            {
              itemId: "item-001",
              name: "Nasi Lemak",
              quantity: 320,
              revenue: 3200,
            },
          ],
          slowMovers: [
            {
              itemId: "item-050",
              name: "Herbal Tea",
              quantity: 5,
              revenue: 25,
            },
          ],
        },
      };

      assertMatchesSchema(
        ProductAnalyticsResponse,
        mockResponse,
        "GET /analytics/products",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Performance
  // -------------------------------------------------------------------------
  describe("PerformanceResponse", () => {
    it("should match schema with performance data", () => {
      const mockResponse = {
        success: true as const,
        data: {
          averageOrderTime: 8.5,
          averagePreparationTime: 12.3,
          peakHours: ["12:00", "13:00", "19:00"],
          staffEfficiency: 0.85,
        },
      };

      assertMatchesSchema(
        PerformanceResponse,
        mockResponse,
        "GET /analytics/performance",
      );
    });
  });
});
