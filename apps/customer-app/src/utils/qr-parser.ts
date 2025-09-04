/**
 * QR Code 解析工具
 * 支援多種 QR Code 格式
 */

export interface QRData {
  restaurantId: number;
  tableId: number;
  source: "json" | "url" | "simple";
  raw?: string;
}

/**
 * 解析 QR Code 內容
 * @param content QR Code 掃描結果
 * @returns 解析後的餐廳和桌號資訊
 */
export function parseQRContent(content: string): QRData | null {
  try {
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
 * 解析 JSON 格式 QR Code
 * 格式: {"restaurantId": 123, "tableId": 5}
 */
function parseJSONFormat(content: string): QRData | null {
  try {
    const data = JSON.parse(content);

    if (
      data &&
      typeof data.restaurantId === "number" &&
      typeof data.tableId === "number"
    ) {
      return {
        restaurantId: data.restaurantId,
        tableId: data.tableId,
        source: "json",
        raw: content,
      };
    }
  } catch (error) {
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

    // 標準路徑格式: /restaurant/123/table/5
    const pathMatch1 = url.pathname.match(/\/restaurant\/(\d+)\/table\/(\d+)/);
    if (pathMatch1) {
      return {
        restaurantId: parseInt(pathMatch1[1]),
        tableId: parseInt(pathMatch1[2]),
        source: "url",
        raw: content,
      };
    }

    // 簡短路徑格式: /r/123/t/5
    const pathMatch2 = url.pathname.match(/\/r\/(\d+)\/t\/(\d+)/);
    if (pathMatch2) {
      return {
        restaurantId: parseInt(pathMatch2[1]),
        tableId: parseInt(pathMatch2[2]),
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
      const restaurantId = parseInt(restaurantParam);
      const tableId = parseInt(tableParam);

      if (!isNaN(restaurantId) && !isNaN(tableId)) {
        return {
          restaurantId,
          tableId,
          source: "url",
          raw: content,
        };
      }
    }
  } catch (error) {
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
      restaurantId: parseInt(colonMatch[1]),
      tableId: parseInt(colonMatch[2]),
      source: "simple",
      raw: content,
    };
  }

  // 格式: "R123T5"
  const rtMatch = content.match(/^R(\d+)T(\d+)$/i);
  if (rtMatch) {
    return {
      restaurantId: parseInt(rtMatch[1]),
      tableId: parseInt(rtMatch[2]),
      source: "simple",
      raw: content,
    };
  }

  // 格式: "123-5"
  const dashMatch = content.match(/^(\d+)-(\d+)$/);
  if (dashMatch) {
    return {
      restaurantId: parseInt(dashMatch[1]),
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
  return (
    data.restaurantId > 0 &&
    data.tableId > 0 &&
    Number.isInteger(data.restaurantId) &&
    Number.isInteger(data.tableId)
  );
}

/**
 * 生成 QR Code 內容（用於測試或管理）
 */
export function generateQRContent(
  restaurantId: number,
  tableId: number,
  format: "json" | "url" | "simple" = "json",
): string {
  switch (format) {
    case "json":
      return JSON.stringify({ restaurantId, tableId });

    case "url":
      return `https://makanmakan.app/restaurant/${restaurantId}/table/${tableId}`;

    case "simple":
      return `${restaurantId}:${tableId}`;

    default:
      return JSON.stringify({ restaurantId, tableId });
  }
}

/**
 * 獲取 QR Code 格式描述
 */
export function getQRFormatDescription(source: QRData["source"]): string {
  switch (source) {
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
