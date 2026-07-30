/**
 * QR Code 解析工具
 * 支援多種 QR Code 格式：market, shop, table, seat
 */

import { parseSignedQRUrl } from "@makanmakan/utils";

export type QRType = "market" | "shop" | "table" | "seat";

interface BaseQRData {
  restaurantId: string;
  source: "json" | "url" | "simple" | "shop" | "market";
  raw?: string;
}

export interface MarketQRData {
  type: "market";
  marketSlug: string;
  marketUrl?: string;
  source: "json" | "url" | "market";
  raw?: string;
}

export interface ShopQRData extends BaseQRData {
  type: "shop";
  shopQrCode?: string; // 店家 QR Code (格式: SHOP-{id}-{timestamp})
}

export interface TableQRData extends BaseQRData {
  type: "table";
  tableId?: number;
  tableNumber?: string;
  formatVersion?: 2;
}

export interface SeatQRData extends BaseQRData {
  type: "seat";
  tableId?: number;
  seatId?: number;
  seatNumber?: string;
  formatVersion?: 2;
}

export type QRData = MarketQRData | ShopQRData | TableQRData | SeatQRData;

/**
 * 解析 QR Code 內容
 * @param content QR Code 掃描結果
 * @returns 解析後的餐廳和桌號/座位資訊
 */
export function parseQRContent(content: string): QRData | null {
  try {
    // 優先檢查市場 QR Code (格式: MARKET-{slug})
    const marketResult = parseMarketQRFormat(content);
    if (marketResult) {
      return marketResult;
    }

    // 優先檢查店家 QR Code (格式: SHOP-{id}-{timestamp})
    const shopResult = parseShopQRFormat(content);
    if (shopResult) {
      return shopResult;
    }

    // 嘗試解析 JSON 格式
    const jsonResult = parseJSONFormat(content);
    if (jsonResult) {
      return jsonResult;
    }

    // 嘗試解析 URL 格式
    const urlResult = parseURLFormat(content);
    if (urlResult) {
      return urlResult;
    }

    // 嘗試解析簡單格式
    const simpleResult = parseSimpleFormat(content);
    if (simpleResult) {
      return simpleResult;
    }

    return null;
  } catch (error) {
    console.error("Failed to parse QR content:", error);
    return null;
  }
}

/**
 * 解析市場級別 QR Code
 * 格式: MARKET-{marketSlug}
 * 例如: MARKET-fengjia-night-market
 */
function parseMarketQRFormat(content: string): QRData | null {
  const marketQrMatch = content.match(/^MARKET-([a-z0-9]+(?:-[a-z0-9]+)*)$/);

  if (marketQrMatch) {
    return {
      type: "market",
      marketSlug: marketQrMatch[1],
      marketUrl: `/markets/${marketQrMatch[1]}`,
      source: "market",
      raw: content,
    };
  }

  return null;
}

/**
 * 解析店家級別 QR Code
 * 格式: SHOP-{restaurantId}-{timestamp}
 * 例如: SHOP-1-1760068334
 */
function parseShopQRFormat(content: string): QRData | null {
  const shopQrMatch = content.match(/^SHOP-(\d+)-(\d+)$/);

  if (shopQrMatch) {
    return {
      type: "shop",
      restaurantId: shopQrMatch[1],
      shopQrCode: content,
      source: "shop",
      raw: content,
    };
  }

  return null;
}

/**
 * 解析 JSON 格式 QR Code
 * 格式: {"type": "table", "restaurantId": 123, "tableId": 5}
 * 格式: {"restaurantId": 123, "tableId": 5} (向後兼容)
 */
function parseJSONFormat(content: string): QRData | null {
  try {
    const data = JSON.parse(content);

    if (data?.type === "market") {
      const marketSlug =
        typeof data.marketSlug === "string"
          ? data.marketSlug
          : typeof data.slug === "string"
            ? data.slug
            : undefined;

      if (marketSlug) {
        return {
          type: "market",
          marketSlug,
          marketUrl: `/markets/${marketSlug}`,
          source: "json",
          raw: content,
        };
      }
    }

    if (
      data &&
      (typeof data.restaurantId === "number" ||
        typeof data.restaurantId === "string")
    ) {
      const restaurantId = String(data.restaurantId);
      // 新格式：包含 type 字段
      if (data.type === "shop") {
        return {
          type: "shop",
          restaurantId,
          shopQrCode: data.shopQrCode || `SHOP-${restaurantId}-${Date.now()}`,
          source: "json",
          raw: content,
        };
      }

      if (data.type === "seat" && typeof data.seatId === "number") {
        return {
          type: "seat",
          restaurantId,
          tableId: data.tableId,
          seatId: data.seatId,
          source: "json",
          raw: content,
        };
      }

      // 向後兼容：沒有 type 字段，預設為 table
      if (typeof data.tableId === "number") {
        return {
          type: "table",
          restaurantId,
          tableId: data.tableId,
          source: "json",
          raw: content,
        };
      }
    }
  } catch {
    // 不是 JSON 格式，繼續嘗試其他格式
  }

  return null;
}

