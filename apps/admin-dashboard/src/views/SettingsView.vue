<template>
  <div class="settings-view">
    <!-- 頁面標題 -->
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">系統設定</h1>
        <p class="text-gray-600">管理餐廳系統配置和偏好設定</p>
      </div>
      <div class="flex items-center space-x-3">
        <button
          class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          @click="resetToDefaults"
        >
          重置預設
        </button>
        <button
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          @click="saveSettings"
        >
          儲存設定
        </button>
      </div>
    </div>

    <!-- 設定分頁 -->
    <div class="mb-8">
      <nav class="flex space-x-8">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="[
            'py-2 px-1 border-b-2 font-medium text-sm',
            activeTab === tab.id
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
          ]"
          @click="activeTab = tab.id"
        >
          {{ tab.name }}
        </button>
      </nav>
    </div>

    <!-- 基本設定 -->
    <div v-show="activeTab === 'general'" class="space-y-8">
      <!-- 餐廳資訊 -->
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">餐廳基本資訊</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2"
              >餐廳名稱</label
            >
            <input
              v-model="settings.restaurant.name"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2"
              >聯絡電話</label
            >
            <input
              v-model="settings.restaurant.phone"
              type="tel"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-2"
              >餐廳地址</label
            >
            <textarea
              v-model="settings.restaurant.address"
              rows="3"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2"
              >營業時間</label
            >
            <div class="flex items-center space-x-2">
              <input
                v-model="settings.restaurant.openTime"
                type="time"
                class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span class="text-gray-500">至</span>
              <input
                v-model="settings.restaurant.closeTime"
                type="time"
                class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2"
              >時區</label
            >
            <select
              v-model="settings.restaurant.timezone"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="Asia/Kuala_Lumpur">馬來西亞 (UTC+8)</option>
              <option value="Asia/Singapore">新加坡 (UTC+8)</option>
              <option value="Asia/Bangkok">泰國 (UTC+7)</option>
              <option value="Asia/Jakarta">印尼 (UTC+7)</option>
            </select>
          </div>
        </div>
      </div>

      <!-- 系統偏好 -->
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">系統偏好</h3>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-900">語言設定</label>
              <p class="text-sm text-gray-500">選擇系統顯示語言</p>
            </div>
            <select
              v-model="settings.system.language"
              class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="zh-TW">繁體中文</option>
              <option value="zh-CN">简体中文</option>
              <option value="en">English</option>
              <option value="ms">Bahasa Malaysia</option>
              <option value="th">ไทย</option>
            </select>
          </div>

          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-900">貨幣單位</label>
              <p class="text-sm text-gray-500">設定價格顯示的貨幣單位</p>
            </div>
            <select
              v-model="settings.system.currency"
              class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="MYR">馬來西亞令吉 (RM)</option>
              <option value="SGD">新加坡元 (S$)</option>
              <option value="USD">美元 (US$)</option>
              <option value="THB">泰銖 (฿)</option>
            </select>
          </div>

          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-900"
                >自動登出時間</label
              >
              <p class="text-sm text-gray-500">
                無操作後自動登出的時間（分鐘）
              </p>
            </div>
            <select
              v-model.number="settings.system.autoLogoutMinutes"
              class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="30">30 分鐘</option>
              <option value="60">1 小時</option>
              <option value="120">2 小時</option>
              <option value="240">4 小時</option>
              <option value="0">永不登出</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- 訂單設定 -->
    <div v-show="activeTab === 'orders'" class="space-y-8">
      <!-- 訂單流程 -->
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">訂單處理設定</h3>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-900"
                >自動確認訂單</label
              >
              <p class="text-sm text-gray-500">新訂單自動進入製作流程</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                v-model="settings.orders.autoConfirm"
                type="checkbox"
                class="sr-only peer"
              />
              <div
                class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
              />
            </label>
          </div>

          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-900"
                >訂單準備時間提醒</label
              >
              <p class="text-sm text-gray-500">超過預估時間發送提醒</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                v-model="settings.orders.preparationTimeAlert"
                type="checkbox"
                class="sr-only peer"
              />
              <div
                class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
              />
            </label>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2"
              >預設準備時間（分鐘）</label
            >
            <input
              v-model.number="settings.orders.defaultPreparationTime"
              type="number"
              min="5"
              max="60"
              class="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2"
              >訂單保留天數</label
            >
            <select
              v-model.number="settings.orders.retentionDays"
              class="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="30">30 天</option>
              <option value="90">90 天</option>
              <option value="180">180 天</option>
              <option value="365">1 年</option>
            </select>
          </div>
        </div>
      </div>

      <!-- 桌台設定 -->
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">桌台管理設定</h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2"
              >桌台編號前綴</label
            >
            <input
              v-model="settings.tables.prefix"
              type="text"
              maxlength="5"
              class="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="T"
            />
          </div>

          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-900"
                >自動清理桌台</label
              >
              <p class="text-sm text-gray-500">訂單完成後自動清理桌台狀態</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                v-model="settings.tables.autoClean"
                type="checkbox"
                class="sr-only peer"
              />
              <div
                class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
              />
            </label>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2"
              >清理延遲時間（分鐘）</label
            >
            <input
              v-model.number="settings.tables.cleanDelay"
              type="number"
              min="0"
              max="30"
              class="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 通知設定 -->
    <div v-show="activeTab === 'notifications'" class="space-y-8">
      <!-- 音效通知 -->
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">音效通知設定</h3>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-900"
                >啟用音效通知</label
              >
              <p class="text-sm text-gray-500">新訂單和狀態變更音效提醒</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                v-model="settings.notifications.sound.enabled"
                type="checkbox"
                class="sr-only peer"
              />
              <div
                class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
              />
            </label>
          </div>

          <div
            v-if="settings.notifications.sound.enabled"
            class="ml-6 space-y-3"
          >
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2"
                >音量</label
              >
              <input
                v-model.number="settings.notifications.sound.volume"
                type="range"
                min="0"
                max="100"
                class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div class="text-sm text-gray-500">
                {{ settings.notifications.sound.volume }}%
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2"
                >新訂單音效</label
              >
              <select
                v-model="settings.notifications.sound.newOrder"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="bell">鈴聲</option>
                <option value="chime">風鈴</option>
                <option value="notification">提示音</option>
                <option value="custom">自訂</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2"
                >完成音效</label
              >
              <select
                v-model="settings.notifications.sound.complete"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="success">成功音</option>
                <option value="ding">叮聲</option>
                <option value="chime">風鈴</option>
                <option value="custom">自訂</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 桌面通知 -->
    <div class="bg-white rounded-lg shadow p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">桌面通知設定</h3>
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <label class="text-sm font-medium text-gray-900"
              >啟用桌面通知</label
            >
            <p class="text-sm text-gray-500">在瀏覽器中顯示通知提醒</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input
              v-model="settings.notifications.desktop.enabled"
              type="checkbox"
              class="sr-only peer"
            />
            <div
              class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
            />
          </label>
        </div>

        <div
          v-if="settings.notifications.desktop.enabled"
          class="ml-6 space-y-3"
        >
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2"
              >通知持續時間（秒）</label
            >
            <input
              v-model.number="settings.notifications.desktop.duration"
              type="number"
              min="3"
              max="30"
              class="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 安全設定 -->
  <div v-show="activeTab === 'security'" class="space-y-8">
    <!-- 密碼政策 -->
    <div class="bg-white rounded-lg shadow p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">密碼安全政策</h3>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2"
            >密碼最小長度</label
          >
          <input
            v-model.number="settings.security.password.minLength"
            type="number"
            min="6"
            max="32"
            class="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div class="flex items-center justify-between">
          <div>
            <label class="text-sm font-medium text-gray-900"
              >需要包含數字</label
            >
            <p class="text-sm text-gray-500">密碼必須包含至少一個數字</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input
              v-model="settings.security.password.requireNumbers"
              type="checkbox"
              class="sr-only peer"
            />
            <div
              class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
            />
          </label>
        </div>

        <div class="flex items-center justify-between">
          <div>
            <label class="text-sm font-medium text-gray-900"
              >需要包含符號</label
            >
            <p class="text-sm text-gray-500">密碼必須包含特殊字符</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input
              v-model="settings.security.password.requireSymbols"
              type="checkbox"
              class="sr-only peer"
            />
            <div
              class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
            />
          </label>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2"
            >密碼過期天數</label
          >
          <select
            v-model.number="settings.security.password.expireDays"
            class="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="0">永不過期</option>
            <option value="30">30 天</option>
            <option value="60">60 天</option>
            <option value="90">90 天</option>
            <option value="180">180 天</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 登入安全 -->
    <div class="bg-white rounded-lg shadow p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">登入安全設定</h3>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2"
            >最大登入嘗試次數</label
          >
          <input
            v-model.number="settings.security.login.maxAttempts"
            type="number"
            min="3"
            max="10"
            class="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2"
            >鎖定時間（分鐘）</label
          >
          <input
            v-model.number="settings.security.login.lockoutMinutes"
            type="number"
            min="5"
            max="120"
            class="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div class="flex items-center justify-between">
          <div>
            <label class="text-sm font-medium text-gray-900"
              >記錄登入記錄</label
            >
            <p class="text-sm text-gray-500">記錄所有登入和登出活動</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input
              v-model="settings.security.login.logActivity"
              type="checkbox"
              class="sr-only peer"
            />
            <div
              class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
            />
          </label>
        </div>
      </div>
    </div>
  </div>

  <!-- 成功提示 -->
  <div
    v-if="showSuccessMessage"
    class="fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg shadow-lg z-50"
  >
    <div class="flex items-center">
      <CheckCircleIcon class="h-5 w-5 mr-2" />
      <span>設定已成功儲存</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { CheckCircleIcon } from "@heroicons/vue/24/outline";

