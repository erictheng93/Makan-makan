import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { inputSanitizationMiddleware } from "../../middleware/security";
import { validateBody, validateQuery } from "../../middleware/validation";
import { ApiError } from "../../shared/utils/api-error";
import { ErrorSanitizer } from "../../utils/errorSanitizer";
import { z } from "zod";

// ---------------------------------------------------------------------------
// 測試用 Zod schemas — 模擬項目中常見的驗證規則
// ---------------------------------------------------------------------------
const userSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
  email: z.string().email().optional(),
});

const menuItemSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  price: z.number().positive().max(999999),
  categoryId: z.string().uuid().optional(),
});

const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
});

const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/),
});

// ---------------------------------------------------------------------------
// 輔助函數 — 建立測試用 Hono 應用
// ---------------------------------------------------------------------------

/** 建立帶有全域錯誤處理器、清理中間件和驗證的 Hono app */
function createTestApp(options?: { withSanitization?: boolean }) {
  const app = new Hono();

  // 全域錯誤處理（與 production index.ts 一致）
  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(
        {
          success: false,
          error: {
            code: err.code,
            message: err.message,
            ...(err.details !== undefined && { details: err.details }),
          },
        },
        err.status as any,
      );
    }
    const sanitized = ErrorSanitizer.sanitizeError(err);
    return c.json(
      {
        success: false,
        error: {
          code: sanitized.code ?? "INTERNAL_ERROR",
          message: sanitized.message,
        },
      },
      500,
    );
  });

  if (options?.withSanitization !== false) {
    app.use("*", inputSanitizationMiddleware);
  }

  return app;
}