/**
 * 解析 URL 格式 QR Code
 * 格式: https://makanmakan.app/restaurant/123/table/5
 * 格式: https://domain.com/r/123/t/5
 * 格式: https://domain.com/menu?restaurant=123&table=5
 */
function parseURLFormat(content: string): QRData | null {
  try {
    const url = new URL(content);
    const signedPayload = parseSignedQRUrl(content);

    if (signedPayload) {
      if (signedPayload.type === "seat") {
        return {
          type: "seat",
          restaurantId: signedPayload.restaurantId,
          tableId: signedPayload.tableId,
          seatNumber: signedPayload.identifier,
          formatVersion: signedPayload.formatVersion,
          source: "url",
          raw: content,
        };
      }

      return {
        type: "table",
        restaurantId: signedPayload.restaurantId,
        tableId: signedPayload.tableId,
        tableNumber: signedPayload.identifier,
        formatVersion: signedPayload.formatVersion,
        source: "url",
        raw: content,
      };
    }

    // 簽名 URL 格式: /order?t=table&r={restaurantId}&n={identifier}&v=1&sig=...
    const sig = url.searchParams.get("sig");
    const qrType = url.searchParams.get("t");
    const restaurantId = url.searchParams.get("r");
    const identifier = url.searchParams.get("n");

    if (sig && qrType === "market") {
      const signedMarketSlug =
        url.searchParams.get("m") || url.searchParams.get("slug");
      if (signedMarketSlug) {
        return {
          type: "market",
          marketSlug: signedMarketSlug,
          marketUrl: `/markets/${signedMarketSlug}`,
          source: "url",
          raw: content,
        };
      }
    }

    if (sig && qrType && restaurantId && identifier) {
      if (qrType === "shop") {
        return {
          type: "shop",
          restaurantId,
          shopQrCode: content,
          source: "url",
          raw: content,
        };
      }
      if (qrType === "seat") {
        return {
          type: "seat",
          restaurantId,
          seatId: parseInt(identifier, 10) || undefined,
          source: "url",
          raw: content,
        };
      }
      // Default: table type
      return {
        type: "table",
        restaurantId,
        source: "url",
        raw: content,
      };
    }

    // 標準路徑格式: /restaurant/123/table/5 or /restaurant/S-20250101-001/table/5
    const pathMatch1 = url.pathname.match(
      /\/restaurant\/([^/]+)\/table\/(\d+)/,
    );
    if (pathMatch1) {
      return {
        type: "table",
        restaurantId: pathMatch1[1],
        tableId: parseInt(pathMatch1[2]),
        source: "url",
        raw: content,
      };
    }

    // 簡短路徑格式: /r/123/t/5
    const pathMatch2 = url.pathname.match(/\/r\/([^/]+)\/t\/(\d+)/);
    if (pathMatch2) {
      return {
        type: "table",
        restaurantId: pathMatch2[1],
        tableId: parseInt(pathMatch2[2]),
        source: "url",
        raw: content,
      };
    }

    // 市場模式路徑: /markets/fengjia-night-market
    const marketPathMatch = url.pathname.match(
      /^\/markets\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/,
    );
    if (marketPathMatch) {
      return {
        type: "market",
        marketSlug: marketPathMatch[1],
        marketUrl: `/markets/${marketPathMatch[1]}`,
        source: "url",
        raw: content,
      };
    }

    // 店家模式路徑: /restaurant/123/shop
    const shopPathMatch = url.pathname.match(/\/restaurant\/([^/]+)\/shop/);
    if (shopPathMatch) {
      return {
        type: "shop",
        restaurantId: shopPathMatch[1],
        source: "url",
        raw: content,
      };
    }

    // 查詢參數格式: ?restaurant=123&table=5
    const restaurantParam =
      url.searchParams.get("restaurant") || url.searchParams.get("r");
    const tableParam =
      url.searchParams.get("table") || url.searchParams.get("t");

    if (restaurantParam && tableParam) {
      const tableId = parseInt(tableParam);

      if (!isNaN(tableId)) {
        return {
          type: "table",
          restaurantId: restaurantParam,
          tableId,
          source: "url",
          raw: content,
        };
      }
    }
  } catch {
    // 不是有效的 URL
  }

  return null;
}

/**
 * 解析簡單格式 QR Code
 * 格式: "123:5" (restaurantId:tableId)
 * 格式: "R123T5"
 * 格式: "123-5"
 */
