/**
 * API Pagination Implementation Examples
 *
 * Demonstrates how to implement pagination in Cloudflare Workers API routes
 */

import { Hono } from 'hono'
import { eq, and, sql } from 'drizzle-orm'
import { orders, menuItems, users } from '@makanmakan/database'
import {
  paginateQuery,
  paginateWithCursor,
  searchWithPagination,
  applyPagination,
  applySorting,
  getTotalCount,
  createPaginatedResponse
} from '@makanmakan/database/utils/pagination-helpers'
import {
  validatePaginationParams,
  _normalizePaginationParams,
  type PaginationParams
} from '@makanmakan/shared-types/pagination'

const app = new Hono()

/**
 * Example 1: Basic offset-based pagination
 *
 * GET /orders?page=1&pageSize=20&sortBy=createdAt&sortOrder=desc
 */
app.get('/orders', async (c) => {
  const db = c.env.DB
  const restaurantId = c.get('restaurantId')

  // Parse query params
  const params: PaginationParams = {
    page: Number(c.req.query('page')) || 1,
    pageSize: Number(c.req.query('pageSize')) || 20,
    sortBy: c.req.query('sortBy') || 'createdAt',
    sortOrder: (c.req.query('sortOrder') as 'asc' | 'desc') || 'desc'
  }

  // Validate params
  const validation = validatePaginationParams(params)
  if (!validation.valid) {
    return c.json({ error: 'Invalid pagination params', errors: validation.errors }, 400)
  }

  // Use all-in-one helper
  const response = await paginateQuery(
    db,
    db.select().from(orders),
    orders,
    params,
    eq(orders.restaurantId, restaurantId)
  )

  return c.json(response)
})

/**
 * Example 2: Manual pagination with custom query
 *
 * More control over query building
 */
app.get('/orders/manual', async (c) => {
  const db = c.env.DB
  const restaurantId = c.get('restaurantId')
  const status = c.req.query('status')

  const params: PaginationParams = {
    page: Number(c.req.query('page')) || 1,
    pageSize: Number(c.req.query('pageSize')) || 20,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  }

  // Build base query with joins
  let baseQuery = db
    .select({
      id: orders.id,
      totalAmount: orders.totalAmount,
      status: orders.status,
      createdAt: orders.createdAt,
      customerName: users.name
    })
    .from(orders)
    .leftJoin(users, eq(orders.customerId, users.id))

  // Apply filters
  const conditions = [eq(orders.restaurantId, restaurantId)]
  if (status) {
    conditions.push(eq(orders.status, status))
  }
  const whereCondition = and(...conditions)

  if (whereCondition) {
    baseQuery = baseQuery.where(whereCondition)
  }

  // Apply sorting
  baseQuery = applySorting(baseQuery, orders, params.sortBy, params.sortOrder)

  // Get total count
  const totalItems = await getTotalCount(db, orders, whereCondition)

  // Apply pagination
  baseQuery = applyPagination(baseQuery, params)

  // Execute
  const data = await baseQuery

  // Create response
  const response = createPaginatedResponse(data, params, totalItems)

  return c.json(response)
})

/**
 * Example 3: Search with pagination
 *
 * GET /menu/search?q=pizza&page=1&pageSize=10
 */
app.get('/menu/search', async (c) => {
  const db = c.env.DB
  const restaurantId = c.get('restaurantId')
  const searchQuery = c.req.query('q') || ''

  const params: PaginationParams = {
    page: Number(c.req.query('page')) || 1,
    pageSize: Number(c.req.query('pageSize')) || 10,
    sortBy: 'name',
    sortOrder: 'asc'
  }

  // Search with pagination
  const response = await searchWithPagination(
    db,
    menuItems,
    ['name', 'description'], // Search in these fields
    searchQuery,
    params,
    eq(menuItems.restaurantId, restaurantId) // Additional filter
  )

  return c.json(response)
})

/**
 * Example 4: Cursor-based pagination (for real-time feeds)
 *
 * GET /messages?cursor=eyJpZCI6MTIzfQ==&limit=20
 */
app.get('/messages', async (c) => {
  const db = c.env.DB
  const conversationId = c.req.query('conversationId')
  const cursor = c.req.query('cursor')
  const limit = Number(c.req.query('limit')) || 20

  if (!conversationId) {
    return c.json({ error: 'conversationId required' }, 400)
  }

  // Use cursor pagination
  const response = await paginateWithCursor(
    db,
    messages, // Assuming messages table exists
    {
      cursor,
      limit,
      where: eq(messages.conversationId, conversationId)
    },
    'id', // Cursor field
    'createdAt' // Sort field
  )

  return c.json(response)
})

