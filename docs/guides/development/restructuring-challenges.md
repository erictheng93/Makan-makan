# MakanMakan 重構專案主要挑戰與解決方案

## 🎯 重構挑戰總覽

### 📊 挑戰優先級矩陣

| 挑戰類別 | 影響程度 | 複雜度 | 時間需求 | 優先級 |
|---------|---------|-------|---------|--------|
| 架構轉換 | 🔴 極高 | 🔴 極高 | 4-6週 | P0 |
| 資料遷移 | 🔴 極高 | 🟡 中等 | 2-3週 | P0 |
| 前端重寫 | 🟡 中等 | 🟡 中等 | 3-4週 | P1 |
| 業務邏輯轉換 | 🟡 中等 | 🟡 中等 | 2-3週 | P1 |
| 測試與驗證 | 🟡 中等 | 🔴 極高 | 持續進行 | P1 |
| 用戶遷移 | 🟡 中等 | 🟢 低 | 1-2週 | P2 |

---

## 🔴 P0級挑戰：架構轉換

### 💥 挑戰1：從Monolith到Serverless的根本性轉換

#### 現狀分析
```
❌ 當前架構：
PHP Monolith Application
    ├── 單一PHP應用處理所有邏輯
    ├── 傳統Apache/Nginx + MySQL部署
    ├── 檔案式session管理  
    ├── 直接資料庫連接
    └── 同步處理所有請求

✅ 目標架構：
Cloudflare Serverless Ecosystem
    ├── 多個Workers處理不同功能
    ├── D1無伺服器資料庫
    ├── KV分散式快取
    ├── 邊緣計算與CDN
    └── 事件驅動異步處理
```

#### 具體挑戰
```typescript
// ❌ PHP中的典型請求處理
<?php
session_start();
$db = new mysqli($host, $user, $pass, $db);
$result = $db->query("SELECT * FROM shop_menu WHERE shop_ID = " . $_GET['shop_id']);
while($row = $result->fetch_assoc()) {
    echo json_encode($row);
}
?>

// ✅ Workers中的對應處理
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const shopId = url.searchParams.get('shop_id');
    
    // 快取檢查
    const cacheKey = `menu:${shopId}`;
    let menu = await env.CACHE_KV.get(cacheKey);
    
    if (!menu) {
      // D1資料庫查詢
      const result = await env.DB.prepare(
        "SELECT * FROM menu_items WHERE restaurant_id = ? AND is_available = 1"
      ).bind(shopId).all();
      
      menu = JSON.stringify(result.results);
      await env.CACHE_KV.put(cacheKey, menu, { expirationTtl: 300 });
    }
    
    return new Response(menu, {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
```

#### 解決策略
1. **分階段遷移**：API優先，前端次之
2. **並行開發**：維持舊系統運行，同時建構新系統
3. **Adapter模式**：建立轉換層處理資料格式差異

---

## 💥 挑戰2：資料遷移的複雜性

### 問題識別
```sql
-- ❌ 原始資料結構問題
CREATE TABLE `shop_menu` (
  `menu_price` decimal(10,2),           -- 浮點精度問題
  `menu_nonveg` tinyint(1),            -- 多個布林欄位冗餘
  `menu_wholeveg` tinyint(1),
  `menu_eggveg` tinyint(1),
  `menu_milkveg` tinyint(1),
  `menu_eggmilkveg` tinyint(1),
  `menu_spices1` tinyint(1),           -- 辣度分散設計
  `menu_spices2` tinyint(1),
  `menu_spices3` tinyint(1)
);

-- ✅ 優化後的結構
CREATE TABLE menu_items (
  price INTEGER NOT NULL,              -- 以分為單位，避免精度問題
  dietary_info TEXT,                   -- JSON: {"vegetarian": true, "vegan": false}
  spice_level INTEGER CHECK(spice_level BETWEEN 0 AND 4) -- 統一辣度級別
);
```

### 遷移挑戰

