/**
 * Artillery 性能測試處理器
 * 提供自定義函式用於 WebSocket token 生成和測試邏輯
 */

const API_BASE_URL = process.env.API_URL || 'http://localhost:8787';

/**
 * 生成隨機房間 ID
 */
function generateRoomId(type) {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `${type}_${timestamp}_${random}`;
}

/**
 * 獲取 Kitchen Token
 */
async function getKitchenToken(context, events, done) {
  const roomId = generateRoomId('kitchen');
  const restaurantId = '1';
  const sessionId = `session_kitchen_${Date.now()}`;

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/realtime/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        roomType: 'kitchen',
        roomId,
        restaurantId,
        sessionId
      })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      context.vars.token = data.data.token;
      // 使用 restaurantId 作為路由參數（而不是 roomId）
      context.vars.roomId = restaurantId;
      context.vars.restaurantId = restaurantId;

      events.emit('counter', 'tokens.kitchen.success', 1);
    } else {
      events.emit('counter', 'tokens.kitchen.failed', 1);
      console.error('Failed to get kitchen token:', data.error);
    }
  } catch (error) {
    events.emit('counter', 'tokens.kitchen.error', 1);
    console.error('Error getting kitchen token:', error.message);
  }

  return done();
}

/**
 * 獲取 Admin Token
 */
async function getAdminToken(context, events, done) {
  const roomId = generateRoomId('admin');
  const restaurantId = '1';
  const sessionId = `session_admin_${Date.now()}`;

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/realtime/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        roomType: 'admin',
        roomId,
        restaurantId,
        sessionId
      })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      context.vars.token = data.data.token;
      // 使用 restaurantId 作為路由參數（而不是 roomId）
      context.vars.roomId = restaurantId;
      context.vars.restaurantId = restaurantId;

      events.emit('counter', 'tokens.admin.success', 1);
    } else {
      events.emit('counter', 'tokens.admin.failed', 1);
      console.error('Failed to get admin token:', data.error);
    }
  } catch (error) {
    events.emit('counter', 'tokens.admin.error', 1);
    console.error('Error getting admin token:', error.message);
  }

  return done();
}

/**
 * 獲取 Customer Token
 * 注意：需要有效的 table ID，這裡使用測試用 ID
 */
async function getCustomerToken(context, events, done) {
  const roomId = generateRoomId('customer');
  const restaurantId = '1';
  // 這裡應該使用實際存在的 table ID
  // 在實際測試中，需要先創建測試數據
  const tableId = process.env.TEST_TABLE_ID || '1';

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/realtime/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        roomType: 'customer',
        roomId,
        restaurantId,
        tableId
      })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      context.vars.token = data.data.token;
      // 使用 tableId 作為路由參數（而不是 roomId）
      context.vars.roomId = tableId;
      context.vars.restaurantId = restaurantId;
      context.vars.tableId = tableId;

      events.emit('counter', 'tokens.customer.success', 1);
    } else {
      events.emit('counter', 'tokens.customer.failed', 1);
      // Customer token 可能因為 table ID 不存在而失敗，這是預期的
      // 在實際測試前需要準備測試數據
    }
  } catch (error) {
    events.emit('counter', 'tokens.customer.error', 1);
    console.error('Error getting customer token:', error.message);
  }

  return done();
}

/**
 * 記錄連線建立時間
 */
function logConnectionEstablished(context, events, done) {
  events.emit('counter', 'connections.established', 1);
  return done();
}

/**
 * 記錄訊息接收
 */
function logMessageReceived(context, events, done) {
  events.emit('counter', 'messages.received', 1);
  return done();
}

/**
 * 記錄訊息發送
 */
function logMessageSent(context, events, done) {
  events.emit('counter', 'messages.sent', 1);
  return done();
}

// 導出函式供 Artillery 使用
module.exports = {
  getKitchenToken,
  getAdminToken,
  getCustomerToken,
  logConnectionEstablished,
  logMessageReceived,
  logMessageSent
};
