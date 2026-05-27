export type MarketPublicReadinessIssueKey =
  | "description"
  | "location"
  | "openingHours"
  | "image"
  | "vendors"
  | "products"
  | "services";

export interface MarketPublicReadinessIssue {
  key: MarketPublicReadinessIssueKey;
  severity: "required" | "recommended";
}

export interface MarketPublicReadiness {
  ready: boolean;
  score: number;
  completedCount: number;
  totalCount: number;
  issues: MarketPublicReadinessIssue[];
}

export function marketPublicReadinessSummary(
  readiness: MarketPublicReadiness | undefined,
) {
  if (!readiness) {
    return {
      tone: "unknown" as const,
      text: "公開頁完整度未知",
    };
  }

  if (readiness.ready) {
    return {
      tone: "ready" as const,
      text: "公開頁可上架",
    };
  }

  return {
    tone: "blocked" as const,
    text: `公開頁完整度 ${readiness.score}%`,
  };
}

export function publicReadinessIssueLabel(key: MarketPublicReadinessIssueKey) {
  const labels: Record<MarketPublicReadinessIssueKey, string> = {
    description: "缺少市場描述",
    location: "缺少地址或座標",
    openingHours: "缺少營業時間",
    image: "建議補上圖片",
    vendors: "尚未加入店鋪",
    products: "尚無可搜尋商品或服務",
    services: "建議補上公開服務",
  };

  return labels[key];
}