#### 1. **資料型別轉換**
```typescript
interface DataTransformation {
  // 價格轉換：decimal -> integer (分)
  priceTransform: (mysqlPrice: number) => number;
  // 多布林欄位 -> JSON
  dietaryTransform: (flags: BooleanFlags) => DietaryInfo;
  // 辣度級別整合
  spiceLevelTransform: (spiceFlags: SpiceFlags) => number;
}

// 實作範例
const transformMenuData = (mysqlRow: MySQLMenuRow): D1MenuRow => {
  return {
    id: mysqlRow.menu_sn,
    restaurant_id: mysqlRow.shop_ID,
    name: mysqlRow.menu_foodname,
    price: Math.round(mysqlRow.menu_price * 100), // 轉為分
    dietary_info: JSON.stringify({
      vegetarian: mysqlRow.menu_wholeveg === 1,
      vegan: mysqlRow.menu_wholeveg === 1,
      halal: !mysqlRow.menu_nonveg
    }),
    spice_level: calculateSpiceLevel({
      none: mysqlRow.menu_nonspices,
      mild: mysqlRow.menu_spices1,
      medium: mysqlRow.menu_spices2,  
      hot: mysqlRow.menu_spices3
    })
  };
};
```

#### 2. **資料完整性驗證**
```typescript
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

const validateMigratedData = async (sourceCount: number, targetCount: number): Promise<ValidationResult> => {
  const errors: string[] = [];
  
  // 記錄數量檢查
  if (sourceCount !== targetCount) {
    errors.push(`Record count mismatch: MySQL(${sourceCount}) vs D1(${targetCount})`);
  }
  
  // 資料採樣檢查
  const sampleValidation = await validateSampleRecords();
  if (!sampleValidation.isValid) {
    errors.push(...sampleValidation.errors);
  }
  
  return { isValid: errors.length === 0, errors, warnings: [] };
};
```

### 解決方案
1. **分批遷移**：避免一次性大量資料轉換
2. **回滾機制**：失敗時能快速恢復
3. **驗證機制**：多層次的資料完整性檢查

---

## 🟡 P1級挑戰：前端技術棧轉換

### 💥 挑戰3：從PHP渲染到SPA架構

#### 原始架構問題
```php
<?php
// ❌ 伺服器端渲染混合邏輯
include 'config.php';
$shop_id = $_GET['shop_id'];
$menu = getMenuByShop($shop_id);
?>
<html>
<head><title>菜單</title></head>
<body>
  <?php foreach($menu as $item): ?>
    <div class="menu-item">
      <h3><?= $item['menu_foodname'] ?></h3>
      <p>$<?= $item['menu_price'] ?></p>
    </div>
  <?php endforeach; ?>
</body>
</html>
```

#### 目標架構
```vue
<!-- ✅ Vue.js 3 Composition API -->
<template>
  <div class="menu-container">
    <MenuCard
      v-for="item in menuItems"
      :key="item.id"
      :item="item"
      @add-to-cart="handleAddToCart"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useMenuStore } from '@/stores/menu';
import type { MenuItem } from '@makanmakan/shared-types';

const menuStore = useMenuStore();
const menuItems = ref<MenuItem[]>([]);

onMounted(async () => {
  await menuStore.fetchMenu(restaurantId);
  menuItems.value = menuStore.items;
});

const handleAddToCart = (item: MenuItem) => {
  cartStore.addItem(item);
};
</script>
```

#### 轉換挑戰
1. **狀態管理**：從Session到Pinia/Vuex
2. **路由處理**：從PHP路由到Vue Router
3. **資料流向**：從同步到異步API調用
4. **型別安全**：JavaScript到TypeScript

### 解決策略
```typescript
// ✅ 漸進式遷移策略
interface MigrationPhase {
  phase1: {
    target: "建立基本Vue結構";
    timeline: "1週";
    components: ["MenuView", "OrderView", "基本路由"];
  };
  phase2: {
    target: "API整合";
    timeline: "1週";  
    components: ["API client", "狀態管理", "錯誤處理"];
  };
  phase3: {
    target: "進階功能";
    timeline: "2週";
    components: ["即時更新", "離線支援", "PWA功能"];
  };
}
```

---

## 🟡 P1級挑戰：即時功能實作

### 💥 挑戰4：從輪詢到WebSocket的即時性轉換

#### 現有方案問題
```javascript
// ❌ 原始輪詢方式
setInterval(() => {
  fetch('/check_order_status.php?order_id=' + orderId)
    .then(response => response.json())
    .then(data => {
      if (data.status !== currentStatus) {
        updateOrderStatus(data.status);
        currentStatus = data.status;
      }
    });
}, 5000); // 每5秒輪詢一次
```

