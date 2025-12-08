/**
 * OpenAPI Integration
 * 整合 OpenAPI 規範到主 API 應用
 */

import { swaggerUI } from '@hono/swagger-ui';
import { createOpenAPIApp, errorResponses } from './config';
import { createRoute, z } from '@hono/zod-openapi';
import type { Hono } from 'hono';

/**
 * 整合 OpenAPI 到 Hono 應用
 */
export function integrateOpenAPI(app: Hono) {
  const openApiApp = createOpenAPIApp();

  // ========== Swagger UI 路由 ==========

  // Swagger UI 主頁面
  app.get('/docs', swaggerUI({
    url: '/openapi.json'
  }));

  // OpenAPI JSON 端點
  app.get('/openapi.json', (c) => {
    return c.json(openApiApp.getOpenAPI31Document());
  });

  console.log('✅ OpenAPI integrated');
  console.log('📚 Swagger UI available at: /docs');
  console.log('📄 OpenAPI spec available at: /openapi.json');

  return openApiApp;
}

/**
 * Auth API Schema 定義
 */
export const AuthSchemas = {
  // Login Request
  LoginRequest: z.object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  }),

  // Login Response
  LoginResponse: z.object({
    success: z.boolean(),
    token: z.string(),
    user: z.object({
      id: z.string(),
      email: z.string().email(),
      name: z.string(),
      role: z.number().int().min(0).max(4),
    }),
  }),

  // Refresh Token Request
  RefreshTokenRequest: z.object({
    refreshToken: z.string(),
  }),
};

/**
 * Menu API Schema 定義
 */
export const MenuSchemas = {
  // Menu Item
  MenuItem: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    price: z.number().positive(),
    category: z.string(),
    imageUrl: z.string().url().optional(),
    available: z.boolean(),
    tags: z.array(z.string()).optional(),
  }),

  // Get Menu Items Request
  GetMenuItemsRequest: z.object({
    restaurantId: z.string().uuid(),
    categoryId: z.string().uuid().optional(),
    available: z.boolean().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).default('1'),
    pageSize: z.string().regex(/^\d+$/).transform(Number).default('20'),
  }),

  // Get Menu Items Response
  GetMenuItemsResponse: z.object({
    success: z.boolean(),
    data: z.array(z.lazy(() => MenuSchemas.MenuItem)),
    meta: z.object({
      total: z.number(),
      page: z.number(),
      pageSize: z.number(),
      totalPages: z.number(),
    }),
  }),

  // Create Menu Item Request
  CreateMenuItemRequest: z.object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    price: z.number().positive('Price must be positive'),
    categoryId: z.string().uuid('Invalid category ID'),
    imageUrl: z.string().url().optional(),
    tags: z.array(z.string()).optional(),
  }),
};

/**
 * Orders API Schema 定義
 */
export const OrdersSchemas = {
  // Order Status Enum
  OrderStatus: z.enum(['pending', 'preparing', 'ready', 'completed', 'cancelled']),

  // Order Item
  OrderItem: z.object({
    id: z.string(),
    menuItemId: z.string().uuid(),
    name: z.string(),
    quantity: z.number().int().positive(),
    price: z.number().positive(),
    notes: z.string().optional(),
    status: z.enum(['pending', 'preparing', 'ready']),
  }),

  // Order
  Order: z.object({
    id: z.string(),
    orderNumber: z.string(),
    restaurantId: z.string().uuid(),
    tableId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional(),
    status: z.lazy(() => OrdersSchemas.OrderStatus),
    items: z.array(z.lazy(() => OrdersSchemas.OrderItem)),
    subtotal: z.number().nonnegative(),
    tax: z.number().nonnegative(),
    total: z.number().positive(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),

  // Create Order Request
  CreateOrderRequest: z.object({
    restaurantId: z.string().uuid(),
    tableId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional(),
    items: z.array(z.object({
      menuItemId: z.string().uuid(),
      quantity: z.number().int().positive(),
      notes: z.string().optional(),
    })).min(1, 'At least one item is required'),
  }),

  // Update Order Status Request
  UpdateOrderStatusRequest: z.object({
    status: z.lazy(() => OrdersSchemas.OrderStatus),
  }),
};

/**
 * 示範：Auth Login 路由（OpenAPI 文檔化）
 */
export const authLoginRoute = createRoute({
  method: 'post',
  path: '/api/v1/auth/login',
  tags: ['auth'],
  summary: '用戶登入',
  description: '使用 email 和密碼進行身份驗證，成功後返回 JWT token',
  request: {
    body: {
      content: {
        'application/json': {
          schema: AuthSchemas.LoginRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: '登入成功',
      content: {
        'application/json': {
          schema: AuthSchemas.LoginResponse,
        },
      },
    },
    ...errorResponses(400, 401),
  },
});

/**
 * 示範：Menu Items 列表路由（OpenAPI 文檔化）
 */
export const getMenuItemsRoute = createRoute({
  method: 'get',
  path: '/api/v1/menu/:restaurantId/items',
  tags: ['menu'],
  summary: '獲取菜單項目列表',
  description: '獲取指定餐廳的菜單項目，支持分頁和過濾',
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      restaurantId: z.string().uuid(),
    }),
    query: z.object({
      categoryId: z.string().uuid().optional(),
      available: z.string().transform(val => val === 'true').optional(),
      page: z.string().regex(/^\d+$/).transform(Number).default('1'),
      pageSize: z.string().regex(/^\d+$/).transform(Number).default('20'),
    }),
  },
  responses: {
    200: {
      description: '成功獲取菜單項目',
      content: {
        'application/json': {
          schema: MenuSchemas.GetMenuItemsResponse,
        },
      },
    },
    ...errorResponses(401, 404),
  },
});

/**
 * 示範：創建訂單路由（OpenAPI 文檔化）
 */
export const createOrderRoute = createRoute({
  method: 'post',
  path: '/api/v1/orders',
  tags: ['orders'],
  summary: '創建新訂單',
  description: '創建新的訂單，包含一個或多個菜單項目',
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: OrdersSchemas.CreateOrderRequest,
        },
      },
    },
  },
  responses: {
    201: {
      description: '訂單創建成功',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            data: OrdersSchemas.Order,
          }),
        },
      },
    },
    ...errorResponses(400, 401),
  },
});

/**
 * 導出所有 OpenAPI 路由定義
 *
 * 使用方式：
 * ```typescript
 * import { authLoginRoute, getMenuItemsRoute } from './openapi/integration';
 *
 * // 在實際的路由處理器中使用
 * app.openapi(authLoginRoute, async (c) => {
 *   const { email, password } = await c.req.json();
 *   // ... 實現登入邏輯
 * });
 * ```
 */
export const OpenAPIRoutes = {
  auth: {
    login: authLoginRoute,
  },
  menu: {
    getItems: getMenuItemsRoute,
  },
  orders: {
    create: createOrderRoute,
  },
};
