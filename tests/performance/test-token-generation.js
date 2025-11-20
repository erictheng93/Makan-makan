/**
 * 獨立測試 Token 生成
 * 用於診斷 Artillery processor 問題
 */

const API_BASE_URL = process.env.API_URL || 'http://localhost:8787';

async function testTokenGeneration() {
  console.log('=== 測試 Token 生成 ===');
  console.log('API URL:', API_BASE_URL);
  console.log('');

  // Test 1: Kitchen Token
  console.log('1. 測試 Kitchen Token');
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/realtime/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        roomType: 'kitchen',
        roomId: 'test-kitchen-1',
        restaurantId: '1',
        sessionId: 'test-session-kitchen'
      })
    });

    console.log('   Status:', response.status);
    const data = await response.json();
    console.log('   Response:', JSON.stringify(data, null, 2));

    if (data.success && data.data.token) {
      console.log('   ✅ Kitchen Token 生成成功');
      console.log('   Token 長度:', data.data.token.length);
    } else {
      console.log('   ❌ Kitchen Token 生成失敗');
    }
  } catch (error) {
    console.log('   ❌ 錯誤:', error.message);
  }

  console.log('');

  // Test 2: Admin Token
  console.log('2. 測試 Admin Token');
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/realtime/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        roomType: 'admin',
        roomId: 'test-admin-1',
        restaurantId: '1',
        sessionId: 'test-session-admin'
      })
    });

    console.log('   Status:', response.status);
    const data = await response.json();
    console.log('   Response:', JSON.stringify(data, null, 2));

    if (data.success && data.data.token) {
      console.log('   ✅ Admin Token 生成成功');
    } else {
      console.log('   ❌ Admin Token 生成失敗');
    }
  } catch (error) {
    console.log('   ❌ 錯誤:', error.message);
  }

  console.log('');

  // Test 3: Customer Token
  console.log('3. 測試 Customer Token');
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/realtime/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        roomType: 'customer',
        roomId: 'test-customer-1',
        restaurantId: '1',
        tableId: '1'
      })
    });

    console.log('   Status:', response.status);
    const data = await response.json();
    console.log('   Response:', JSON.stringify(data, null, 2));

    if (data.success && data.data.token) {
      console.log('   ✅ Customer Token 生成成功');
    } else {
      console.log('   ❌ Customer Token 生成失敗');
    }
  } catch (error) {
    console.log('   ❌ 錯誤:', error.message);
  }

  console.log('');
  console.log('=== 測試完成 ===');
}

// 執行測試
testTokenGeneration().catch(console.error);