/**
 * Example 5: Filtered pagination with complex conditions
 *
 * GET /orders/filtered?status=completed&minAmount=50&maxAmount=500&page=1
 */
app.get('/orders/filtered', async (c) => {
  const db = c.env.DB
  const restaurantId = c.get('restaurantId')

  const params: PaginationParams = {
    page: Number(c.req.query('page')) || 1,
    pageSize: Number(c.req.query('pageSize')) || 20,
    sortBy: c.req.query('sortBy') || 'createdAt',
    sortOrder: (c.req.query('sortOrder') as 'asc' | 'desc') || 'desc',
    filters: {
      status: c.req.query('status'),
      minAmount: Number(c.req.query('minAmount')),
      maxAmount: Number(c.req.query('maxAmount'))
    }
  }

  // Build dynamic where conditions
  const conditions = [eq(orders.restaurantId, restaurantId)]

  if (params.filters?.status) {
    conditions.push(eq(orders.status, params.filters.status))
  }

  if (params.filters?.minAmount) {
    conditions.push(sql`${orders.totalAmount} >= ${params.filters.minAmount}`)
  }

  if (params.filters?.maxAmount) {
    conditions.push(sql`${orders.totalAmount} <= ${params.filters.maxAmount}`)
  }

  const whereCondition = and(...conditions)

  // Paginate
  const response = await paginateQuery(
    db,
    db.select().from(orders),
    orders,
    params,
    whereCondition
  )

  return c.json(response)
})

/**
 * Example 6: Aggregated data with pagination
 *
 * GET /analytics/sales?page=1&pageSize=10&groupBy=day
 */
app.get('/analytics/sales', async (c) => {
  const db = c.env.DB
  const restaurantId = c.get('restaurantId')

  const params: PaginationParams = {
    page: Number(c.req.query('page')) || 1,
    pageSize: Number(c.req.query('pageSize')) || 10
  }

  // Custom aggregated query
  const baseQuery = db
    .select({
      date: sql<string>`DATE(${orders.createdAt})`,
      totalSales: sql<number>`SUM(${orders.totalAmount})`,
      orderCount: sql<number>`COUNT(*)`,
      avgOrderValue: sql<number>`AVG(${orders.totalAmount})`
    })
    .from(orders)
    .where(eq(orders.restaurantId, restaurantId))
    .groupBy(sql`DATE(${orders.createdAt})`)
    .orderBy(sql`DATE(${orders.createdAt}) DESC`)

  // Apply pagination
  const paginatedQuery = applyPagination(baseQuery, params)
  const data = await paginatedQuery

  // Get total count of grouped results
  const countQuery = await db
    .select({ count: sql<number>`COUNT(DISTINCT DATE(${orders.createdAt}))` })
    .from(orders)
    .where(eq(orders.restaurantId, restaurantId))

  const totalItems = countQuery[0]?.count ?? 0

  // Create response
  const response = createPaginatedResponse(data, params, totalItems)

  return c.json(response)
})

/**
 * Example 7: Export all pages (for CSV/Excel export)
 *
 * GET /orders/export?format=csv
 */
app.get('/orders/export', async (c) => {
  const db = c.env.DB
  const restaurantId = c.get('restaurantId')
  const format = c.req.query('format') || 'json'

  // For exports, fetch all data without pagination
  // Be careful with memory limits!
  const allOrders = await db
    .select()
    .from(orders)
    .where(eq(orders.restaurantId, restaurantId))
    .orderBy(sql`${orders.createdAt} DESC`)
    .limit(10000) // Safety limit

  if (format === 'csv') {
    // Convert to CSV
    const csv = convertToCSV(allOrders)
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="orders.csv"'
      }
    })
  }

  return c.json({ data: allOrders, count: allOrders.length })
})

/**
 * Helper: Convert data to CSV
 */
function convertToCSV(data: any[]): string {
  if (data.length === 0) return ''

  const headers = Object.keys(data[0]).join(',')
  const rows = data.map(row =>
    Object.values(row).map(val =>
      typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val
    ).join(',')
  )

  return [headers, ...rows].join('\n')
}

export default app