// 分頁選項
const tabs = [
  { id: "general", name: "基本設定" },
  { id: "orders", name: "訂單設定" },
  { id: "notifications", name: "通知設定" },
  { id: "security", name: "安全設定" },
];

const activeTab = ref("general");
const showSuccessMessage = ref(false);

// 設定數據
const settings = reactive({
  restaurant: {
    name: "MakanMakan 餐廳",
    phone: "+60-12-345-6789",
    address: "123 Jalan Makan, Kuala Lumpur",
    openTime: "08:00",
    closeTime: "22:00",
    timezone: "Asia/Kuala_Lumpur",
  },
  system: {
    language: "zh-TW",
    currency: "MYR",
    autoLogoutMinutes: 60,
  },
  orders: {
    autoConfirm: true,
    preparationTimeAlert: true,
    defaultPreparationTime: 15,
    retentionDays: 90,
  },
  tables: {
    prefix: "T",
    autoClean: true,
    cleanDelay: 5,
  },
  notifications: {
    sound: {
      enabled: true,
      volume: 75,
      newOrder: "bell",
      complete: "success",
    },
    desktop: {
      enabled: true,
      duration: 5,
    },
  },
  security: {
    password: {
      minLength: 8,
      requireNumbers: true,
      requireSymbols: false,
      expireDays: 90,
    },
    login: {
      maxAttempts: 5,
      lockoutMinutes: 15,
      logActivity: true,
    },
  },
});

// 預設設定
const defaultSettings = { ...settings };

// 方法
const saveSettings = async () => {
  try {
    // 這裡應該調用API保存設定
    console.log("Saving settings:", settings);

    // 顯示成功訊息
    showSuccessMessage.value = true;
    setTimeout(() => {
      showSuccessMessage.value = false;
    }, 3000);
  } catch (error) {
    console.error("Failed to save settings:", error);
    alert("儲存設定失敗，請稍後再試");
  }
};

const resetToDefaults = () => {
  if (confirm("確定要將所有設定重置為預設值嗎？此操作無法恢復。")) {
    Object.assign(settings, defaultSettings);
  }
};

const loadSettings = async () => {
  try {
    // 這裡應該從API載入設定
    console.log("Loading settings...");
  } catch (error) {
    console.error("Failed to load settings:", error);
  }
};

onMounted(() => {
  loadSettings();
});
</script>

<style scoped>
.settings-view {
  padding: 1.5rem;
}

@media (max-width: 640px) {
  .settings-view {
    padding: 1rem;
  }
}

/* 自訂 toggle switch 樣式 */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.4s;
  border-radius: 24px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #3b82f6;
}

input:checked + .slider:before {
  transform: translateX(20px);
}
</style>
