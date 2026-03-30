/**
 * POS API Response Contracts
 */

import { z } from "zod";
import { successEnvelope, TimestampFields } from "../helpers";

// ---------------------------------------------------------------------------
// Entity Schemas
// ---------------------------------------------------------------------------

export const RegisterSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    restaurantId: z.string(),
    name: z.string(),
    status: z.string().optional(),
    ...TimestampFields,
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Response Contracts
// ---------------------------------------------------------------------------

export const CreateRegisterResponse = successEnvelope(RegisterSchema);
export const ListRegistersResponse = successEnvelope(z.array(RegisterSchema));
export const GetRegisterStatusResponse = successEnvelope(z.unknown());
