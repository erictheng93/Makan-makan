/**
 * Group Orders API Response Contracts
 */

import { z } from "zod";
import {
  successEnvelope,
  messageOnlyResponse,
  TimestampFields,
} from "../helpers";

// ---------------------------------------------------------------------------
// Entity Schemas
// ---------------------------------------------------------------------------

export const GroupOrderSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    restaurantId: z.string(),
    hostId: z.union([z.number(), z.string()]).optional(),
    shareCode: z.string().optional(),
    status: z.string(),
    ...TimestampFields,
  })
  .loose();

export const GroupMemberSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    groupOrderId: z.union([z.number(), z.string()]),
    name: z.string().optional(),
    ...TimestampFields,
  })
  .loose();

export const CartItemSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    menuItemId: z.union([z.number(), z.string()]),
    name: z.string().optional(),
    quantity: z.number(),
    price: z.number().optional(),
  })
  .loose();

// ---------------------------------------------------------------------------
// Response Contracts
// ---------------------------------------------------------------------------

export const ListGroupOrdersResponse = successEnvelope(
  z.array(GroupOrderSchema),
);

export const GenerateShareCodeResponse = successEnvelope(
  z.object({
    shareCode: z.string(),
    shareUrl: z.string().optional(),
    expiresAt: z.union([z.string(), z.number()]).optional(),
  }),
);

export const CreateGroupOrderResponse = successEnvelope(GroupOrderSchema);

export const JoinGroupResponse = successEnvelope(
  z.object({
    groupOrder: GroupOrderSchema,
    member: GroupMemberSchema,
  }),
);

export const GetGroupOrderResponse = successEnvelope(GroupOrderSchema);

export const AddCartItemResponse = successEnvelope(CartItemSchema);
export const UpdateCartItemResponse = successEnvelope(CartItemSchema);
export const RemoveCartItemResponse = messageOnlyResponse;

export const SplitBillResponse = successEnvelope(z.unknown());
export const ProcessPaymentResponse = successEnvelope(z.unknown());
export const LeaveGroupResponse = messageOnlyResponse;
export const GetActivitiesResponse = successEnvelope(z.array(z.unknown()));
export const GroupStatsResponse = successEnvelope(z.unknown());
