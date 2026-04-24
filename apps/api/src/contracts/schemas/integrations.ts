/**
 * Integrations API Response Contracts
 */

import { z } from "zod";
import { TimestampFields } from "../helpers";

// ---------------------------------------------------------------------------
// Entity Schemas
// ---------------------------------------------------------------------------

export const IntegrationSchema = z
  .object({
    id: z.union([z.number(), z.string()]).optional(),
    restaurantId: z.string(),
    platform: z.string(),
    status: z.string().optional(),
    config: z.unknown().optional(),
    ...TimestampFields,
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Response Contracts
// ---------------------------------------------------------------------------

export const ListIntegrationsResponse = z
  .object({
    data: z.array(IntegrationSchema),
  })
  .passthrough();

export const GetIntegrationResponse = z
  .object({
    data: IntegrationSchema,
  })
  .passthrough();

export const ConnectIntegrationResponse = z
  .object({
    data: IntegrationSchema,
  })
  .passthrough();

export const UpdateIntegrationResponse = z
  .object({
    data: IntegrationSchema,
  })
  .passthrough();

export const DisconnectIntegrationResponse = z
  .object({
    data: z.unknown().optional(),
  })
  .passthrough();

export const WebhookLogsResponse = z
  .object({
    data: z.array(z.unknown()),
  })
  .passthrough();
