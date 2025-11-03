/**
 * Waiting List Routes
 * API routes for waiting list/queue management system
 */

import { Hono } from 'hono';
import { authMiddleware, requireRole } from '../../../middleware/auth';
import { WaitingListService } from '@makanmakan/database';
import type { Env } from '../../../types/env';
import type { AuthUser } from '../../../middleware/auth';
import {
  WaitingStatus,
  type JoinWaitingListRequest,
  type WaitingListFilters,
  type CallWaitingRequest
} from '@makanmakan/shared-types';

const app = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>();

// ==========================================
// Public Routes - 顧客?�使??
// ==========================================

/**
 * POST /waiting-list
 * ?�入?��??�表
 */
app.post('/', async (c) => {
  try {
    const body = await c.req.json<JoinWaitingListRequest>();
    const service = new WaitingListService(c.env.DB, c.env);

    // 驗�?必填欄�?
    if (!body.restaurantId || !body.customerName || !body.customerPhone || !body.partySize) {
      return c.json({
        success: false,
        error: '缺�?必填欄�?'
      }, 400);
    }

    const entry = await service.joinWaitingList(body);

    return c.json({
      success: true,
      data: entry,
      message: `已�??�候�?，�?�? ${entry.queueDisplay}`
    }, 201);
  } catch (error) {
    console.error('Error joining waiting list:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '?�入?��?失�?'
    }, 400);
  }
});

/**
 * GET /waiting-list/:id
 * ?�詢?��??�?��??��?�?
 */
app.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const service = new WaitingListService(c.env.DB, c.env);

    const entry = await service.getWaitingListEntryById(id);

    if (!entry) {
      return c.json({
        success: false,
        error: '?��??�此?��?記�?'
      }, 404);
    }

    return c.json({
      success: true,
      data: entry
    });
  } catch (error) {
    console.error('Error getting waiting list entry:', error);
    return c.json({
      success: false,
      error: '?�詢?��?失�?'
    }, 500);
  }
});

/**
 * GET /waiting-list/queue-status/:restaurantId
 * ?�詢?��??�?��??��?�?
 */
app.get('/queue-status/:restaurantId', async (c) => {
  try {
    const restaurantId = c.req.param('restaurantId');
    const service = new WaitingListService(c.env.DB, c.env);

    const status = await service.getQueueStatus(restaurantId);

    return c.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting queue status:', error);
    return c.json({
      success: false,
      error: '查詢隊列狀態失敗'
    }, 500);
  }
});

/**
 * GET /waiting-list/estimate-wait/:restaurantId
 * ?�估等�??��?（公?��?
 */
app.get('/estimate-wait/:restaurantId', async (c) => {
  try {
    const restaurantId = c.req.param('restaurantId');
    const partySize = parseInt(c.req.query('partySize') || '2');
    const service = new WaitingListService(c.env.DB, c.env);

    const estimate = await service.estimateWaitTime({
      restaurantId,
      partySize
    });

    return c.json({
      success: true,
      data: estimate
    });
  } catch (error) {
    console.error('Error estimating wait time:', error);
    return c.json({
      success: false,
      error: '?�估等�??��?失�?'
    }, 500);
  }
});

/**
 * DELETE /waiting-list/:id
 * ?��??��?（公?��?使用?�話驗�?�?
 */
app.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const { customerPhone } = await c.req.json();

    if (!customerPhone) {
      return c.json({
        success: false,
        error: '需要提供電話號碼'
      }, 400);
    }

    const service = new WaitingListService(c.env.DB, c.env);

    // 驗證電話號碼
    const entry = await service.getWaitingListEntryById(id);
    if (!entry || entry.customerPhone !== customerPhone) {
      return c.json({
        success: false,
        error: '電話號碼不符'
      }, 403);
    }

    const cancelled = await service.cancelWaiting(id);

    return c.json({
      success: true,
      data: cancelled,
      message: '候位已取消'
    });
  } catch (error) {
    console.error('Error cancelling waiting:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '?��??��?失�?'
    }, 400);
  }
});

/**
 * POST /waiting-list/:id/confirm
 * 顧客確�??��?（公?��?
 */
app.post('/:id/confirm', async (c) => {
  try {
    const id = c.req.param('id');
    const service = new WaitingListService(c.env.DB, c.env);

    const confirmed = await service.confirmWaiting(id);

    return c.json({
      success: true,
      data: confirmed,
      message: '已確認，請盡快入座'
    });
  } catch (error) {
    console.error('Error confirming waiting:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '確�?失�?'
    }, 400);
  }
});

// ==========================================
// Protected Routes - ?��?�?證�?店員/管�??��?
// ==========================================

app.use('/*', authMiddleware);

/**
 * GET /waiting-list
 * ?�詢?��??�表
 */
app.get('/', requireRole([0, 1, 3, 4]), async (c) => {
  try {
    const user = c.get('user');
    const service = new WaitingListService(c.env.DB, c.env);

    // 建構過濾條件
    const filters: WaitingListFilters = {
      restaurantId: user.role === 0 ? c.req.query('restaurantId') : user.restaurantId!.toString(),
      status: c.req.query('status') as WaitingStatus,
      customerPhone: c.req.query('phone'),
      date: c.req.query('date'),
      page: parseInt(c.req.query('page') || '1'),
      limit: parseInt(c.req.query('limit') || '50')
    };

    const result = await service.listWaitingList(filters);

    return c.json({
      success: true,
      data: result.data,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / (filters.limit || 50))
      }
    });
  } catch (error) {
    console.error('Error listing waiting list:', error);
    return c.json({
      success: false,
      error: '查詢候位列表失敗'
    }, 500);
  }
});

