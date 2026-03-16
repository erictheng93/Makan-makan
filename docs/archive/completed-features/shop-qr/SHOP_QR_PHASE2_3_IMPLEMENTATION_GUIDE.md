# Shop QR Code - Phase 2 & 3 实施指南

## ✅ 已完成的工作

### Phase 1 - 后端 (100% 完成)

- ✅ 数据库 migration
- ✅ TypeScript schemas
- ✅ RestaurantService (7个新方法)
- ✅ API endpoints (6个)
- ✅ Validation schemas

### Phase 2 - 前端基础 (50% 完成)

- ✅ QR Parser 增强（支持 shop/table/seat 三种类型）
- ⏸️ 路由系统更新
- ⏸️ 手机验证组件
- ⏸️ ShopMenuView 组件
- ⏸️ QRScanView 逻辑更新

---

## 📝 Phase 2 - 剩余实施步骤

### 步骤 1: 更新路由系统

**文件**: `apps/customer-app/src/router/index.ts`

在现有路由数组中添加以下路由：

```typescript
// 在 routes 数组中添加（在 RestaurantMenu 路由之后）

{
  path: "/restaurant/:restaurantId/shop",
  name: "ShopVerification",
  component: () => import("@/views/ShopPhoneVerificationView.vue"),
  props: (route) => ({
    restaurantId: Number(route.params.restaurantId),
    shopQrCode: route.query.qr as string,
  }),
  meta: {
    title: "驗證手機號碼",
  },
},
{
  path: "/restaurant/:restaurantId/shop/menu",
  name: "ShopMenu",
  component: () => import("@/views/ShopMenuView.vue"),
  props: (route) => ({
    restaurantId: Number(route.params.restaurantId),
    phoneLastDigits: route.query.phone as string,
  }),
  meta: {
    title: "店家菜單",
  },
},
```

---

### 步骤 2: 创建手机验证组件

**文件**: `apps/customer-app/src/views/ShopPhoneVerificationView.vue`

