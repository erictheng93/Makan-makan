/**
 * OpenAPI 3.x 配置文件
 *
 * 用於配置 API 文檔的基礎設置
 * - 使用 @hono/zod-openapi 生成 OpenAPI 規範
 * - 整合 Swagger UI
 */
import { OpenAPIHono } from "@hono/zod-openapi";

export const createOpenAPIApp = () => {
  const app = new OpenAPIHono();

  // OpenAPI 文檔配置
  app.doc("/openapi.json", {
    openapi: "3.1.0",
    info: {
      title: "MakanMakan API",
      version: "2.0.0",
      description: `
# MakanMakan API Documentation

智慧雲端點餐平台 REST API

基於 Cloudflare Workers 構建的現代、高性能餐廳管理系統 API。

## 主要功能

- 🔐 JWT 身份驗證與多角色權限系統
- 🍽️ 菜單與分類管理
- 📦 訂單處理與追蹤
- 🪑 桌位管理與 QR Code
- 👥 用戶與員工管理
- 📊 營運分析與 AI 洞察
- 🔄 即時通知 (WebSocket)
- 📅 排班與請假管理

## 認證方式

大部分 API 端點需要 Bearer Token 認證：
\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

通過 \`POST /api/v1/auth/login\` 獲取 token。

## 速率限制

- 每個 IP 地址：100 請求/分鐘
- 已認證用戶：1000 請求/分鐘

## 錯誤處理

API 使用標準 HTTP 狀態碼：
- \`200\`: 成功
- \`201\`: 創建成功
- \`400\`: 請求錯誤
- \`401\`: 未認證
- \`403\`: 無權限
- \`404\`: 資源不存在
- \`500\`: 服務器錯誤

錯誤回應格式：
\`\`\`json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
\`\`\`
      `,
      contact: {
        name: "MakanMakan Development Team",
        email: "api@makanmakan.com",
        url: "https://github.com/makanmakan/platform",
      },
      license: {
        name: "MIT License",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers: [
      {
        url: "https://api.makanmakan.com",
        description: "Production Server",
      },
      {
        url: "https://api-staging.makanmakan.com",
        description: "Staging Server",
      },
      {
        url: "http://localhost:8787",
        description: "Local Development",
      },
    ],
    tags: [
      {
        name: "auth",
        description: "身份驗證 - 登入、註冊、Token 管理",
      },
      {
        name: "menu",
        description: "菜單管理 - 菜品、分類、圖片上傳",
      },
      {
        name: "orders",
        description: "訂單管理 - 創建、查詢、更新訂單狀態",
      },
      {
        name: "tables",
        description: "桌位管理 - QR Code 生成、桌位狀態",
      },
      {
        name: "users",
        description: "用戶管理 - 員工、客戶、角色權限",
      },
      {
        name: "customers",
        description: "客戶管理 - 客戶資料、偏好設定",
      },
      {
        name: "restaurants",
        description: "餐廳管理 - 餐廳資訊、設定",
      },
      {
        name: "realtime",
        description: "即時通訊 - WebSocket 連接與訊息",
      },
      {
        name: "analytics",
        description: "數據分析 - 營運報表、統計數據",
      },
      {
        name: "ai-analytics",
        description: "AI 分析 - 智能洞察、預測分析",
      },
      {
        name: "scheduling",
        description: "排班管理 - 班表、輪班",
      },
      {
        name: "leaves",
        description: "請假管理 - 假期申請、審批",
      },
      {
        name: "qr",
        description: "QR Code - 生成、範本、批次處理",
      },
      {
        name: "health",
        description: "系統健康 - 健康檢查、狀態監控",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT Token 認證。通過 /auth/login 獲取 token",
        },
      },
      schemas: {
        // 通用 Schema
        Error: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: false,
            },
            error: {
              type: "string",
              example: "Error message",
            },
            code: {
              type: "string",
              example: "ERROR_CODE",
            },
          },
          required: ["success", "error"],
        },
        PaginationMeta: {
          type: "object",
          properties: {
            total: {
              type: "integer",
              example: 100,
            },
            page: {
              type: "integer",
              example: 1,
            },
            pageSize: {
              type: "integer",
              example: 20,
            },
            totalPages: {
              type: "integer",
              example: 5,
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  } as any);

  return app;
};

/**
 * 通用錯誤回應配置
 */
const errorResponseConfig = {
  400: {
    description: "請求錯誤 - 驗證失敗或參數錯誤",
    content: {
      "application/json": {
        schema: {
          $ref: "#/components/schemas/Error",
        },
        example: {
          success: false,
          error: "Invalid request parameters",
          code: "VALIDATION_ERROR",
        },
      },
    },
  },
  401: {
    description: "未認證 - 缺少或無效的 Token",
    content: {
      "application/json": {
        schema: {
          $ref: "#/components/schemas/Error",
        },
        example: {
          success: false,
          error: "Unauthorized",
          code: "UNAUTHORIZED",
        },
      },
    },
  },
  403: {
    description: "權限不足 - Token 有效但無權訪問",
    content: {
      "application/json": {
        schema: {
          $ref: "#/components/schemas/Error",
        },
        example: {
          success: false,
          error: "Forbidden",
          code: "FORBIDDEN",
        },
      },
    },
  },
  404: {
    description: "資源不存在",
    content: {
      "application/json": {
        schema: {
          $ref: "#/components/schemas/Error",
        },
        example: {
          success: false,
          error: "Resource not found",
          code: "NOT_FOUND",
        },
      },
    },
  },
  500: {
    description: "服務器內部錯誤",
    content: {
      "application/json": {
        schema: {
          $ref: "#/components/schemas/Error",
        },
        example: {
          success: false,
          error: "Internal server error",
          code: "INTERNAL_ERROR",
        },
      },
    },
  },
} as const;

/**
 * 錯誤回應輔助函數
 * 返回正確格式的 responses 對象部分，可直接展開使用
 *
 * @example
 * responses: {
 *   200: { ... },
 *   ...errorResponses(400, 401, 404)
 * }
 */
export function errorResponses(...codes: (400 | 401 | 403 | 404 | 500)[]) {
  const result: Record<
    string,
    (typeof errorResponseConfig)[keyof typeof errorResponseConfig]
  > = {};
  for (const code of codes) {
    result[code.toString()] = errorResponseConfig[code];
  }
  return result;
}

/**
 * 直接訪問單個錯誤回應配置（用於 responses 對象的鍵）
 *
 * @example
 * responses: {
 *   200: { ... },
 *   400: errorResponseDef[400],
 *   401: errorResponseDef[401]
 * }
 */
export const errorResponseDef = errorResponseConfig;