function parseSimpleFormat(content: string): QRData | null {
  // 格式: "123:5"
  const colonMatch = content.match(/^(\d+):(\d+)$/);
  if (colonMatch) {
    return {
      type: "table",
      restaurantId: colonMatch[1],
      tableId: parseInt(colonMatch[2]),
      source: "simple",
      raw: content,
    };
  }

  // 格式: "R123T5"
  const rtMatch = content.match(/^R(\d+)T(\d+)$/i);
  if (rtMatch) {
    return {
      type: "table",
      restaurantId: rtMatch[1],
      tableId: parseInt(rtMatch[2]),
      source: "simple",
      raw: content,
    };
  }

  // 格式: "123-5"
  const dashMatch = content.match(/^(\d+)-(\d+)$/);
  if (dashMatch) {
    return {
      type: "table",
      restaurantId: dashMatch[1],
      tableId: parseInt(dashMatch[2]),
      source: "simple",
      raw: content,
    };
  }

  return null;
}

/**
 * 驗證 QR 資料的有效性
 */
export function validateQRData(data: QRData): boolean {
  if (data.type === "market") {
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.marketSlug);
  }

  // 檢查餐廳 ID
  if (
    !data.restaurantId ||
    typeof data.restaurantId !== "string" ||
    data.restaurantId.trim() === ""
  ) {
    return false;
  }

  // 根據類型驗證
  switch (data.type) {
    case "shop":
      // 店家模式只需要 restaurantId
      return true;

    case "table":
      if (data.formatVersion !== undefined) {
        // Signed URLs are v2-only since #88 phase 3: the table id is always
        // present and bound into the signature.
        return (
          typeof data.tableNumber === "string" &&
          data.tableNumber.trim() !== "" &&
          typeof data.tableId === "number" &&
          Number.isInteger(data.tableId) &&
          data.tableId > 0
        );
      }
      // 桌子模式需要 tableId
      return (
        typeof data.tableId === "number" &&
        Number.isInteger(data.tableId) &&
        data.tableId > 0
      );

    case "seat":
      if (data.formatVersion !== undefined) {
        // Signed URLs are v2-only since #88 phase 3.
        return (
          typeof data.seatNumber === "string" &&
          data.seatNumber.trim() !== "" &&
          typeof data.tableId === "number" &&
          Number.isInteger(data.tableId) &&
          data.tableId > 0
        );
      }
      // 座位模式需要 tableId 和 seatId
      return (
        typeof data.tableId === "number" &&
        typeof data.seatId === "number" &&
        Number.isInteger(data.tableId) &&
        Number.isInteger(data.seatId) &&
        data.tableId > 0 &&
        data.seatId > 0
      );

    default:
      return false;
  }
}

/**
 * 生成 QR Code 內容（用於測試或管理）
 */
export function generateQRContent(
  type: QRType,
  restaurantId: string,
  options?: {
    tableId?: number;
    seatId?: number;
    shopQrCode?: string;
    format?: "json" | "url" | "simple" | "shop";
  },
): string {
  const format = options?.format || "json";

  switch (type) {
    case "market":
      if (format === "url") {
        return `https://makanmakan.app/markets/${restaurantId}`;
      }
      if (format === "simple" || format === "shop") {
        return `MARKET-${restaurantId}`;
      }
      return JSON.stringify({
        type: "market",
        marketSlug: restaurantId,
      });

    case "shop":
      if (format === "shop" || format === "simple") {
        return (
          options?.shopQrCode ||
          `SHOP-${restaurantId}-${Math.floor(Date.now() / 1000)}`
        );
      }
      return JSON.stringify({
        type: "shop",
        restaurantId,
        shopQrCode:
          options?.shopQrCode ||
          `SHOP-${restaurantId}-${Math.floor(Date.now() / 1000)}`,
      });

    case "table": {
      const tableId = options?.tableId || 0;
      switch (format) {
        case "json":
          return JSON.stringify({ type: "table", restaurantId, tableId });
        case "url":
          return `https://makanmakan.app/restaurant/${restaurantId}/table/${tableId}`;
        case "simple":
          return `${restaurantId}:${tableId}`;
        default:
          return JSON.stringify({ type: "table", restaurantId, tableId });
      }
    }

    case "seat": {
      const seatTableId = options?.tableId || 0;
      const seatId = options?.seatId || 0;
      return JSON.stringify({
        type: "seat",
        restaurantId,
        tableId: seatTableId,
        seatId,
      });
    }

    default:
      return JSON.stringify({ type, restaurantId });
  }
}

/**
 * 獲取 QR Code 類型描述
 */
export function getQRTypeDescription(type: QRType): string {
  switch (type) {
    case "market":
      return "夜市／商圈 QR Code";
    case "shop":
      return "店家級別 QR Code（無桌號點餐）";
    case "table":
      return "桌台 QR Code";
    case "seat":
      return "座位 QR Code";
    default:
      return "未知類型";
  }
}

/**
 * 獲取 QR Code 格式描述
 */
export function getQRFormatDescription(source: QRData["source"]): string {
  switch (source) {
    case "market":
      return "市場 QR 格式 (MARKET-SLUG)";
    case "shop":
      return "店家 QR 格式 (SHOP-ID-TIMESTAMP)";
    case "json":
      return "JSON 格式";
    case "url":
      return "URL 連結格式";
    case "simple":
      return "簡單文字格式";
    default:
      return "未知格式";
  }
}