```vue
<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
    <div class="max-w-md mx-auto pt-20">
      <!-- Logo / Header -->
      <div class="text-center mb-8">
        <div class="inline-block p-4 bg-white rounded-full shadow-lg mb-4">
          <svg
            class="w-12 h-12 text-indigo-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-gray-800">歡迎光臨</h1>
        <p class="text-gray-600 mt-2">{{ restaurantName }}</p>
      </div>

      <!-- Phone Verification Card -->
      <div class="bg-white rounded-2xl shadow-xl p-8">
        <div class="mb-6">
          <h2 class="text-xl font-semibold text-gray-800 mb-2">驗證手機號碼</h2>
          <p class="text-sm text-gray-600">請輸入手機號碼後3位數字以開始點餐</p>
        </div>

        <form @submit.prevent="handleSubmit">
          <!-- Phone Input -->
          <div class="mb-6">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              手機號碼後3位
            </label>
            <input
              v-model="phoneLastDigits"
              type="text"
              inputmode="numeric"
              pattern="[0-9]{3}"
              maxlength="3"
              placeholder="例如: 123"
              class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-center text-2xl tracking-widest"
              :class="{ 'border-red-500': error }"
              required
              autofocus
            />
            <p v-if="error" class="mt-2 text-sm text-red-600">{{ error }}</p>
          </div>

          <!-- Submit Button -->
          <button
            type="submit"
            :disabled="isLoading || phoneLastDigits.length !== 3"
            class="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <span v-if="!isLoading">開始點餐</span>
            <span v-else class="flex items-center justify-center">
              <svg
                class="animate-spin h-5 w-5 mr-3"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                />
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              驗證中...
            </span>
          </button>
        </form>

        <!-- Info -->
        <div class="mt-6 p-4 bg-blue-50 rounded-lg">
          <div class="flex">
            <svg
              class="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div class="ml-3">
              <p class="text-sm text-blue-800">
                我們僅使用手機後3位數字來識別您的訂單，不會記錄完整手機號碼
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Back Button -->
      <button
        @click="router.back()"
        class="mt-6 w-full text-gray-600 py-2 hover:text-gray-800 transition-colors"
      >
        ← 返回
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import axios from "axios";

const props = defineProps<{
  restaurantId: number;
  shopQrCode?: string;
}>();

const router = useRouter();
const toast = useToast();

const phoneLastDigits = ref("");
const isLoading = ref(false);
const error = ref("");
const restaurantName = ref("");

onMounted(async () => {
  // 驗證 QR Code 並獲取餐廳資訊
  if (props.shopQrCode) {
    await verifyQRCode();
  } else {
    await fetchRestaurantInfo();
  }
});

const verifyQRCode = async () => {
  try {
    const response = await axios.get(
      `/api/v1/qr-codes/verify/shop/${props.shopQrCode}`,
    );
    if (response.data.success && response.data.data.valid) {
      restaurantName.value = response.data.data.restaurant.name;
    } else {
      toast.error("無效的QR Code");
      router.push("/");
    }
  } catch (err) {
    console.error("QR驗證失敗:", err);
    toast.error("QR Code驗證失敗");
    router.push("/");
  }
};

const fetchRestaurantInfo = async () => {
  try {
    const response = await axios.get(
      `/api/v1/restaurants/${props.restaurantId}`,
    );
    if (response.data.success) {
      restaurantName.value = response.data.data.name;
    }
  } catch (err) {
    console.error("獲取餐廳資訊失敗:", err);
  }
};

const handleSubmit = async () => {
  error.value = "";

  // 驗證輸入
  if (!/^\d{3}$/.test(phoneLastDigits.value)) {
    error.value = "請輸入3位數字";
    return;
  }

  isLoading.value = true;

  try {
    // 導航到菜單頁面
    await router.push({
      name: "ShopMenu",
      params: { restaurantId: props.restaurantId },
      query: { phone: phoneLastDigits.value },
    });

    toast.success("驗證成功！");
  } catch (err) {
    console.error("驗證失敗:", err);
    error.value = "驗證失敗，請重試";
  } finally {
    isLoading.value = false;
  }
};
</script>
```

---

### 步骤 3: 创建店家菜单组件

**文件**: `apps/customer-app/src/views/ShopMenuView.vue`

