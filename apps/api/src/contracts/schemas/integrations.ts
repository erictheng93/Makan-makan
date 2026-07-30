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
  .loose();

// ---------------------------------------------------------------------------
// Response Contracts
// ---------------------------------------------------------------------------

export const ListIntegrationsResponse = z
  .object({
    data: z.array(IntegrationSchema),
  })
  .loose();

export const GetIntegrationResponse = z
  .object({
    data: IntegrationSchema,
  })
  .loose();

export const ConnectIntegrationResponse = z
  .object({
    data: IntegrationSchema,
  })
  .loose();

export const UpdateIntegrationResponse = z
  .object({
    data: IntegrationSchema,
  })
  .loose();

export const DisconnectIntegrationResponse = z
  .object({
    data: z.unknown().optional(),
  })
  .loose();

export const WebhookLogsResponse = z
  .object({
    data: z.array(z.unknown()),
  })
  .loose();
