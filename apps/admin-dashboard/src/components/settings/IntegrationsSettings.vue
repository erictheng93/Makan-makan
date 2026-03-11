<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="bg-white rounded-lg shadow p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-2">外送平台串接</h3>
      <p class="text-sm text-gray-500">
        連接外送平台以統一管理來自不同平台的訂單和菜單
      </p>
    </div>

    <!-- Platform Cards -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Uber Eats Card -->
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center space-x-3">
            <div
              class="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center text-lg"
            >
              🟢
            </div>
            <div>
              <h4 class="font-semibold text-gray-900">Uber Eats</h4>
              <p class="text-xs text-gray-500">外送平台串接</p>
            </div>
          </div>
          <span
            v-if="uberEats.enabled"
            class="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium"
          >
            已連接
          </span>
          <span
            v-else
            class="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium"
          >
            未連接
          </span>
        </div>

        <!-- Not Connected -->
        <div v-if="!uberEats.enabled">
          <div v-if="!showConnectForm" class="text-center py-4">
            <p class="text-sm text-gray-500 mb-4">
              連接 Uber Eats 以自動接收並管理外送訂單
            </p>
            <button
              class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              @click="showConnectForm = true"
            >
              連接 Uber Eats
            </button>
          </div>

          <!-- Connect Form -->
          <div v-else class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1"
                >Client ID</label
              >
              <input
                v-model="connectForm.clientId"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Uber Eats API Client ID"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1"
                >Client Secret</label
              >
              <input
                v-model="connectForm.clientSecret"
                type="password"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Uber Eats API Client Secret"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1"
                >Store ID</label
              >
              <input
                v-model="connectForm.storeId"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Uber Eats Store ID"
              />
            </div>
            <div class="flex items-center space-x-3">
              <button
                :disabled="isConnecting"
                class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                @click="connectUberEats"
              >
                {{ isConnecting ? "連接中..." : "確認連接" }}
              </button>
              <button
                class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                @click="showConnectForm = false"
              >
                取消
              </button>
            </div>
          </div>
        </div>

        <!-- Connected: Config -->
        <div v-else class="space-y-4">
          <div class="flex items-center justify-between py-2">
            <div>
              <p class="text-sm font-medium text-gray-900">自動接單</p>
              <p class="text-xs text-gray-500">收到平台訂單時自動確認接受</p>
            </div>
            <button
              :class="[
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                uberEats.config?.autoAcceptOrders
                  ? 'bg-green-600'
                  : 'bg-gray-200',
              ]"
              @click="toggleAutoAccept"
            >
              <span
                :class="[
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  uberEats.config?.autoAcceptOrders
                    ? 'translate-x-6'
                    : 'translate-x-1',
                ]"
              />
            </button>
          </div>

          <div class="flex items-center justify-between py-2">
            <div>
              <p class="text-sm font-medium text-gray-900">菜單同步</p>
              <p class="text-xs text-gray-500">
                自動將菜單更新同步到 Uber Eats
              </p>
            </div>
            <button
              :class="[
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                uberEats.config?.menuSyncEnabled
                  ? 'bg-green-600'
                  : 'bg-gray-200',
              ]"
              @click="toggleMenuSync"
            >
              <span
                :class="[
                  'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                  uberEats.config?.menuSyncEnabled
                    ? 'translate-x-6'
                    : 'translate-x-1',
                ]"
              />
            </button>
          </div>

          <div
            class="flex items-center justify-between py-2 border-t border-gray-100"
          >
            <div>
              <p class="text-sm font-medium text-gray-900">手動同步菜單</p>
              <p class="text-xs text-gray-500">
                <template v-if="uberEats.lastMenuSyncAt">
                  最後同步：{{ formatDate(uberEats.lastMenuSyncAt) }}
                  <span
                    :class="getSyncStatusClass(uberEats.menuSyncStatus)"
                    class="ml-1"
                  >
                    {{ getSyncStatusText(uberEats.menuSyncStatus) }}
                  </span>
                </template>
                <template v-else>尚未同步</template>
              </p>
            </div>
            <button
              :disabled="isSyncing"
              class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              @click="syncMenu"
            >
              {{ isSyncing ? "同步中..." : "立即同步" }}
            </button>
          </div>

          <div class="pt-4 border-t border-gray-200">
            <button
              class="text-sm text-red-600 hover:text-red-700 font-medium"
              @click="confirmDisconnect = true"
            >
              斷開連接
            </button>
          </div>
        </div>
      </div>

      <!-- Foodpanda Card (Coming Soon) -->
      <div class="bg-white rounded-lg shadow p-6 opacity-60">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center space-x-3">
            <div
              class="w-10 h-10 rounded-lg bg-pink-100 flex items-center justify-center text-lg"
            >
              🩷
            </div>
            <div>
              <h4 class="font-semibold text-gray-900">Foodpanda</h4>
              <p class="text-xs text-gray-500">外送平台串接</p>
            </div>
          </div>
          <span
            class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium"
          >
            即將推出
          </span>
        </div>
        <div class="text-center py-4">
          <p class="text-sm text-gray-500">
            Foodpanda 串接功能即將推出，敬請期待
          </p>
        </div>
      </div>
    </div>

    <!-- Webhook Logs -->
    <div class="bg-white rounded-lg shadow p-6">
      <div class="flex items-center justify-between mb-4">
        <h4 class="font-semibold text-gray-900">Webhook 紀錄</h4>
        <button
          class="text-sm text-blue-600 hover:text-blue-700"
          @click="
            showLogs = !showLogs;
            if (showLogs) loadWebhookLogs();
          "
        >
          {{ showLogs ? "收起" : "展開" }}
        </button>
      </div>

      <div v-if="showLogs">
        <div v-if="webhookLogs.length === 0" class="text-center py-6">
          <p class="text-sm text-gray-500">暫無 webhook 紀錄</p>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th
                  class="px-4 py-2 text-left text-xs font-medium text-gray-500"
                >
                  時間
                </th>
                <th
                  class="px-4 py-2 text-left text-xs font-medium text-gray-500"
                >
                  平台
                </th>
                <th
                  class="px-4 py-2 text-left text-xs font-medium text-gray-500"
                >
                  事件
                </th>
                <th
                  class="px-4 py-2 text-left text-xs font-medium text-gray-500"
                >
                  狀態
                </th>
                <th
                  class="px-4 py-2 text-left text-xs font-medium text-gray-500"
                >
                  錯誤
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              <tr v-for="log in webhookLogs" :key="log.id">
                <td class="px-4 py-2 text-sm text-gray-500">
                  {{ formatDate(log.createdAt) }}
                </td>
                <td class="px-4 py-2 text-sm text-gray-900">
                  {{ log.platform }}
                </td>
                <td class="px-4 py-2 text-sm text-gray-900">
                  {{ log.eventType }}
                </td>
                <td class="px-4 py-2">
                  <span
                    :class="getLogStatusClass(log.status)"
                    class="px-2 py-0.5 rounded-full text-xs font-medium"
                  >
                    {{ getLogStatusText(log.status) }}
                  </span>
                </td>
                <td class="px-4 py-2 text-sm text-red-600">
                  {{ log.error || "-" }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Disconnect Confirmation Modal -->
    <div
      v-if="confirmDisconnect"
      class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    >
      <div class="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
        <h3 class="text-lg font-semibold text-gray-900 mb-2">確認斷開連接</h3>
        <p class="text-sm text-gray-600 mb-4">
          斷開 Uber Eats
          連接後，將無法再接收來自該平台的訂單。已存在的訂單不受影響。
        </p>
        <div class="flex items-center justify-end space-x-3">
          <button
            class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            @click="confirmDisconnect = false"
          >
            取消
          </button>
          <button
            :disabled="isDisconnecting"
            class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            @click="disconnectUberEats"
          >
            {{ isDisconnecting ? "斷開中..." : "確認斷開" }}
          </button>
        </div>
      </div>
    </div>

    <!-- Toast Message -->
    <div
      v-if="message"
      :class="[
        'fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg z-50',
        message.type === 'success'
          ? 'bg-green-100 text-green-800'
          : 'bg-red-100 text-red-800',
      ]"
    >
      {{ message.text }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { useAuthStore } from "@/stores/auth";
import { apiClient } from "@/services/api";

const authStore = useAuthStore();

const showConnectForm = ref(false);
const showLogs = ref(false);
const isConnecting = ref(false);
const isSyncing = ref(false);
const isDisconnecting = ref(false);
const confirmDisconnect = ref(false);
const message = ref<{ type: "success" | "error"; text: string } | null>(null);

const connectForm = reactive({
  clientId: "",
  clientSecret: "",
  storeId: "",
});

const uberEats = reactive({
  enabled: false,
  config: null as {
    autoAcceptOrders?: boolean;
    menuSyncEnabled?: boolean;
  } | null,
  lastMenuSyncAt: null as string | null,
  menuSyncStatus: null as string | null,
});

const webhookLogs = ref<
  Array<{
    id: number;
    platform: string;
    eventType: string;
    status: string;
    error?: string;
    createdAt: string;
  }>
>([]);

onMounted(async () => {
  await loadIntegration();
});

async function loadIntegration() {
  try {
    const restaurantId = authStore.restaurantId;
    if (!restaurantId) return;
    const response = await apiClient.get(
      `/api/v1/integrations/${restaurantId}/uber_eats`,
    );
    if (response.data?.data) {
      const data = response.data.data;
      uberEats.enabled = data.enabled;
      uberEats.config = data.config;
      uberEats.lastMenuSyncAt = data.lastMenuSyncAt;
      uberEats.menuSyncStatus = data.menuSyncStatus;
    }
  } catch {
    // Not connected yet
  }
}

async function connectUberEats() {
  if (
    !connectForm.clientId ||
    !connectForm.clientSecret ||
    !connectForm.storeId
  ) {
    showMsg("error", "請填寫所有欄位");
    return;
  }
  isConnecting.value = true;
  try {
    const restaurantId = authStore.restaurantId;
    await apiClient.post(
      `/api/v1/integrations/${restaurantId}/uber_eats/connect`,
      {
        clientId: connectForm.clientId,
        clientSecret: connectForm.clientSecret,
        storeId: connectForm.storeId,
      },
    );
    showMsg("success", "Uber Eats 連接成功");
    showConnectForm.value = false;
    await loadIntegration();
  } catch (err: any) {
    showMsg("error", err?.response?.data?.error || "連接失敗");
  } finally {
    isConnecting.value = false;
  }
}

async function toggleAutoAccept() {
  try {
    const restaurantId = authStore.restaurantId;
    const newValue = !uberEats.config?.autoAcceptOrders;
    await apiClient.put(`/api/v1/integrations/${restaurantId}/uber_eats`, {
      autoAcceptOrders: newValue,
    });
    if (uberEats.config) uberEats.config.autoAcceptOrders = newValue;
  } catch {
    showMsg("error", "更新設定失敗");
  }
}

async function toggleMenuSync() {
  try {
    const restaurantId = authStore.restaurantId;
    const newValue = !uberEats.config?.menuSyncEnabled;
    await apiClient.put(`/api/v1/integrations/${restaurantId}/uber_eats`, {
      menuSyncEnabled: newValue,
    });
    if (uberEats.config) uberEats.config.menuSyncEnabled = newValue;
  } catch {
    showMsg("error", "更新設定失敗");
  }
}

async function syncMenu() {
  isSyncing.value = true;
  try {
    const restaurantId = authStore.restaurantId;
    await apiClient.post(
      `/api/v1/integrations/${restaurantId}/uber_eats/menu-sync`,
    );
    showMsg("success", "菜單同步已觸發");
    await loadIntegration();
  } catch (err: any) {
    showMsg("error", err?.response?.data?.error || "同步失敗");
  } finally {
    isSyncing.value = false;
  }
}

async function disconnectUberEats() {
  isDisconnecting.value = true;
  try {
    const restaurantId = authStore.restaurantId;
    await apiClient.delete(`/api/v1/integrations/${restaurantId}/uber_eats`);
    uberEats.enabled = false;
    uberEats.config = null;
    uberEats.lastMenuSyncAt = null;
    uberEats.menuSyncStatus = null;
    confirmDisconnect.value = false;
    showMsg("success", "已斷開 Uber Eats 連接");
  } catch {
    showMsg("error", "斷開連接失敗");
  } finally {
    isDisconnecting.value = false;
  }
}

async function loadWebhookLogs() {
  try {
    const restaurantId = authStore.restaurantId;
    const response = await apiClient.get(
      `/api/v1/integrations/${restaurantId}/webhook-logs`,
    );
    webhookLogs.value = response.data?.data || [];
  } catch {
    webhookLogs.value = [];
  }
}

function showMsg(type: "success" | "error", text: string) {
  message.value = { type, text };
  setTimeout(() => {
    message.value = null;
  }, 3000);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSyncStatusClass(status?: string | null) {
  const classes: Record<string, string> = {
    idle: "text-gray-500",
    syncing: "text-blue-600",
    success: "text-green-600",
    error: "text-red-600",
  };
  return classes[status || "idle"] || "text-gray-500";
}

function getSyncStatusText(status?: string | null) {
  const texts: Record<string, string> = {
    idle: "",
    syncing: "(同步中)",
    success: "(成功)",
    error: "(失敗)",
  };
  return texts[status || "idle"] || "";
}

function getLogStatusClass(status: string) {
  const classes: Record<string, string> = {
    received: "bg-blue-100 text-blue-800",
    processed: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
  };
  return classes[status] || "bg-gray-100 text-gray-800";
}

function getLogStatusText(status: string) {
  const texts: Record<string, string> = {
    received: "已接收",
    processed: "已處理",
    failed: "失敗",
  };
  return texts[status] || status;
}
</script>