```vue
<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white shadow-sm sticky top-0 z-10">
      <div class="max-w-7xl mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-xl font-bold text-gray-900">
              {{ restaurant?.name || "店家菜單" }}
            </h1>
            <p class="text-sm text-gray-600">手機尾號: {{ phoneLastDigits }}</p>
          </div>
          <button
            @click="viewCart"
            class="relative bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <span class="flex items-center">
              <svg
                class="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              購物車
            </span>
            <span
              v-if="cart.length > 0"
              class="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center"
            >
              {{ cart.length }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- Menu Content -->
    <div class="max-w-7xl mx-auto px-4 py-6">
      <div v-if="isLoading" class="text-center py-12">
        <div
          class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"
        ></div>
        <p class="mt-4 text-gray-600">載入菜單中...</p>
      </div>

      <div v-else-if="error" class="text-center py-12">
        <p class="text-red-600">{{ error }}</p>
        <button
          @click="loadMenu"
          class="mt-4 text-indigo-600 hover:text-indigo-800"
        >
          重新載入
        </button>
      </div>

      <div v-else>
        <!-- Categories -->
        <div v-for="category in categories" :key="category.id" class="mb-8">
          <h2 class="text-lg font-semibold text-gray-900 mb-4 px-2">
            {{ category.name }}
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div
              v-for="item in getItemsByCategory(category.id)"
              :key="item.id"
              class="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow"
            >
              <div class="p-4">
                <div class="flex justify-between items-start mb-2">
                  <h3 class="font-medium text-gray-900">{{ item.name }}</h3>
                  <span class="text-lg font-bold text-indigo-600">
                    ${{ item.price }}
                  </span>
                </div>
                <p v-if="item.description" class="text-sm text-gray-600 mb-4">
                  {{ item.description }}
                </p>
                <button
                  @click="addToCart(item)"
                  class="w-full bg-indigo-100 text-indigo-700 py-2 rounded-lg hover:bg-indigo-200 transition-colors font-medium"
                >
                  加入購物車
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import axios from "axios";

const props = defineProps<{
  restaurantId: number;
  phoneLastDigits: string;
}>();

const router = useRouter();
const toast = useToast();

const isLoading = ref(false);
const error = ref("");
const restaurant = ref<any>(null);
const categories = ref<any[]>([]);
const menuItems = ref<any[]>([]);
const cart = ref<any[]>([]);

onMounted(async () => {
  await loadRestaurant();
  await loadMenu();
});

const loadRestaurant = async () => {
  try {
    const response = await axios.get(
      `/api/v1/restaurants/${props.restaurantId}`,
    );
    if (response.data.success) {
      restaurant.value = response.data.data;
    }
  } catch (err) {
    console.error("載入餐廳失敗:", err);
  }
};

const loadMenu = async () => {
  isLoading.value = true;
  error.value = "";

  try {
    // 獲取分類
    const categoriesRes = await axios.get(
      `/api/v1/menu/${props.restaurantId}/categories`,
    );
    if (categoriesRes.data.success) {
      categories.value = categoriesRes.data.data;
    }

    // 獲取菜單項目
    const itemsRes = await axios.get(
      `/api/v1/menu/${props.restaurantId}/items`,
    );
    if (itemsRes.data.success) {
      menuItems.value = itemsRes.data.data;
    }
  } catch (err) {
    console.error("載入菜單失敗:", err);
    error.value = "無法載入菜單，請稍後再試";
  } finally {
    isLoading.value = false;
  }
};

const getItemsByCategory = (categoryId: number) => {
  return menuItems.value.filter((item) => item.categoryId === categoryId);
};

const addToCart = (item: any) => {
  cart.value.push({ ...item, quantity: 1 });
  toast.success(`已加入 ${item.name}`);
};

const viewCart = () => {
  // 儲存購物車到 localStorage 或 Vuex
  localStorage.setItem(
    `cart_shop_${props.restaurantId}_${props.phoneLastDigits}`,
    JSON.stringify(cart.value),
  );

  // 導航到購物車頁面（需要創建）
  router.push({
    name: "ShopCart",
    params: { restaurantId: props.restaurantId },
    query: { phone: props.phoneLastDigits },
  });
};
</script>
```

---

### 步骤 4: 更新 QRScanView

在 `apps/customer-app/src/views/QRScanView.vue` 的 `handleQRCodeDetected` 函數中：

```typescript
const handleQRCodeDetected = async (qrContent: string) => {
  try {
    isLoading.value = true;
    scanStatus.value = "處理QR碼中...";

    // 使用增強的 QR Parser
    const qrData = parseQRContent(qrContent);

    if (!qrData || !validateQRData(qrData)) {
      throw new Error("無效的QR碼格式");
    }

    // 根據 QR 類型導航
    switch (qrData.type) {
      case "shop":
        // 店家模式：導航到手機驗證頁面
        toast.success("掃描成功！");
        router.push({
          name: "ShopVerification",
          params: { restaurantId: qrData.restaurantId },
          query: { qr: qrData.shopQrCode },
        });
        break;

      case "table":
        // 桌台模式：導航到菜單頁面
        toast.success("掃描成功！");
        router.push({
          name: "RestaurantMenu",
          params: {
            restaurantId: qrData.restaurantId,
            tableId: qrData.tableId!,
          },
        });
        break;

      case "seat":
        // 座位模式：導航到菜單頁面（帶座位資訊）
        toast.success("掃描成功！");
        router.push({
          name: "RestaurantMenu",
          params: {
            restaurantId: qrData.restaurantId,
            tableId: qrData.tableId!,
          },
          query: { seatId: qrData.seatId },
        });
        break;
    }
  } catch (err) {
    console.error("QR碼處理失敗:", err);
    setError(err instanceof Error ? err.message : "處理QR碼時發生錯誤");
    scanStatus.value = "請重新對準QR碼";
  } finally {
    isLoading.value = false;
  }
};
```

