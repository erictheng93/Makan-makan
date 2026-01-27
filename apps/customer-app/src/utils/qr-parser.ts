/**
 * QR Code 解析工具
 * 支援多種 QR Code 格式：shop, table, seat
 */

export type QRType = "shop" | "table" | "seat";

export interface QRData {
  type: QRType;
  restaurantId: string;
  tableId?: number;
  seatId?: number;
  shopQrCode?: string; // 店家 QR Code (格式: SHOP-{id}-{timestamp})
  source: "json" | "url" | "simple" | "shop";
  raw?: string;
}

/**
 * 解析 QR Code 內容
 * @param content QR Code 掃描結果
 * @returns 解析後的餐廳和桌號/座位資訊
 */
export function parseQRContent(content: string): QRData | null {
  try {
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

    if (data && (typeof data.restaurantId === "number" || typeof data.restaurantId === "string")) {
      const restaurantId = String(data.restaurantId);
      // 新格式：包含 type 字段
      if (data.type === "shop") {
        return {
          type: "shop",
          restaurantId,
          shopQrCode:
            data.shopQrCode || `SHOP-${restaurantId}-${Date.now()}`,
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

    // 標準路徑格式: /restaurant/123/table/5 or /restaurant/S-20250101-001/table/5
    const pathMatch1 = url.pathname.match(/\/restaurant\/([^\/]+)\/table\/(\d+)/);
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
    const pathMatch2 = url.pathname.match(/\/r\/([^\/]+)\/t\/(\d+)/);
    if (pathMatch2) {
      return {
        type: "table",
        restaurantId: pathMatch2[1],
        tableId: parseInt(pathMatch2[2]),
        source: "url",
        raw: content,
      };
    }

    // 店家模式路徑: /restaurant/123/shop
    const shopPathMatch = url.pathname.match(/\/restaurant\/([^\/]+)\/shop/);
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
  // 檢查餐廳 ID
  if (!data.restaurantId || typeof data.restaurantId !== "string" || data.restaurantId.trim() === "") {
    return false;
  }

  // 根據類型驗證
  switch (data.type) {
    case "shop":
      // 店家模式只需要 restaurantId
      return true;

    case "table":
      // 桌子模式需要 tableId
      return (
        typeof data.tableId === "number" &&
        Number.isInteger(data.tableId) &&
        data.tableId > 0
      );

    case "seat":
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
