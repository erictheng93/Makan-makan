/**
 * Contract Tests for Customers API
 *
 * Validates that customer-facing API responses match their declared Zod
 * schemas. Covers customer profile, orders, registration, and admin
 * customer listing.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetAllFactories } from "@makanmakan/testing-utils";
import { assertMatchesSchema } from "../../../contracts/helpers";
import {
  GetMeResponse,
  GetMyOrdersResponse,
  RegisterCustomerResponse,
  ListCustomersResponse,
} from "../../../contracts/schemas/customers";

describe("Customers API Response Contracts", () => {
  beforeEach(() => {
    resetAllFactories();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Get Me (Customer Profile)
  // -------------------------------------------------------------------------
  describe("GetMeResponse", () => {
    it("should match schema for complete customer profile", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: "cust-001",
          username: "foodlover",
          fullName: "Ali Ahmad",
          name: "Ali",
          email: "ali@example.com",
          phone: "+60123456789",
          role: 5,
          preferences: { dietaryRestrictions: ["halal"], language: "ms" },
          loyaltyPoints: 250,
          totalOrders: 15,
          totalSpent: 450.75,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      assertMatchesSchema(GetMeResponse, mockResponse, "GET /customers/me");
    });

    it("should match schema with nullable optional fields", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: 42,
          role: 5,
          email: null,
          phone: null,
          preferences: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      assertMatchesSchema(
        GetMeResponse,
        mockResponse,
        "GET /customers/me (minimal)",
      );
    });

    it("should match schema with numeric ID", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: 1,
          username: "customer1",
          name: "Test Customer",
          role: 5,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      assertMatchesSchema(
        GetMeResponse,
        mockResponse,
        "GET /customers/me (numeric id)",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Get My Orders
  // -------------------------------------------------------------------------
  describe("GetMyOrdersResponse", () => {
    it("should match schema with orders list and pagination", () => {
      const mockResponse = {
        success: true as const,
        data: [
          {
            id: "ord-001",
            restaurantId: "rest-001",
            status: "completed",
            total: 35.5,
            createdAt: new Date().toISOString(),
          },
          {
            id: "ord-002",
            restaurantId: "rest-001",
            status: "pending",
            total: 22.0,
            createdAt: new Date().toISOString(),
          },
        ],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      };

      assertMatchesSchema(
        GetMyOrdersResponse,
        mockResponse,
        "GET /customers/me/orders",
      );
    });

    it("should match schema with empty orders", () => {
      const mockResponse = {
        success: true as const,
        data: [],
      };

      assertMatchesSchema(
        GetMyOrdersResponse,
        mockResponse,
        "GET /customers/me/orders (empty)",
      );
    });

    it("should match schema without optional pagination", () => {
      const mockResponse = {
        success: true as const,
        data: [
          {
            id: "ord-001",
            total: 35.5,
          },
        ],
      };

      assertMatchesSchema(
        GetMyOrdersResponse,
        mockResponse,
        "GET /customers/me/orders (no pagination)",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Register Customer
  // -------------------------------------------------------------------------
  describe("RegisterCustomerResponse", () => {
    it("should match schema with customer data and token", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: "cust-new",
          username: "newcustomer",
          fullName: "New Customer",
          name: "New",
          email: "new@example.com",
          phone: "+60198765432",
          role: 5,
          loyaltyPoints: 0,
          totalOrders: 0,
          totalSpent: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-token",
      };

      assertMatchesSchema(
        RegisterCustomerResponse,
        mockResponse,
        "POST /customers/register",
      );
    });

    it("should match schema without optional token", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: "cust-new-2",
          username: "guest123",
          role: 5,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      assertMatchesSchema(
        RegisterCustomerResponse,
        mockResponse,
        "POST /customers/register (no token)",
      );
    });
  });

  // -------------------------------------------------------------------------
  // List Customers (Admin)
  // -------------------------------------------------------------------------
  describe("ListCustomersResponse", () => {
    it("should match schema with customers list and meta", () => {
      const mockResponse = {
        success: true as const,
        data: [
          {
            id: "cust-001",
            username: "foodlover",
            fullName: "Ali Ahmad",
            name: "Ali",
            email: "ali@example.com",
            phone: "+60123456789",
            role: 5,
            loyaltyPoints: 250,
            totalOrders: 15,
            totalSpent: 450.75,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: "cust-002",
            username: "dinerguy",
            fullName: "Tan Wei",
            name: "Wei",
            email: "wei@example.com",
            phone: null,
            role: 5,
            loyaltyPoints: 100,
            totalOrders: 8,
            totalSpent: 220.0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        meta: { total: 2, page: 1, pageSize: 20, totalPages: 1 },
      };

      assertMatchesSchema(
        ListCustomersResponse,
        mockResponse,
        "GET /customers",
      );
    });

    it("should match schema without optional meta", () => {
      const mockResponse = {
        success: true as const,
        data: [],
      };

      assertMatchesSchema(
        ListCustomersResponse,
        mockResponse,
        "GET /customers (empty)",
      );
    });

    it("should match schema with minimal customer data", () => {
      const mockResponse = {
        success: true as const,
        data: [
          {
            id: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      assertMatchesSchema(
        ListCustomersResponse,
        mockResponse,
        "GET /customers (minimal)",
      );
    });
  });
});
