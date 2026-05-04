/**
 * Partnerships Feature Types
 * 特約商店體系類型定義
 */

import type {
  Partnership,
  PartnershipPlan,
  VerifiedMember,
  PartnershipUsageLog,
  PartnerType,
  VerificationMethod,
  PartnershipStatus,
  MemberType,
  MemberStatus,
  PlanDiscountType,
  UsageLogStatus,
  UsageChannel,
} from "@makanmasak/database";

// 重新導出資料庫類型
export type {
  Partnership,
  PartnershipPlan,
  VerifiedMember,
  PartnershipUsageLog,
  PartnerType,
  VerificationMethod,
  PartnershipStatus,
  MemberType,
  MemberStatus,
  PlanDiscountType,
  UsageLogStatus,
  UsageChannel,
};

// API 特定類型
export interface PartnershipAPIResponse {
  success: boolean;
  data?: Partnership;
  error?: string;
}

export interface PartnershipListAPIResponse {
  success: boolean;
  data?: Partnership[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  error?: string;
}

export interface PlanAPIResponse {
  success: boolean;
  data?: PartnershipPlan;
  error?: string;
}

export interface PlanListAPIResponse {
  success: boolean;
  data?: PartnershipPlan[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  error?: string;
}

export interface MemberAPIResponse {
  success: boolean;
  data?: VerifiedMember;
  message?: string;
  error?: string;
}

export interface MemberListAPIResponse {
  success: boolean;
  data?: VerifiedMember[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  error?: string;
}

export interface UsageLogAPIResponse {
  success: boolean;
  data?: PartnershipUsageLog;
  message?: string;
  error?: string;
}

export interface UsageLogListAPIResponse {
  success: boolean;
  data?: PartnershipUsageLog[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  error?: string;
}

export interface StatisticsAPIResponse {
  success: boolean;
  data?: {
    totalUsageCount: number;
    totalDiscountGiven: number;
    totalRevenue: number;
    uniqueMembers: number;
    averageDiscount: number;
    averageOrderValue: number;
  };
  error?: string;
}

export interface PlanValidationAPIResponse {
  success: boolean;
  data?: {
    valid: boolean;
    plan?: PartnershipPlan;
    error?: string;
    discountAmount?: number;
    finalAmount?: number;
    canCombineWithOthers?: {
      coupons: boolean;
      promotions: boolean;
    };
  };
  error?: string;
}