並在文件頂部導入：

```typescript
import { parseQRContent, validateQRData } from "@/utils/qr-parser";
```

---

## 📝 Phase 3 - Admin Dashboard 實施

### Admin Dashboard - Shop QR 管理頁面

由於 Admin Dashboard 的設計風格已經確立，以下提供核心組件結構。

**文件**: `apps/admin-dashboard/src/views/settings/ShopQRManagementView.vue`

**主要功能**:

1. 查看當前 shop QR code
2. 生成/重新生成 shop QR code
3. 啟用/禁用店家模式
4. 配置店家設置（displayName, instructions, requirePhone）
5. 上傳 QR code 圖片
6. 顯示 QR code 統計

**API 調用**:

```typescript
// 獲取 shop QR 資訊
GET /api/v1/restaurants/:id/qr/shop

// 生成 shop QR
POST /api/v1/restaurants/:id/qr/shop/generate

// 重新生成 shop QR
POST /api/v1/restaurants/:id/qr/shop/regenerate

// 啟用/禁用店家模式
PUT /api/v1/restaurants/:id/shop-mode
{
  "enabled": true,
  "settings": {
    "displayName": "鸡排摊",
    "instructions": "扫描点餐",
    "requirePhone": true
  }
}

// 上傳 QR code 圖片
POST /api/v1/restaurants/:id/qr/shop/upload-image
{
  "imageUrl": "https://..."
}
```

---

## 🧪 測試流程

### 1. 測試店家 QR Code 生成

```bash
# 登錄
curl -X POST http://localhost:8787/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# 生成 shop QR (使用返回的 token)
curl -X POST http://localhost:8787/api/v1/restaurants/1/qr/shop/generate \
  -H "Authorization: Bearer {TOKEN}"
```

### 2. 測試 QR Parser

```typescript
// 在瀏覽器 console
import { parseQRContent } from "@/utils/qr-parser";

// 測試 shop QR
const shopQR = parseQRContent("SHOP-1-1760068334");
console.log(shopQR);
// 應該返回: { type: "shop", restaurantId: 1, shopQrCode: "SHOP-1-1760068334", source: "shop", raw: "..." }

// 測試 table QR (向後兼容)
const tableQR = parseQRContent("1:5");
console.log(tableQR);
// 應該返回: { type: "table", restaurantId: 1, tableId: 5, source: "simple", raw: "1:5" }
```

### 3. 測試完整流程

1. 在 Admin Dashboard 生成 shop QR code
2. 用手機掃描 shop QR code
3. 應該跳轉到手機驗證頁面
4. 輸入手機後3位
5. 跳轉到店家菜單頁面
6. 加入購物車
7. 提交訂單（orderType = "shop"）

---

## 📊 完成狀態

### Phase 1 - 後端 ✅ 100%

- 數據庫 migrations
- TypeScript schemas
- Services
- API endpoints
- Validation

### Phase 2 - 前端基礎 ✅ 70%

- ✅ QR Parser 增強
- ✅ 實施指南完整
- ⏸️ 需手動創建組件文件

### Phase 3 - Admin Dashboard ⏸️ 0%

- 需基於 admin dashboard 設計風格實施

---

## 🎯 後續工作

1. 根據本指南創建剩餘 Vue 組件
2. 在 Admin Dashboard 添加 Shop QR 管理界面
3. 測試完整用戶流程
4. 調整樣式以匹配 Admin Dashboard 設計
5. 添加錯誤處理和邊界情況

---

**實施時間估計**: 2-4 小時
**技術難度**: 中等
**前置要求**: 熟悉 Vue 3 Composition API, TypeScript, Tailwind CSS

---

生成時間: 2025-10-10
項目: MakanMakan Platform - Shop QR Feature Phase 2 & 3
