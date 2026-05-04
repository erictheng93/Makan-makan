/**
 * Contract Tests for Integrations API
 *
 * Validates that platform integration API responses match their declared
 * Zod schemas. Note: integration schemas use a looser envelope (no
 * explicit `success` field on some responses, using `.passthrough()`).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetAllFactories } from "@makanmasak/testing-utils";
import { assertMatchesSchema } from "../../../contracts/helpers";
import {
  ListIntegrationsResponse,
  GetIntegrationResponse,
  ConnectIntegrationResponse,
  UpdateIntegrationResponse,
  DisconnectIntegrationResponse,
  WebhookLogsResponse,
} from "../../../contracts/schemas/integrations";

describe("Integrations API Response Contracts", () => {
  beforeEach(() => {
    resetAllFactories();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // List Integrations
  // -------------------------------------------------------------------------
  describe("ListIntegrationsResponse", () => {
    it("should match schema with integrations list", () => {
      const mockResponse = {
        success: true,
        data: [
          {
            id: "int-001",
            restaurantId: "rest-001",
            platform: "grabfood",
            status: "connected",
            config: { apiKey: "***", storeId: "GF-12345" },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: "int-002",
            restaurantId: "rest-001",
            platform: "foodpanda",
            status: "disconnected",
            config: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      assertMatchesSchema(
        ListIntegrationsResponse,
        mockResponse,
        "GET /integrations",
      );
    });

    it("should match schema with empty list", () => {
      const mockResponse = {
        data: [],
      };

      assertMatchesSchema(
        ListIntegrationsResponse,
        mockResponse,
        "GET /integrations (empty)",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Get Integration
  // -------------------------------------------------------------------------
  describe("GetIntegrationResponse", () => {
    it("should match schema for single integration", () => {
      const mockResponse = {
        success: true,
        data: {
          id: "int-001",
          restaurantId: "rest-001",
          platform: "grabfood",
          status: "connected",
          config: {
            apiKey: "***",
            storeId: "GF-12345",
            webhookUrl: "https://api.makanmasak.com/webhooks/grabfood",
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      assertMatchesSchema(
        GetIntegrationResponse,
        mockResponse,
        "GET /integrations/:id",
      );
    });

    it("should match schema without optional fields", () => {
      const mockResponse = {
        data: {
          restaurantId: "rest-001",
          platform: "shopee",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      assertMatchesSchema(
        GetIntegrationResponse,
        mockResponse,
        "GET /integrations/:id (minimal)",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Connect Integration
  // -------------------------------------------------------------------------
  describe("ConnectIntegrationResponse", () => {
    it("should match schema for newly connected integration", () => {
      const mockResponse = {
        success: true,
        data: {
          id: "int-003",
          restaurantId: "rest-001",
          platform: "shopee",
          status: "connected",
          config: { storeId: "SH-67890" },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      assertMatchesSchema(
        ConnectIntegrationResponse,
        mockResponse,
        "POST /integrations/connect",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Update Integration
  // -------------------------------------------------------------------------
  describe("UpdateIntegrationResponse", () => {
    it("should match schema for updated integration", () => {
      const mockResponse = {
        data: {
          id: "int-001",
          restaurantId: "rest-001",
          platform: "grabfood",
          status: "connected",
          config: { apiKey: "***", storeId: "GF-12345-NEW" },
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: new Date().toISOString(),
        },
      };

      assertMatchesSchema(
        UpdateIntegrationResponse,
        mockResponse,
        "PUT /integrations/:id",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Disconnect Integration
  // -------------------------------------------------------------------------
  describe("DisconnectIntegrationResponse", () => {
    it("should match schema for disconnected integration", () => {
      const mockResponse = {
        success: true,
        data: { disconnectedAt: new Date().toISOString() },
      };

      assertMatchesSchema(
        DisconnectIntegrationResponse,
        mockResponse,
        "POST /integrations/:id/disconnect",
      );
    });

    it("should match schema with no data", () => {
      const mockResponse = {
        success: true,
        message: "Integration disconnected",
      };

      assertMatchesSchema(
        DisconnectIntegrationResponse,
        mockResponse,
        "POST /integrations/:id/disconnect (no data)",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Webhook Logs
  // -------------------------------------------------------------------------
  describe("WebhookLogsResponse", () => {
    it("should match schema with webhook logs", () => {
      const mockResponse = {
        success: true,
        data: [
          {
            id: "log-001",
            integrationId: "int-001",
            eventType: "order.created",
            payload: { orderId: "ord-123" },
            statusCode: 200,
            receivedAt: new Date().toISOString(),
          },
          {
            id: "log-002",
            integrationId: "int-001",
            eventType: "order.updated",
            payload: { orderId: "ord-123", status: "completed" },
            statusCode: 200,
            receivedAt: new Date().toISOString(),
          },
        ],
      };

      assertMatchesSchema(
        WebhookLogsResponse,
        mockResponse,
        "GET /integrations/:id/webhook-logs",
      );
    });

    it("should match schema with empty logs", () => {
      const mockResponse = {
        data: [],
      };

      assertMatchesSchema(
        WebhookLogsResponse,
        mockResponse,
        "GET /integrations/:id/webhook-logs (empty)",
      );
    });
  });
});