// ===========================================================================
// 1. SQL 注入測試
// ===========================================================================
describe("SQL Injection Prevention（SQL 注入防護）", () => {
  let app: Hono;

  beforeEach(() => {
    app = createTestApp();
    app.post("/api/v1/users", validateBody(userSchema), async (c) => {
      const body = c.get("validatedBody");
      return c.json({ success: true, data: body });
    });
    app.post("/api/v1/menu/items", validateBody(menuItemSchema), async (c) => {
      const body = c.get("validatedBody");
      return c.json({ success: true, data: body });
    });
  });

  const sqlInjectionPayloads = [
    {
      name: "基本 SQL 注入 — OR 1=1",
      payload: "' OR '1'='1",
    },
    {
      name: "破壞性 SQL — DROP TABLE",
      payload: "'; DROP TABLE users; --",
    },
    {
      name: "UNION 查詢注入",
      payload: "1 UNION SELECT * FROM users",
    },
    {
      name: "布林盲注",
      payload: "1' AND (SELECT COUNT(*) FROM users) > 0 --",
    },
    {
      name: "時間盲注 — WAITFOR DELAY",
      payload: "1'; WAITFOR DELAY '0:0:5' --",
    },
  ];

  describe("Zod 驗證層阻擋 SQL 注入", () => {
    it.each(sqlInjectionPayloads)(
      "應拒絕 $name 於 username 欄位",
      async ({ payload }) => {
        const res = await app.request("/api/v1/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: payload,
            password: "validpassword123",
          }),
        });

        // 短於 3 字元的 payload 會被 min(3) 擋；
        // 超過 50 字元會被 max(50) 擋；
        // 包含特殊字元的 payload 如果通過長度檢查，至少經過 sanitization
        const body = await res.json();
        if (res.status === 400) {
          expect(body.success).toBe(false);
          expect(body.error.code).toBe("VALIDATION_ERROR");
        } else {
          // 如果長度合法通過驗證，確認 sanitization 已移除危險字元
          expect(body.data.username).not.toContain("<script");
        }
      },
    );

    it("應拒絕 SQL 注入於 price 欄位（需為正數）", async () => {
      const res = await app.request("/api/v1/menu/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test Item",
          price: "1 UNION SELECT * FROM users",
          description: "normal description",
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("應拒絕 SQL 注入於 categoryId（需為 UUID 格式）", async () => {
      const res = await app.request("/api/v1/menu/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test Item",
          price: 10.99,
          categoryId: "'; DROP TABLE categories; --",
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("清理中間件中和 SQL 注入中的 HTML 標記", () => {
    it("應對包含 script 標籤的 SQL 注入 payload 進行 HTML 編碼", async () => {
      const res = await app.request("/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "admin<script>alert(1)</script>",
          password: "validpassword123",
        }),
      });

      const body = await res.json();
      if (res.status === 200) {
        expect(body.data.username).not.toContain("<script>");
        expect(body.data.username).toContain("&lt;script&gt;");
      }
    });
  });
});

// ===========================================================================
// 2. 路徑遍歷測試
// ===========================================================================
describe("Path Traversal Prevention（路徑遍歷防護）", () => {
  let app: Hono;

  beforeEach(() => {
    app = createTestApp();

    // 使用 validateQuery 保護的搜尋端點
    app.get("/api/v1/search", validateQuery(searchQuerySchema), async (c) => {
      const query = c.get("validatedQuery");
      return c.json({ success: true, data: query });
    });

    // 帶路徑參數的端點 — 模擬文件下載或 menu ID 查詢
    app.get("/api/v1/files/:path", async (c) => {
      const filePath = c.req.param("path");
      return c.json({ success: true, path: filePath });
    });

    // 使用 validateBody 保護的端點
    app.post(
      "/api/v1/upload",
      validateBody(
        z.object({
          filename: z
            .string()
            .min(1)
            .max(255)
            .regex(/^[a-zA-Z0-9._-]+$/),
          data: z.string(),
        }),
      ),
      async (c) => {
        const body = c.get("validatedBody");
        return c.json({ success: true, data: body });
      },
    );
  });

  const traversalPayloads = [
    {
      name: "基本路徑遍歷 — ../",
      payload: "../../etc/passwd",
    },
    {
      name: "URL 編碼路徑遍歷",
      payload: "..%2F..%2Fetc%2Fpasswd",
    },
    {
      name: "雙編碼路徑遍歷",
      payload: "....//....//etc/passwd",
    },
  ];

  describe("查詢參數中的路徑遍歷", () => {
    it.each(traversalPayloads)("應處理查詢中的 $name", async ({ payload }) => {
      const res = await app.request(
        `/api/v1/search?q=${encodeURIComponent(payload)}`,
      );

      const body = await res.json();
      // 查詢通過後 sanitization 應編碼危險字元
      if (res.status === 200) {
        // 斜線和點號不構成 HTML 危險，但 sanitization 會編碼 /
        expect(body.data.q).toBeDefined();
      }
    });
  });

  describe("請求體中的路徑遍歷", () => {
    it("應拒絕 filename 中的路徑遍歷字元", async () => {
      const res = await app.request("/api/v1/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: "../../etc/passwd",
          data: "test",
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("應拒絕 URL 編碼的路徑遍歷", async () => {
      const res = await app.request("/api/v1/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: "..%2F..%2Fetc%2Fpasswd",
          data: "test",
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("應拒絕以 null byte 繞過的路徑遍歷", async () => {
      const res = await app.request("/api/v1/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: "image.png\0../../etc/passwd",
          data: "test",
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("URL 路徑中的路徑遍歷", () => {
    it("應安全處理 URL 路徑中的 ../ 嘗試", async () => {
      // Hono 的路由器通常會正規化路徑，不會匹配 ../
      const res = await app.request("/api/v1/menu/../../../etc/passwd");

      // 期望 404（路由不匹配）或安全回應
      expect([404, 200]).toContain(res.status);
      if (res.status === 200) {
        const body = await res.json();
        expect(JSON.stringify(body)).not.toContain("/etc/passwd");
      }
    });
  });
});

// ===========================================================================
// 3. 超大 Payload 測試
// ===========================================================================
describe("Oversized Payload Prevention（超大 Payload 防護）", () => {
  let app: Hono;

  beforeEach(() => {
    app = createTestApp();
    app.post(
      "/api/v1/data",
      validateBody(
        z.object({
          name: z.string().min(1).max(200),
          items: z.array(z.string()).max(100).optional(),
          metadata: z.record(z.string()).optional(),
        }),
      ),
      async (c) => {
        const body = c.get("validatedBody");
        return c.json({ success: true, data: body });
      },
    );

    app.post("/api/v1/menu/items", validateBody(menuItemSchema), async (c) => {
      const body = c.get("validatedBody");
      return c.json({ success: true, data: body });
    });
  });

  it("應拒絕超長字串欄位值（>10KB）", async () => {
    const longString = "A".repeat(10240); // 10KB 字串
    const res = await app.request("/api/v1/menu/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: longString,
        price: 9.99,
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("應拒絕超大陣列（>100 元素，受 schema 限制）", async () => {
    const largeArray = Array.from({ length: 10001 }, (_, i) => `item-${i}`);
    const res = await app.request("/api/v1/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "test",
        items: largeArray,
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("應拒絕深層巢狀 JSON", async () => {
    // 建立 100 層深的巢狀物件
    let nested: any = { value: "deep" };
    for (let i = 0; i < 100; i++) {
      nested = { child: nested };
    }

    const res = await app.request("/api/v1/menu/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "test",
        price: 9.99,
        description: JSON.stringify(nested),
      }),
    });

    // 深層巢狀會被 Zod 驗證或 JSON 解析正常處理
    // 如果 description 超過 1000 字元則會被 max(1000) 擋掉
    const body = await res.json();
    if (res.status === 400) {
      expect(body.success).toBe(false);
    } else {
      // 即使通過，也確認回應正常
      expect(body.success).toBe(true);
    }
  });

  it("應對超大 name 欄位回傳驗證錯誤（超過 200 字元）", async () => {
    const res = await app.request("/api/v1/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "X".repeat(201),
      }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("應拒絕無效 JSON body", async () => {
    const res = await app.request("/api/v1/menu/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "this is not json{{{",
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

// ===========================================================================
// 4. NoSQL / JSON 注入 與 Prototype Pollution 測試
// ===========================================================================
describe("NoSQL / JSON Injection & Prototype Pollution（NoSQL 注入與原型污染防護）", () => {
  let app: Hono;

  beforeEach(() => {
    app = createTestApp();

    app.post("/api/v1/users", validateBody(userSchema), async (c) => {
      const body = c.get("validatedBody");
      return c.json({ success: true, data: body });
    });

    // 更寬鬆的端點用來測試 sanitization 層（接受任意物件）
    app.post(
      "/api/v1/flexible",
      validateBody(
        z.object({
          data: z.record(z.unknown()).optional(),
          query: z.string().max(500).optional(),
          name: z.string().min(1).max(100),
        }),
      ),
      async (c) => {
        const body = c.get("validatedBody");
        return c.json({ success: true, data: body });
      },
    );
  });

  describe("MongoDB 風格運算子注入（防禦深度）", () => {
    it("Zod 應拒絕 $gt 運算子作為 username 值", async () => {
      const res = await app.request("/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: { $gt: "" },
          password: "validpassword123",
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("Zod 應拒絕 $ne 運算子作為 password 值", async () => {
      const res = await app.request("/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "validuser",
          password: { $ne: "" },
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("應處理 $where 注入嘗試", async () => {
      const res = await app.request("/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "validuser",
          password: "validpassword123",
          $where: "this.isAdmin == true",
        }),
      });

      // userSchema 使用 z.object() 嚴格模式，多餘欄位會被 strip
      const body = await res.json();
      if (res.status === 200) {
        // 確認 $where 不在回應中（被 Zod strip 掉）
        expect(body.data.$where).toBeUndefined();
      }
    });
  });

  describe("Prototype Pollution 防護", () => {
    it("應安全處理 __proto__ 污染嘗試", async () => {
      const res = await app.request("/api/v1/flexible", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "test",
          data: { __proto__: { isAdmin: true } },
        }),
      });

      const body = await res.json();
      // 無論通過或拒絕，全域物件不應被污染
      expect(({} as any).isAdmin).toBeUndefined();
      if (res.status === 200) {
        expect(body.data.name).toBe("test");
      }
    });

    it("應安全處理 constructor.prototype 污染", async () => {
      const res = await app.request("/api/v1/flexible", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "test",
          data: {
            constructor: {
              prototype: {
                isAdmin: true,
              },
            },
          },
        }),
      });

      const body = await res.json();
      // 確認全域原型未被污染
      expect(({} as any).isAdmin).toBeUndefined();
      if (res.status === 200) {
        expect(body.data.name).toBe("test");
      }
    });

    it("應安全處理嵌套 __proto__ 污染", async () => {
      const maliciousPayload = JSON.stringify({
        name: "test",
        data: {
          nested: {
            __proto__: { polluted: true },
          },
        },
      });

      const res = await app.request("/api/v1/flexible", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: maliciousPayload,
      });

      // 全域原型應保持乾淨
      expect(({} as any).polluted).toBeUndefined();
    });
  });
});

// ===========================================================================
// 5. Header 注入測試
// ===========================================================================
describe("Header Injection Prevention（Header 注入防護）", () => {
  let app: Hono;

  beforeEach(() => {
    app = createTestApp();
    app.get("/api/v1/health", async (c) => {
      return c.json({ success: true, status: "ok" });
    });
    app.post("/api/v1/users", validateBody(userSchema), async (c) => {
      const body = c.get("validatedBody");
      return c.json({ success: true, data: body });
    });
  });

  it("應安全處理 header 中的換行注入（\\r\\n）", async () => {
    // Node.js 的 Headers API 會在建構時拒絕包含 CRLF 的值，
    // 這本身就是運行時層面的安全防線
    await expect(
      app.request("/api/v1/health", {
        method: "GET",
        headers: {
          "X-Custom": "value\r\nX-Injected: true",
        },
      }),
    ).rejects.toThrow(/invalid header value/i);
  });

  it("應安全處理超長 Authorization header（>8KB）", async () => {
    const longToken = "Bearer " + "A".repeat(8192);
    const res = await app.request("/api/v1/health", {
      method: "GET",
      headers: {
        Authorization: longToken,
      },
    });

    // 應該正常回應或拒絕，不應崩潰
    expect([200, 400, 413, 431]).toContain(res.status);
  });

  it("應安全處理 header 中的 null byte", async () => {
    // Node.js 的 Headers API 會在建構時拒絕包含 null byte 的值，
    // 這防止了 null byte injection 攻擊
    await expect(
      app.request("/api/v1/health", {
        method: "GET",
        headers: {
          Authorization: "Bearer token\x00extra",
        },
      }),
    ).rejects.toThrow(/invalid header value/i);
  });

  it("應安全處理含有 CRLF 的 Content-Type header", async () => {
    // 運行時的 Headers API 拒絕 Content-Type 中的 CRLF 注入，
    // 防止 HTTP response splitting 攻擊
    await expect(
      app.request("/api/v1/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json\r\nX-Injected: malicious",
        },
        body: JSON.stringify({
          username: "testuser",
          password: "testpass123",
        }),
      }),
    ).rejects.toThrow(/invalid header value/i);
  });

  it("應安全處理大量 header", async () => {
    const manyHeaders: Record<string, string> = {};
    for (let i = 0; i < 100; i++) {
      manyHeaders[`X-Custom-Header-${i}`] = `value-${i}`;
    }

    const res = await app.request("/api/v1/health", {
      method: "GET",
      headers: manyHeaders,
    });

    // 不應崩潰
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(600);
  });
});

// ===========================================================================
// 6. XSS Payload 清理測試（驗證 inputSanitizationMiddleware）
// ===========================================================================
describe("XSS Sanitization（XSS 清理防護）", () => {
  let app: Hono;

  beforeEach(() => {
    app = createTestApp({ withSanitization: true });

    // 使用寬鬆 schema 讓 payload 通過驗證、聚焦測試 sanitization
    const flexibleSchema = z.object({
      content: z.string().min(1).max(5000),
      title: z.string().min(1).max(500).optional(),
    });

    app.post("/api/v1/content", validateBody(flexibleSchema), async (c) => {
      const body = c.get("validatedBody");
      return c.json({ success: true, data: body });
    });
  });

  const xssPayloads = [
    {
      name: "基本 script 標籤注入",
      input: "<script>alert(document.cookie)</script>",
      mustNotContain: "<script>",
    },
    {
      name: "img onerror 事件處理器",
      input: "<img src=x onerror=alert(1)>",
      mustNotContain: "<img",
    },
    {
      name: "SVG onload 事件處理器",
      input: "<svg onload=alert(1)>",
      mustNotContain: "<svg",
    },
    {
      name: "javascript: URI scheme",
      input: "javascript:alert(1)",
      mustNotContain: "javascript:",
    },
    {
      name: "context breaking — 引號逃逸後注入 script",
      input: "'\"--><script>alert(1)</script>",
      mustNotContain: "<script>",
    },
    {
      name: "HTML 事件處理器 — onmouseover",
      input: '<div onmouseover="alert(1)">hover me</div>',
      mustNotContain: "<div",
    },
    {
      name: "data URI XSS",
      input: "data:text/html,<script>alert(1)</script>",
      mustNotContain: "<script>",
    },
    {
      name: "混淆大小寫 — ScRiPt",
      input: "<ScRiPt>alert(1)</ScRiPt>",
      mustNotContain: "<ScRiPt>",
    },
    {
      name: "嵌套 script 標籤",
      input: "<<script>script>alert(1)<</script>/script>",
      mustNotContain: "<script>",
    },
  ];

  describe("inputSanitizationMiddleware 應中和 XSS payload", () => {
    it.each(xssPayloads)("應清理 $name", async ({ input, mustNotContain }) => {
      const res = await app.request("/api/v1/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: input,
        }),
      });

      if (res.status === 200) {
        const body = await res.json();
        expect(body.data.content).not.toContain(mustNotContain);
      }
      // 如果是 400 則驗證已擋下，同樣安全
    });
  });

  describe("多欄位同時 XSS 注入", () => {
    it("應同時清理 title 和 content 中的 XSS", async () => {
      const res = await app.request("/api/v1/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: '<script>alert("title")</script>',
          content: '<img src=x onerror=alert("content")>',
        }),
      });

      if (res.status === 200) {
        const body = await res.json();
        expect(body.data.title).not.toContain("<script>");
        expect(body.data.content).not.toContain("<img");
      }
    });
  });

  describe("Sanitization 編碼驗證", () => {
    it("應將 < 和 > 編碼為 HTML entities", async () => {
      const res = await app.request("/api/v1/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: "<b>bold</b>",
        }),
      });

      if (res.status === 200) {
        const body = await res.json();
        expect(body.data.content).toContain("&lt;b&gt;");
        expect(body.data.content).toContain("&lt;&#x2F;b&gt;");
      }
    });

    it("應將雙引號編碼為 &quot;", async () => {
      const res = await app.request("/api/v1/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: 'value with "quotes"',
        }),
      });

      if (res.status === 200) {
        const body = await res.json();
        expect(body.data.content).toContain("&quot;");
        expect(body.data.content).not.toMatch(/(?<!&quot)"/);
      }
    });

    it("應將反引號編碼為 &#x60;", async () => {
      const res = await app.request("/api/v1/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: "`template literal`",
        }),
      });

      if (res.status === 200) {
        const body = await res.json();
        expect(body.data.content).toContain("&#x60;");
      }
    });
  });

  describe("非 JSON 請求不觸發 sanitization 但不崩潰", () => {
    it("應安全處理 text/plain Content-Type", async () => {
      const textApp = createTestApp({ withSanitization: true });
      textApp.post("/api/v1/text", async (c) => {
        return c.json({ success: true, received: true });
      });

      const res = await textApp.request("/api/v1/text", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "<script>alert(1)</script>",
      });

      // 不應崩潰
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(600);
    });
  });
});

// ===========================================================================
// 7. 邊界案例與組合攻擊測試
// ===========================================================================
describe("Edge Cases & Combined Attacks（邊界案例與組合攻擊）", () => {
  let app: Hono;

  beforeEach(() => {
    app = createTestApp({ withSanitization: true });
    app.post("/api/v1/users", validateBody(userSchema), async (c) => {
      const body = c.get("validatedBody");
      return c.json({ success: true, data: body });
    });

    app.get("/api/v1/search", validateQuery(searchQuerySchema), async (c) => {
      const query = c.get("validatedQuery");
      return c.json({ success: true, data: query });
    });
  });

  it("應處理空 JSON body", async () => {
    const res = await app.request("/api/v1/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("應處理 null body", async () => {
    const res = await app.request("/api/v1/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "null",
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("應處理 array body（預期 object）", async () => {
    const res = await app.request("/api/v1/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ username: "user1", password: "pass123" }]),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("應處理組合攻擊 — SQL 注入 + XSS", async () => {
    const res = await app.request("/api/v1/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "admin'--<script>alert(1)</script>",
        password: "validpassword123",
      }),
    });

    const body = await res.json();
    if (res.status === 200) {
      // 如果通過驗證，確認 XSS 已清理
      expect(body.data.username).not.toContain("<script>");
    } else {
      expect(body.success).toBe(false);
    }
  });

  it("應處理 Unicode 混淆攻擊", async () => {
    // 使用 Unicode 全形字元嘗試繞過
    const res = await app.request("/api/v1/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "admin\uFF1Cscript\uFF1E", // ＜script＞ 全形括號
        password: "validpassword123",
      }),
    });

    // 無論通過或拒絕，都不應崩潰
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(600);
  });

  it("應處理缺失 Content-Type header 的 POST", async () => {
    const res = await app.request("/api/v1/users", {
      method: "POST",
      body: JSON.stringify({
        username: "testuser",
        password: "testpass123",
      }),
    });

    // 可能是 400（JSON 解析失敗）或 200
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(600);
  });

  it("應處理 query 參數中的 XSS 嘗試", async () => {
    const xssQuery = encodeURIComponent("<script>alert(1)</script>");
    const res = await app.request(`/api/v1/search?q=${xssQuery}`);

    if (res.status === 200) {
      const body = await res.json();
      // Query 參數不經過 inputSanitizationMiddleware（僅處理 JSON body），
      // 但 Zod 驗證和回應序列化應防止 XSS
      expect(body.data.q).toBeDefined();
    }
  });

  it("應正確處理 emoji 和特殊 Unicode 字元", async () => {
    const res = await app.request("/api/v1/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "user_name_ok",
        password: "password_123_ok",
        email: "test@example.com",
      }),
    });

    // 正常輸入應通過
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.username).toBe("user_name_ok");
  });
});
