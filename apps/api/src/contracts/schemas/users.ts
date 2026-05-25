/**
 * Users API Response Contracts
 */

import { z } from "zod";
import {
  successEnvelope,
  messageOnlyResponse,
  PaginationMetaSchema,
  TimestampFields,
} from "../helpers";

// ---------------------------------------------------------------------------
// Entity Schemas
// ---------------------------------------------------------------------------

export const UserSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    email: z.string().optional(),
    username: z.string().optional(),
    name: z.string().optional(),
    fullName: z.string().optional(),
    role: z.number().int().min(0).max(4),
    restaurantId: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    avatar: z.string().optional().nullable(),
    isActive: z.union([z.boolean(), z.number()]).optional(),
    ...TimestampFields,
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Response Contracts
// ---------------------------------------------------------------------------

export const ListUsersResponse = z
  .object({
    success: z.literal(true),
    data: z.array(UserSchema).optional(),
    meta: PaginationMetaSchema.optional(),
  })
  .passthrough();

export const GetUserResponse = successEnvelope(UserSchema);
export const CreateUserResponse = successEnvelope(UserSchema);
export const UpdateUserResponse = successEnvelope(UserSchema);
export const DeleteUserResponse = messageOnlyResponse;
export const ChangePasswordResponse = messageOnlyResponse;

export const UserStatsResponse = successEnvelope(
  z
    .object({
      totalUsers: z.number().optional(),
      activeUsers: z.number().optional(),
    })
    .passthrough(),
);

export const USER_SENSITIVE_FIELDS = [
  "password",
  "passwordHash",
  "hashedPassword",
  "salt",
];