/**
 * POST /waiting-list/:id/call
 * ?��?
 */
app.post('/:id/call', requireRole([0, 1, 3, 4]), async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json<CallWaitingRequest>();
    const service = new WaitingListService(c.env.DB, c.env);

    if (!body.tableId) {
      return c.json({
        success: false,
        error: '需要指定桌位'
      }, 400);
    }

    // 權限檢查
    const entry = await service.getWaitingListEntryById(id);
    if (!entry) {
      return c.json({
        success: false,
        error: '找不到此候位記錄'
      }, 404);
    }

    const user = c.get('user');
    if (user.role !== 0 && entry.restaurantId !== user.restaurantId!.toString()) {
      return c.json({
        success: false,
        error: '無權限操作此候位'
      }, 403);
    }

    const called = await service.callWaiting(id, body);

    return c.json({
      success: true,
      data: called,
      message: '已叫號，通知已發送'
    });
  } catch (error) {
    console.error('Error calling waiting:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '叫號失敗'
    }, 400);
  }
});

/**
 * POST /waiting-list/:id/seat
 * 標�??�座
 */
app.post('/:id/seat', requireRole([0, 1, 3, 4]), async (c) => {
  try {
    const id = c.req.param('id');
    const service = new WaitingListService(c.env.DB, c.env);

    // 權限檢查
    const entry = await service.getWaitingListEntryById(id);
    if (!entry) {
      return c.json({
        success: false,
        error: '找不到此候位記錄'
      }, 404);
    }

    const user = c.get('user');
    if (user.role !== 0 && entry.restaurantId !== user.restaurantId!.toString()) {
      return c.json({
        success: false,
        error: '無權限操作此候位'
      }, 403);
    }

    const seated = await service.markSeated(id);

    return c.json({
      success: true,
      data: seated,
      message: '已登記入座'
    });
  } catch (error) {
    console.error('Error marking seated:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '標記入座失敗'
    }, 400);
  }
});

/**
 * POST /waiting-list/:id/expire
 * 標�??��?
 */
app.post('/:id/expire', requireRole([0, 1, 3, 4]), async (c) => {
  try {
    const id = c.req.param('id');
    const service = new WaitingListService(c.env.DB, c.env);

    // 權限檢查
    const entry = await service.getWaitingListEntryById(id);
    if (!entry) {
      return c.json({
        success: false,
        error: '找不到此候位記錄'
      }, 404);
    }

    const user = c.get('user');
    if (user.role !== 0 && entry.restaurantId !== user.restaurantId!.toString()) {
      return c.json({
        success: false,
        error: '無權限操作此候位'
      }, 403);
    }

    const expired = await service.expireWaiting(id);

    return c.json({
      success: true,
      data: expired,
      message: '已登記過期'
    });
  } catch (error) {
    console.error('Error marking expired:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '標記過期失敗'
    }, 400);
  }
});

/**
 * GET /waiting-list/stats/:restaurantId
 * ?��??��?統�?
 */
app.get('/stats/:restaurantId', requireRole([0, 1]), async (c) => {
  try {
    const restaurantId = c.req.param('restaurantId');
    const date = c.req.query('date'); // YYYY-MM-DD
    const service = new WaitingListService(c.env.DB, c.env);

    // 權限檢查
    const user = c.get('user');
    if (user.role !== 0 && restaurantId !== user.restaurantId!.toString()) {
      return c.json({
        success: false,
        error: '無權限查看此統計'
      }, 403);
    }

    const stats = await service.getWaitingStats(restaurantId, date);

    return c.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting waiting stats:', error);
    return c.json({
      success: false,
      error: '查詢統計失敗'
    }, 500);
  }
});

/**
 * POST /waiting-list/batch-call
 * ?�次?��?（自?�叫下�?組�?
 */
app.post('/batch-call', requireRole([0, 1, 3, 4]), async (c) => {
  try {
    const { restaurantId, count = 1 } = await c.req.json();
    const user = c.get('user');

    // 權�?檢查
    const targetRestaurantId = user.role === 0 ? restaurantId : user.restaurantId;
    if (!targetRestaurantId) {
      return c.json({
        success: false,
        error: '?��?�?定�?�?ID'
      }, 400);
    }

    const service = new WaitingListService(c.env.DB, c.env);

    // ?�詢等�?中�??��?（�??��?�?
    const { data: waitingList } = await service.listWaitingList({
      restaurantId: targetRestaurantId,
      status: WaitingStatus.WAITING,
      limit: count
    });

    const results = [];

    for (const entry of waitingList) {
      try {
        // 需要自動分配桌位
        // TODO: 實現自動桌位分配邏輯
        // 暫時跳過
        results.push({
          id: entry.id,
          success: false,
          message: '需要手動指定桌位'
        });
      } catch (error) {
        results.push({
          id: entry.id,
          success: false,
          message: error instanceof Error ? error.message : '?��?失�?'
        });
      }
    }

    return c.json({
      success: true,
      data: results,
      message: `?��?完�?`
    });
  } catch (error) {
    console.error('Error batch calling:', error);
    return c.json({
      success: false,
      error: '?�次?��?失�?'
    }, 500);
  }
});

export default app;