#### 目標即時方案
```typescript
// ✅ Durable Objects + WebSocket
export class OrderNotifier {
  constructor(private state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/websocket') {
      const [client, server] = new WebSocketPair();
      await this.state.acceptWebSocket(server);
      
      const restaurantId = url.searchParams.get('restaurant_id');
      const userRole = url.searchParams.get('role');
      
      server.serializeAttachment({ restaurantId, userRole });
      
      return new Response(null, { status: 101, webSocket: client });
    }
    
    return new Response('Not found', { status: 404 });
  }

  async broadcastOrderUpdate(orderId: string, status: OrderStatus, restaurantId: string) {
    const message = {
      type: 'ORDER_STATUS_UPDATE',
      orderId,
      status,
      timestamp: Date.now()
    };

    this.state.getWebSockets().forEach(ws => {
      const attachment = ws.deserializeAttachment();
      if (attachment?.restaurantId === restaurantId) {
        ws.send(JSON.stringify(message));
      }
    });
  }
}
```

#### 實作挑戰
1. **連接管理**：處理連接斷開和重連
2. **訊息路由**：基於角色的訊息過濾
3. **擴展性**：多個餐廳的訊息隔離
4. **可靠性**：訊息傳遞保證

---

## 🔴 P0級挑戰：業務邏輯遷移

### 💥 挑戰5：複雜業務邏輯的重新實作

#### PHP業務邏輯範例
```php
<?php
// ❌ 混雜的訂單處理邏輯
function processOrder($orderData) {
    global $db;
    
    // 驗證庫存
    foreach($orderData['items'] as $item) {
        $stock = $db->query("SELECT inventory_count FROM shop_menu WHERE menu_sn = " . $item['id']);
        if($stock->fetch_assoc()['inventory_count'] < $item['quantity']) {
            return ['error' => 'Insufficient stock'];
        }
    }
    
    // 計算價格
    $total = 0;
    foreach($orderData['items'] as $item) {
        $price = $db->query("SELECT menu_price FROM shop_menu WHERE menu_sn = " . $item['id']);
        $total += $price->fetch_assoc()['menu_price'] * $item['quantity'];
    }
    
    // 建立訂單
    $orderId = uniqid();
    $db->query("INSERT INTO shop_order VALUES(...)");
    
    // 更新庫存
    foreach($orderData['items'] as $item) {
        $db->query("UPDATE shop_menu SET inventory_count = inventory_count - " . $item['quantity'] . " WHERE menu_sn = " . $item['id']);
    }
    
    return ['success' => true, 'orderId' => $orderId];
}
?>
```

#### 重構後的Workers實作
```typescript
// ✅ 結構化的業務邏輯
export class OrderService {
  constructor(private db: D1Database, private cache: KVNamespace) {}

  async processOrder(orderData: CreateOrderRequest): Promise<ProcessOrderResult> {
    return await this.db.batch([
      // 1. 驗證階段
      this.validateOrderItems(orderData.items),
      
      // 2. 計算階段  
      this.calculateOrderTotal(orderData.items),
      
      // 3. 建立訂單
      this.createOrder(orderData),
      
      // 4. 更新庫存
      this.updateInventory(orderData.items)
    ]);
  }

  private async validateOrderItems(items: OrderItem[]): Promise<ValidationResult> {
    const validation = await Promise.all(
      items.map(async item => {
        const menuItem = await this.getMenuItem(item.menuItemId);
        
        return {
          isValid: menuItem.inventory_count >= item.quantity,
          item: menuItem,
          requestedQuantity: item.quantity
        };
      })
    );

    const invalid = validation.filter(v => !v.isValid);
    
    return {
      isValid: invalid.length === 0,
      errors: invalid.map(v => `Insufficient stock for ${v.item.name}`)
    };
  }

  private async createOrder(orderData: CreateOrderRequest): Promise<Order> {
    const orderNumber = this.generateOrderNumber(orderData.restaurantId, orderData.tableId);
    
    const order = await this.db.prepare(`
      INSERT INTO orders (restaurant_id, table_id, order_number, total_amount, status)
      VALUES (?, ?, ?, ?, 0)
    `).bind(
      orderData.restaurantId,
      orderData.tableId, 
      orderNumber,
      orderData.totalAmount
    ).run();

    // 建立訂單項目
    const orderItems = await this.createOrderItems(order.meta.last_row_id, orderData.items);
    
    // 觸發即時通知
    await this.notifyOrderCreated(order.meta.last_row_id);
    
    return { id: order.meta.last_row_id, orderNumber, items: orderItems };
  }
}
```

