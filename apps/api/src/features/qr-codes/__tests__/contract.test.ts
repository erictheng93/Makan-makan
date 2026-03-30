/**
 * Contract Tests for QR Codes API
 *
 * Validates that response shapes match declared Zod schemas.
 * Any schema drift (field added, removed, or renamed) causes a test failure.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetAllFactories } from "@makanmakan/testing-utils";
import { assertMatchesSchema } from "../../../contracts/helpers";
import {
  GenerateQRResponse,
  BulkGenerateResponse,
  ListTemplatesResponse,
  CreateTemplateResponse,
  VerifyShopQRResponse,
} from "../../../contracts/schemas/qr-codes";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function buildMockQRCode(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    restaurantId: "rest-001",
    targetType: "table",
    targetId: 42,
    code: "qr-abc123",
    url: "https://app.makanmakan.com/qr/abc123",
    imageUrl: "https://cdn.makanmakan.com/qr/abc123.png",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function buildMockTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    name: "Default Template",
    config: {
      size: 256,
      color: "#000000",
      backgroundColor: "#FFFFFF",
      logo: true,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("QR Codes API Response Contracts", () => {
  beforeEach(() => {
    resetAllFactories();
    vi.clearAllMocks();
  });

  // =========================================================================
  // Generate QR Code
  // =========================================================================
  describe("Generate QR Response Contract", () => {
    it("should match GenerateQRResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: buildMockQRCode(),
        message: "QR code generated",
      };

      assertMatchesSchema(
        GenerateQRResponse,
        mockResponse,
        "POST /qr/generate",
      );
    });

    it("should accept response without optional message", () => {
      const mockResponse = {
        success: true as const,
        data: buildMockQRCode(),
      };

      assertMatchesSchema(
        GenerateQRResponse,
        mockResponse,
        "POST /qr/generate (no message)",
      );
    });

    it("should accept QR code with null imageUrl", () => {
      const mockResponse = {
        success: true as const,
        data: buildMockQRCode({ imageUrl: null }),
      };

      assertMatchesSchema(
        GenerateQRResponse,
        mockResponse,
        "POST /qr/generate (null imageUrl)",
      );
    });
  });

  // =========================================================================
  // Bulk Generate
  // =========================================================================
  describe("Bulk Generate Response Contract", () => {
    it("should match BulkGenerateResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: {
          generated: 5,
          codes: [
            buildMockQRCode({ id: 1, targetId: 1 }),
            buildMockQRCode({ id: 2, targetId: 2 }),
          ],
        },
        message: "5 QR codes generated",
      };

      assertMatchesSchema(BulkGenerateResponse, mockResponse, "POST /qr/bulk");
    });

    it("should accept response without message", () => {
      const mockResponse = {
        success: true as const,
        data: {
          generated: 0,
          codes: [],
        },
      };

      assertMatchesSchema(
        BulkGenerateResponse,
        mockResponse,
        "POST /qr/bulk (empty)",
      );
    });
  });

  // =========================================================================
  // List Templates
  // =========================================================================
  describe("List Templates Response Contract", () => {
    it("should match ListTemplatesResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: [
          buildMockTemplate(),
          buildMockTemplate({ id: 2, name: "Branded Template" }),
        ],
      };

      assertMatchesSchema(
        ListTemplatesResponse,
        mockResponse,
        "GET /qr/templates",
      );
    });

    it("should accept empty templates list", () => {
      const mockResponse = {
        success: true as const,
        data: [],
      };

      assertMatchesSchema(
        ListTemplatesResponse,
        mockResponse,
        "GET /qr/templates (empty)",
      );
    });
  });

  // =========================================================================
  // Create Template
  // =========================================================================
  describe("Create Template Response Contract", () => {
    it("should match CreateTemplateResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: buildMockTemplate({ id: 99, name: "New Template" }),
        message: "Template created",
      };

      assertMatchesSchema(
        CreateTemplateResponse,
        mockResponse,
        "POST /qr/templates",
      );
    });

    it("should accept response without optional message", () => {
      const mockResponse = {
        success: true as const,
        data: buildMockTemplate(),
      };

      assertMatchesSchema(
        CreateTemplateResponse,
        mockResponse,
        "POST /qr/templates (no message)",
      );
    });

    it("should accept template without config", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: 1,
          name: "Minimal Template",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      assertMatchesSchema(
        CreateTemplateResponse,
        mockResponse,
        "POST /qr/templates (no config)",
      );
    });
  });

  // =========================================================================
  // Verify Shop QR
  // =========================================================================
  describe("Verify Shop QR Response Contract", () => {
    it("should match VerifyShopQRResponse schema for valid QR", () => {
      const mockResponse = {
        success: true as const,
        data: {
          valid: true,
          restaurantId: "rest-001",
          restaurant: {
            id: "rest-001",
            name: "Test Restaurant",
            isActive: true,
          },
        },
      };

      assertMatchesSchema(
        VerifyShopQRResponse,
        mockResponse,
        "POST /qr/verify-shop",
      );
    });

    it("should match VerifyShopQRResponse schema for invalid QR", () => {
      const mockResponse = {
        success: true as const,
        data: {
          valid: false,
        },
      };

      assertMatchesSchema(
        VerifyShopQRResponse,
        mockResponse,
        "POST /qr/verify-shop (invalid)",
      );
    });

    it("should accept response without optional restaurant data", () => {
      const mockResponse = {
        success: true as const,
        data: {
          valid: true,
          restaurantId: "rest-001",
        },
      };

      assertMatchesSchema(
        VerifyShopQRResponse,
        mockResponse,
        "POST /qr/verify-shop (no restaurant data)",
      );
    });
  });
});
