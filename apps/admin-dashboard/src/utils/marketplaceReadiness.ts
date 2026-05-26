export type MarketplaceReadinessIssueKey =
  | "location"
  | "fulfillment"
  | "shopMode"
  | "contact"
  | "faq"
  | "market";

export interface MarketplaceReadinessInput {
  city?: string | null;
  district?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  takeawayEnabled?: boolean;
  shopModeEnabled?: boolean;
  shopQrCode?: string | null;
  contactChannelCount?: number;
  activeFaqCount?: number;
  marketMembershipCount?: number;
}

export interface MarketplaceReadinessIssue {
  key: MarketplaceReadinessIssueKey;
  severity: "required" | "recommended";
}

export interface MarketplaceReadinessResult {
  score: number;
  ready: boolean;
  completedCount: number;
  totalCount: number;
  issues: MarketplaceReadinessIssue[];
}

export function evaluateMarketplaceReadiness(
  input: MarketplaceReadinessInput,
): MarketplaceReadinessResult {
  const checks = [
    {
      key: "location" as const,
      severity: "required" as const,
      passed:
        hasText(input.city) &&
        hasText(input.district) &&
        hasText(input.address) &&
        typeof input.latitude === "number" &&
        typeof input.longitude === "number",
    },
    {
      key: "fulfillment" as const,
      severity: "required" as const,
      passed: input.takeawayEnabled === true,
    },
    {
      key: "shopMode" as const,
      severity: "required" as const,
      passed: input.shopModeEnabled === true && hasText(input.shopQrCode),
    },
    {
      key: "contact" as const,
      severity: "recommended" as const,
      passed: (input.contactChannelCount ?? 0) > 0,
    },
    {
      key: "faq" as const,
      severity: "recommended" as const,
      passed: (input.activeFaqCount ?? 0) > 0,
    },
    {
      key: "market" as const,
      severity: "required" as const,
      passed: (input.marketMembershipCount ?? 0) > 0,
    },
  ];

  const completedCount = checks.filter((check) => check.passed).length;
  const issues = checks
    .filter((check) => !check.passed)
    .map(({ key, severity }) => ({ key, severity }));

  return {
    score: Math.round((completedCount / checks.length) * 100),
    ready: issues.every((issue) => issue.severity !== "required"),
    completedCount,
    totalCount: checks.length,
    issues,
  };
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}
