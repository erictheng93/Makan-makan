/**
 * QR Codes API Response Contracts
 */

import { z } from "zod";
import {
  successEnvelope,
  successWithMessage,
  messageOnlyResponse,
  TimestampFields,
} from "../helpers";

// ---------------------------------------------------------------------------
// Entity Schemas
// ---------------------------------------------------------------------------

export const QRCodeSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    restaurantId: z.string().optional(),
    targetType: z.string().optional(),
    targetId: z.union([z.number(), z.string()]).optional(),
    code: z.string().optional(),
    url: z.string().optional(),
    imageUrl: z.string().optional().nullable(),
    ...TimestampFields,
  })
  .passthrough();

export const QRTemplateSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    name: z.string(),
    config: z.unknown().optional(),
    ...TimestampFields,
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Response Contracts
// ---------------------------------------------------------------------------

export const GenerateQRResponse = successWithMessage(QRCodeSchema);
export const BulkGenerateResponse = successWithMessage(z.unknown());
export const GetQRStatsResponse = successEnvelope(z.unknown());

export const ListTemplatesResponse = successEnvelope(z.array(QRTemplateSchema));
export const GetTemplateResponse = successEnvelope(QRTemplateSchema);
export const CreateTemplateResponse = successWithMessage(QRTemplateSchema);
export const UpdateTemplateResponse = successWithMessage(QRTemplateSchema);
export const DeleteTemplateResponse = messageOnlyResponse;

export const VerifyShopQRResponse = successEnvelope(
  z
    .object({
      valid: z.boolean(),
      restaurantId: z.string().optional(),
      restaurant: z.unknown().optional(),
    })
    .passthrough(),
);