#### 遷移策略
1. **服務分層**：清晰的業務邏輯分層
2. **異步處理**：利用Queues處理長時間任務
3. **事務管理**：使用D1的batch處理保證一致性
4. **錯誤處理**：完整的錯誤處理和回滾機制

---

## 🟡 P1級挑戰：測試與品質保證

### 💥 挑戰6：無測試環境到完整測試覆蓋

#### 現狀問題
```
❌ 當前測試情況：
- 無單元測試
- 無整合測試  
- 手動測試為主
- 缺乏自動化驗證
- 無效能測試
```

#### 目標測試架構
```typescript
// ✅ 完整測試策略
interface TestingStrategy {
  unitTests: {
    framework: "Vitest";
    coverage: "> 80%";
    focus: ["業務邏輯", "工具函式", "資料驗證"];
  };
  
  integrationTests: {
    framework: "Playwright";
    coverage: "核心API 100%";
    focus: ["API端點", "資料庫操作", "快取邏輯"];
  };
  
  e2eTests: {
    framework: "Playwright";
    coverage: "主要用戶流程 100%";
    focus: ["點餐流程", "訂單管理", "用戶註冊"];
  };
  
  performanceTests: {
    tool: "K6";
    targets: ["API響應時間 < 300ms", "併發 1000+ QPS"];
  };
}

// 單元測試範例
describe('OrderService', () => {
  it('should calculate order total correctly', () => {
    const orderService = new OrderService(mockDB, mockKV);
    const items = [
      { menuItemId: 1, quantity: 2, unitPrice: 1500 },
      { menuItemId: 2, quantity: 1, unitPrice: 800 }
    ];
    
    const total = orderService.calculateTotal(items);
    expect(total).toBe(3800); // 15.00 * 2 + 8.00 * 1 = 38.00 (in cents)
  });
});

// 整合測試範例
describe('Menu API', () => {
  it('should return restaurant menu with proper caching', async () => {
    const response = await request(app)
      .get('/api/v1/menu/1')
      .expect(200);
      
    expect(response.body.success).toBe(true);
    expect(response.body.data.length).toBeGreaterThan(0);
    
    // 驗證快取
    const cachedResponse = await request(app)
      .get('/api/v1/menu/1')
      .expect(200);
      
    expect(cachedResponse.headers['cf-cache-status']).toBe('HIT');
  });
});
```

---

## 🎯 總體解決策略

### 📅 時間軸與里程碑

```gantt
title MakanMakan 重構時間軸
dateFormat YYYY-MM-DD
section 基礎建設
Cloudflare設置         :done, setup, 2025-08-23, 1d
項目架構建立           :active, arch, after setup, 3d
資料庫設計             :db, after arch, 5d
section 後端開發  
API Workers開發        :api, after db, 14d
資料遷移腳本           :migrate, after db, 7d
即時功能實作           :realtime, after api, 10d
section 前端開發
Customer App開發       :customer, after api, 14d  
Admin Dashboard開發    :admin, after customer, 14d
section 測試與部署
整合測試               :test, after admin, 7d
效能測試               :perf, after test, 3d
生產部署               :deploy, after perf, 2d
```

### 🛡️ 風險緩解策略

1. **技術風險**
   - **並行開發**：維持舊系統同時開發新系統
   - **Feature Flag**：逐步切換功能
   - **A/B Testing**：驗證新功能效果

2. **資料風險**
   - **資料備份**：完整的資料備份策略
   - **回滾機制**：快速回滾到穩定狀態
   - **分批遷移**：降低單次遷移風險

3. **業務風險**
   - **用戶通知**：提前告知系統升級
   - **客服支援**：加強客服團隊準備
   - **監控告警**：完整的系統監控

### 📊 成功指標

| 指標類別 | 具體指標 | 目標值 | 測量方法 |
|---------|---------|--------|----------|
| 效能指標 | API響應時間 | P99 < 300ms | Workers Analytics |
| 可用性 | 系統正常運行時間 | > 99.9% | 監控系統 |
| 用戶體驗 | 頁面載入時間 | < 2s | Web Vitals |
| 開發效率 | 部署頻率 | 每日 | CI/CD統計 |
| 程式品質 | 測試覆蓋率 | > 80% | 測試報告 |

---

**總結**：重構專案的成功關鍵在於**分階段執行**、**完整測試**、**風險控制**，以及**持續監控和調整**。透過系統性的方法和完善的準備，可以有效降低重構風險並確保專案成功。