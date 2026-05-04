/**
 * Contract Tests for POS API
 *
 * Validates that response shapes match declared Zod schemas.
 * Any schema drift (field added, removed, or renamed) causes a test failure.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetAllFactories } from "@makanmasak/testing-utils";
import { assertMatchesSchema } from "../../../contracts/helpers";
import {
  CreateRegisterResponse,
  ListRegistersResponse,
} from "../../../contracts/schemas/pos";

describe("POS API Response Contracts", () => {
  beforeEach(() => {
    resetAllFactories();
    vi.clearAllMocks();
  });

  // =========================================================================
  // Create Register
  // =========================================================================
  describe("Create Register Response Contract", () => {
    it("should match CreateRegisterResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: 1,
          restaurantId: "rest-001",
          name: "Main Register",
          status: "open",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      assertMatchesSchema(
        CreateRegisterResponse,
        mockResponse,
        "POST /pos/registers",
      );
    });

    it("should accept register with string id", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: "reg-uuid-001",
          restaurantId: "rest-001",
          name: "Counter Register",
          status: "closed",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      assertMatchesSchema(
        CreateRegisterResponse,
        mockResponse,
        "POST /pos/registers (string id)",
      );
    });
  });

  // =========================================================================
  // List Registers
  // =========================================================================
  describe("List Registers Response Contract", () => {
    it("should match ListRegistersResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: [
          {
            id: 1,
            restaurantId: "rest-001",
            name: "Main Register",
            status: "open",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: 2,
            restaurantId: "rest-001",
            name: "Bar Register",
            status: "closed",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      assertMatchesSchema(
        ListRegistersResponse,
        mockResponse,
        "GET /pos/registers",
      );
    });

    it("should accept empty registers list", () => {
      const mockResponse = {
        success: true as const,
        data: [],
      };

      assertMatchesSchema(
        ListRegistersResponse,
        mockResponse,
        "GET /pos/registers (empty)",
      );
    });

    it("should accept register without optional status", () => {
      const mockResponse = {
        success: true as const,
        data: [
          {
            id: 1,
            restaurantId: "rest-001",
            name: "Register 1",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      assertMatchesSchema(
        ListRegistersResponse,
        mockResponse,
        "GET /pos/registers (no status)",
      );
    });
  });
});
