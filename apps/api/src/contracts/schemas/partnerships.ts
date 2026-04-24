/**
 * Partnerships API Response Contracts
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

export const PartnershipSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    restaurantId: z.string(),
    partnerName: z.string().optional(),
    organizationName: z.string().optional(),
    status: z.string(),
    ...TimestampFields,
  })
  .passthrough();

export const PlanSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    partnershipId: z.union([z.number(), z.string()]).optional(),
    name: z.string(),
    discountType: z.string().optional(),
    discountValue: z.number().optional(),
    ...TimestampFields,
  })
  .passthrough();

export const MemberSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    partnershipId: z.union([z.number(), z.string()]).optional(),
    name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    status: z.string(),
    ...TimestampFields,
  })
  .passthrough();

export const UsageLogSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    memberId: z.union([z.number(), z.string()]).optional(),
    amount: z.number().optional(),
    ...TimestampFields,
  })
  .passthrough();

// ---------------------------------------------------------------------------
// Response Contracts
// ---------------------------------------------------------------------------

export const CreatePartnershipResponse = successEnvelope(PartnershipSchema);
export const ListPartnershipsResponse = z
  .object({
    success: z.literal(true),
    data: z.array(PartnershipSchema),
  })
  .passthrough();
export const GetPartnershipResponse = successEnvelope(PartnershipSchema);
export const UpdatePartnershipResponse = successEnvelope(PartnershipSchema);
export const DeletePartnershipResponse = messageOnlyResponse;
export const PartnershipStatsResponse = successEnvelope(z.unknown());

export const CreatePlanResponse = successEnvelope(PlanSchema);
export const ListPlansResponse = z
  .object({
    success: z.literal(true),
    data: z.array(PlanSchema),
  })
  .passthrough();
export const GetPlanResponse = successEnvelope(PlanSchema);
export const ValidatePlanResponse = successEnvelope(z.unknown());

export const VerifyMemberResponse = successWithMessage(MemberSchema);
export const ListMembersResponse = z
  .object({
    success: z.literal(true),
    data: z.array(MemberSchema),
  })
  .passthrough();
export const ApproveMemberResponse = successWithMessage(MemberSchema);
export const RejectMemberResponse = successWithMessage(MemberSchema);

export const LogUsageResponse = successWithMessage(UsageLogSchema);
export const ListUsageResponse = z
  .object({
    success: z.literal(true),
    data: z.array(UsageLogSchema),
  })
  .passthrough();
