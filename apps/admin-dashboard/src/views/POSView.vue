<template>
  <div class="pos-view">
    <!-- 增強版 POS 系統標題 -->
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">POS 系統</h1>
        <p class="text-gray-600">完整的銷售點管理系統</p>
      </div>
      <div class="flex items-center space-x-6">
        <!-- 現金櫃狀態 -->
        <div class="bg-green-100 px-4 py-2 rounded-lg">
          <p class="text-sm text-green-800 font-medium">
            現金櫃: {{ currentRegister?.name || "未選擇" }}
          </p>
          <p class="text-xs text-green-600">
            餘額: RM{{ formatMoney(currentRegister?.currentBalance || 0) }}
          </p>
        </div>

        <!-- 班次資訊 -->
        <div class="bg-blue-100 px-4 py-2 rounded-lg">
          <p class="text-sm text-blue-800 font-medium">
            班次: {{ currentShift?.name || "未開始" }}
          </p>
          <p class="text-xs text-blue-600">
            {{
              currentShift
                ? `${formatTime(currentShift.startTime || "")} - ${formatTime(currentShift.endTime || "")}`
                : "請開始班次"
            }}
          </p>
        </div>

        <!-- 功能按鈕 -->
        <div class="flex items-center space-x-2">
          <button
            v-if="!currentShift"
            class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
            @click="startShift"
          >
            開始班次
          </button>
          <button
            v-else
            class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
            @click="endShift"
          >
            結束班次
          </button>

          <button
            class="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
            @click="openRegisterManagement"
          >
            現金櫃管理
          </button>

          <button
            class="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
            @click="openPromotionsDialog"
          >
            促銷管理
          </button>
        </div>
      </div>
    </div>

    <!-- 統計卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-blue-100">
            <CashIcon class="h-6 w-6 text-blue-600" />
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500">今日營收</p>
            <p class="text-2xl font-semibold text-gray-900">
              RM{{ formatMoney(todayStats.revenue) }}
            </p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-green-100">
            <ShoppingCartIcon class="h-6 w-6 text-green-600" />
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500">訂單數量</p>
            <p class="text-2xl font-semibold text-gray-900">
              {{ todayStats.orders }}
            </p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-purple-100">
            <UserGroupIcon class="h-6 w-6 text-purple-600" />
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500">活躍收銀台</p>
            <p class="text-2xl font-semibold text-gray-900">
              {{ registers.filter((r) => r.status === "active").length }}
            </p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-yellow-100">
            <ClockIcon class="h-6 w-6 text-yellow-600" />
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500">平均服務時間</p>
            <p class="text-2xl font-semibold text-gray-900">
              {{ todayStats.avgServiceTime }}分
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- 主要內容區 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- 左側：現金櫃管理 -->
      <div class="lg:col-span-2 space-y-6">
        <!-- 現金櫃列表 -->
        <div class="bg-white rounded-lg shadow">
          <div class="p-6 border-b border-gray-200">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-semibold text-gray-900">現金櫃狀態</h2>
              <button
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                @click="createRegister"
              >
                新增現金櫃
              </button>
            </div>
          </div>

          <div class="p-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                v-for="register in registers"
                :key="register.id"
                :class="[
                  'border-2 rounded-lg p-4 cursor-pointer transition-all',
                  currentRegister?.id === register.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300',
                ]"
                @click="selectRegister(register)"
              >
                <div class="flex items-center justify-between mb-3">
                  <h3 class="font-medium text-gray-900">{{ register.name }}</h3>
                  <span
                    :class="getRegisterStatusClass(register.status)"
                    class="px-2 py-1 text-xs font-medium rounded-full"
                  >
                    {{ getRegisterStatusText(register.status) }}
                  </span>
                </div>

                <div class="space-y-2 text-sm">
                  <div class="flex justify-between">
                    <span class="text-gray-600">當前餘額:</span>
                    <span class="font-semibold"
                      >RM{{ formatMoney(register.currentBalance) }}</span
                    >
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600">今日交易:</span>
                    <span>{{ register.todayTransactions }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600">最後操作:</span>
                    <span>{{ formatTime(register.lastActivity) }}</span>
                  </div>
                </div>

                <div class="mt-4 flex space-x-2">
                  <button
                    v-if="register.status === 'inactive'"
                    class="flex-1 py-2 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors"
                    @click.stop="activateRegister(register.id)"
                  >
                    啟用
                  </button>
                  <button
                    v-else
                    class="flex-1 py-2 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-colors"
                    @click.stop="deactivateRegister(register.id)"
                  >
                    停用
                  </button>

                  <button
                    class="flex-1 py-2 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                    @click.stop="openCashMovement(register)"
                  >
                    現金異動
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 最近交易 -->
        <div class="bg-white rounded-lg shadow">
          <div class="p-6 border-b border-gray-200">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-semibold text-gray-900">最近交易</h2>
              <div class="flex space-x-2">
                <button
                  class="px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm hover:bg-gray-200 transition-colors"
                  @click="exportTransactions"
                >
                  匯出
                </button>
                <button
                  class="p-2 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                  @click="refreshTransactions"
                >
                  <ArrowPathIcon class="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div class="divide-y divide-gray-200">
            <div
              v-for="transaction in recentTransactions"
              :key="transaction.id"
              class="p-4 hover:bg-gray-50"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center">
                  <div class="flex-shrink-0">
                    <div
                      :class="[
                        'w-10 h-10 rounded-full flex items-center justify-center',
                        getTransactionTypeColor(transaction.type),
                      ]"
                    >
                      <component
                        :is="getTransactionIcon(transaction.type)"
                        class="w-5 h-5"
                      />
                    </div>
                  </div>
                  <div class="ml-4">
                    <p class="text-sm font-medium text-gray-900">
                      {{ getTransactionTypeText(transaction.type) }}
                    </p>
                    <p class="text-xs text-gray-500">
                      {{ transaction.description }} •
                      {{ formatDateTime(transaction.createdAt) }}
                    </p>
                  </div>
                </div>
                <div class="text-right">
                  <p
                    :class="[
                      'text-sm font-semibold',
                      transaction.amount >= 0
                        ? 'text-green-600'
                        : 'text-red-600',
                    ]"
                  >
                    {{ transaction.amount >= 0 ? "+" : "" }}RM{{
                      formatMoney(Math.abs(transaction.amount))
                    }}
                  </p>
                  <p class="text-xs text-gray-500">
                    {{ transaction.registerId }}
                  </p>
                </div>
              </div>
            </div>

            <!-- 空狀態 -->
            <div
              v-if="recentTransactions.length === 0"
              class="p-12 text-center"
            >
              <DocumentTextIcon class="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 class="text-lg font-medium text-gray-900 mb-2">
                暫無交易記錄
              </h3>
              <p class="text-gray-500">開始使用 POS 系統後將顯示交易記錄</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 右側：快速操作 -->
      <div class="space-y-6">
        <!-- 快速收銀 -->
        <div class="bg-white rounded-lg shadow">
          <div class="p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">快速收銀</h3>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2"
                  >訂單編號</label
                >
                <input
                  v-model="quickPayment.orderNumber"
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="輸入或掃描訂單編號"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2"
                  >金額</label
                >
                <div class="relative">
                  <span class="absolute left-3 top-3 text-gray-500">RM</span>
                  <input
                    v-model.number="quickPayment.amount"
                    type="number"
                    step="0.01"
                    min="0"
                    class="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2"
                  >付款方式</label
                >
                <select
                  v-model="quickPayment.paymentMethod"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">請選擇</option>
                  <option value="cash">現金</option>
                  <option value="card">刷卡</option>
                  <option value="digital_wallet">電子錢包</option>
                  <option value="bank_transfer">銀行轉帳</option>
                </select>
              </div>

              <button
                :disabled="!canProcessQuickPayment"
                class="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                @click="processQuickPayment"
              >
                確認收款
              </button>
            </div>
          </div>
        </div>

        <!-- 促銷活動 -->
        <div class="bg-white rounded-lg shadow">
          <div class="p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold text-gray-900">活動促銷</h3>
              <button
                class="text-blue-600 hover:text-blue-700 text-sm font-medium"
                @click="openPromotionsDialog"
              >
                管理促銷
              </button>
            </div>

            <div class="space-y-3">
              <div
                v-for="promotion in activePromotions"
                :key="promotion.id"
                class="p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200"
              >
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-sm font-medium text-purple-900">
                      {{ promotion.title }}
                    </p>
                    <p class="text-xs text-purple-600">
                      {{ promotion.description }}
                    </p>
                  </div>
                  <span class="text-sm font-bold text-purple-900">
                    {{
                      promotion.discountType === "percentage"
                        ? `${promotion.discountValue}%`
                        : `RM${promotion.discountValue}`
                    }}
                  </span>
                </div>
              </div>

              <div
                v-if="activePromotions.length === 0"
                class="text-center py-4"
              >
                <p class="text-sm text-gray-500">暫無活動促銷</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 今日班次報告 -->
        <div class="bg-white rounded-lg shadow">
          <div class="p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold text-gray-900">今日班次</h3>
              <button
                class="text-blue-600 hover:text-blue-700 text-sm font-medium"
                @click="generateShiftReport"
              >
                生成報告
              </button>
            </div>

            <div v-if="currentShift" class="space-y-3">
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">開始時間:</span>
                <span class="font-medium">{{
                  formatTime(currentShift.startTime)
                }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">營運時數:</span>
                <span class="font-medium">{{ getShiftDuration() }}小時</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">處理訂單:</span>
                <span class="font-medium">{{
                  currentShift.processedOrders
                }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">總營收:</span>
                <span class="font-medium text-green-600"
                  >RM{{ formatMoney(currentShift.totalRevenue) }}</span
                >
              </div>
            </div>

            <div v-else class="text-center py-4">
              <p class="text-sm text-gray-500 mb-3">尚未開始班次</p>
              <button
                class="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                @click="startShift"
              >
                開始班次
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 現金異動模態框 -->
    <div
      v-if="showCashMovementDialog"
      class="fixed inset-0 z-50 overflow-y-auto"
    >
      <div class="flex items-center justify-center min-h-screen px-4">
        <div
          class="fixed inset-0 bg-black opacity-30"
          @click="closeCashMovementDialog"
        />
        <div class="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-semibold text-gray-900">現金異動</h3>
            <button
              class="text-gray-400 hover:text-gray-600"
              @click="closeCashMovementDialog"
            >
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2"
                >異動類型</label
              >
              <select
                v-model="cashMovement.type"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">請選擇</option>
                <option value="cash_in">現金存入</option>
                <option value="cash_out">現金取出</option>
                <option value="drawer_count">盤點調整</option>
                <option value="refund">退款</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2"
                >金額</label
              >
              <div class="relative">
                <span class="absolute left-3 top-3 text-gray-500">RM</span>
                <input
                  v-model.number="cashMovement.amount"
                  type="number"
                  step="0.01"
                  min="0"
                  class="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2"
                >說明</label
              >
              <textarea
                v-model="cashMovement.description"
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="輸入異動說明"
              />
            </div>
          </div>

          <div class="flex justify-end space-x-3 mt-6">
            <button
              class="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors"
              @click="closeCashMovementDialog"
            >
              取消
            </button>
            <button
              :disabled="!canProcessCashMovement"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              @click="processCashMovement"
            >
              確認異動
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 促銷管理模態框 -->
    <div v-if="showPromotionsDialog" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div
          class="fixed inset-0 bg-black opacity-30"
          @click="closePromotionsDialog"
        />
        <div
          class="relative bg-white rounded-lg shadow-xl max-w-4xl w-full p-6"
        >
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-semibold text-gray-900">促銷活動管理</h3>
            <button
              class="text-gray-400 hover:text-gray-600"
              @click="closePromotionsDialog"
            >
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>

          <div class="mb-6">
            <button
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              @click="createPromotion"
            >
              新增促銷活動
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              v-for="promotion in allPromotions"
              :key="promotion.id"
              class="border rounded-lg p-4"
            >
              <div class="flex items-center justify-between mb-2">
                <h4 class="font-medium text-gray-900">{{ promotion.title }}</h4>
                <span
                  :class="[
                    'px-2 py-1 text-xs font-medium rounded-full',
                    promotion.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800',
                  ]"
                >
                  {{ promotion.isActive ? "進行中" : "已暫停" }}
                </span>
              </div>
              <p class="text-sm text-gray-600 mb-3">
                {{ promotion.description }}
              </p>

              <div class="flex items-center justify-between">
                <span class="text-lg font-bold text-purple-600">
                  {{
                    promotion.discountType === "percentage"
                      ? `${promotion.discountValue}%`
                      : `RM${promotion.discountValue}`
                  }}
                </span>

                <div class="flex space-x-2">
                  <button
                    class="px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm hover:bg-gray-200 transition-colors"
                    @click="editPromotion(promotion)"
                  >
                    編輯
                  </button>
                  <button
                    :class="[
                      'px-3 py-1 rounded text-sm transition-colors',
                      promotion.isActive
                        ? 'bg-red-100 text-red-600 hover:bg-red-200'
                        : 'bg-green-100 text-green-600 hover:bg-green-200',
                    ]"
                    @click="togglePromotion(promotion)"
                  >
                    {{ promotion.isActive ? "暫停" : "啟用" }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import {
  BanknotesIcon,
  ShoppingCartIcon,
  UserGroupIcon,
  ClockIcon,
  DocumentTextIcon,
  ArrowPathIcon,
  XMarkIcon,
} from "@heroicons/vue/24/outline";
import PlusIcon from "@heroicons/vue/24/solid/PlusIcon";
import MinusIcon from "@heroicons/vue/24/solid/MinusIcon";
import AdjustmentsHorizontalIcon from "@heroicons/vue/24/solid/AdjustmentsHorizontalIcon";

// 型別定義
interface CashRegister {
  id: string;
  name: string;
  status: "active" | "inactive" | "maintenance";
  currentBalance: number;
  todayTransactions: number;
  lastActivity: string;
  location: string;
}

interface CashShift {
  id: string;
  name: string;
  startTime: string;
  endTime?: string;
  registerId: string;
  operatorId: number;
  startingCash: number;
  totalRevenue: number;
  processedOrders: number;
  status: "active" | "ended";
}

interface Transaction {
  id: string;
  registerId: string;
  type: "sale" | "refund" | "cash_in" | "cash_out" | "drawer_count";
  amount: number;
  description: string;
  createdAt: string;
  operatorId: number;
}

interface Promotion {
  id: string;
  title: string;
  description: string;
  discountType: "percentage" | "fixed_amount";
  discountValue: number;
  isActive: boolean;
  startDate: string;
  endDate: string;
  conditions: string;
}

// 響應式狀態
const currentRegister = ref<CashRegister | null>(null);
const currentShift = ref<CashShift | null>(null);
const showCashMovementDialog = ref(false);
const showPromotionsDialog = ref(false);

// 統計數據
const todayStats = ref({
  revenue: 2580.75,
  orders: 45,
  avgServiceTime: 3.2,
});

// 現金櫃列表
const registers = ref<CashRegister[]>([
  {
    id: "reg_001",
    name: "主收銀台",
    status: "active",
    currentBalance: 850.25,
    todayTransactions: 28,
    lastActivity: new Date().toISOString(),
    location: "前台-01",
  },
  {
    id: "reg_002",
    name: "備用收銀台",
    status: "inactive",
    currentBalance: 200.0,
    todayTransactions: 0,
    lastActivity: new Date(Date.now() - 3600000).toISOString(),
    location: "前台-02",
  },
]);

// 最近交易
const recentTransactions = ref<Transaction[]>([
  {
    id: "txn_001",
    registerId: "reg_001",
    type: "sale",
    amount: 45.8,
    description: "訂單 ORD-001 收款",
    createdAt: new Date().toISOString(),
    operatorId: 1,
  },
  {
    id: "txn_002",
    registerId: "reg_001",
    type: "cash_in",
    amount: 500.0,
    description: "班次開始 - 起始現金",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    operatorId: 1,
  },
]);

// 促銷活動
const activePromotions = ref<Promotion[]>([
  {
    id: "promo_001",
    title: "午餐優惠",
    description: "11:30-14:30 所有套餐9折",
    discountType: "percentage",
    discountValue: 10,
    isActive: true,
    startDate: "2025-01-01",
    endDate: "2025-12-31",
    conditions: "time_based",
  },
]);

const allPromotions = ref<Promotion[]>([...activePromotions.value]);

// 快速收銀
const quickPayment = ref({
  orderNumber: "",
  amount: 0,
  paymentMethod: "",
});

// 現金異動
const cashMovement = ref({
  type: "",
  amount: 0,
  description: "",
});

// 計算屬性
const canProcessQuickPayment = computed(() => {
  return (
    quickPayment.value.orderNumber &&
    quickPayment.value.amount > 0 &&
    quickPayment.value.paymentMethod &&
    currentRegister.value
  );
});

const canProcessCashMovement = computed(() => {
  return (
    cashMovement.value.type &&
    cashMovement.value.amount > 0 &&
    cashMovement.value.description
  );
});

// 方法
const formatMoney = (amount: number) => amount.toFixed(2);
const formatTime = (dateTime: string) =>
  new Date(dateTime).toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
  });
const formatDateTime = (dateTime: string) =>
  new Date(dateTime).toLocaleString("zh-TW");

const getRegisterStatusClass = (status: string) => {
  const classes: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    inactive: "bg-gray-100 text-gray-800",
    maintenance: "bg-yellow-100 text-yellow-800",
  };
  return classes[status] || "bg-gray-100 text-gray-800";
};

const getRegisterStatusText = (status: string) => {
  const texts: Record<string, string> = {
    active: "運行中",
    inactive: "未啟用",
    maintenance: "維護中",
  };
  return texts[status] || status;
};

const getTransactionTypeColor = (type: string) => {
  const colors: Record<string, string> = {
    sale: "bg-green-100",
    refund: "bg-red-100",
    cash_in: "bg-blue-100",
    cash_out: "bg-orange-100",
    drawer_count: "bg-purple-100",
  };
  return colors[type] || "bg-gray-100";
};

const getTransactionIcon = (type: string) => {
  const icons: Record<string, any> = {
    sale: BanknotesIcon,
    refund: MinusIcon,
    cash_in: PlusIcon,
    cash_out: MinusIcon,
    drawer_count: AdjustmentsHorizontalIcon,
  };
  return icons[type] || DocumentTextIcon;
};

const getTransactionTypeText = (type: string) => {
  const texts: Record<string, string> = {
    sale: "銷售收款",
    refund: "退款",
    cash_in: "現金存入",
    cash_out: "現金取出",
    drawer_count: "盤點調整",
  };
  return texts[type] || type;
};

const selectRegister = (register: CashRegister) => {
  currentRegister.value = register;
};

const createRegister = () => {
  const name = prompt("輸入新現金櫃名稱:");
  if (name) {
    const newRegister: CashRegister = {
      id: `reg_${Date.now()}`,
      name,
      status: "inactive",
      currentBalance: 0,
      todayTransactions: 0,
      lastActivity: new Date().toISOString(),
      location: "待設定",
    };
    registers.value.push(newRegister);
  }
};

const activateRegister = async (registerId: string) => {
  const register = registers.value.find((r) => r.id === registerId);
  if (register) {
    register.status = "active";
    register.lastActivity = new Date().toISOString();
  }
};

const deactivateRegister = async (registerId: string) => {
  const register = registers.value.find((r) => r.id === registerId);
  if (register) {
    register.status = "inactive";
  }
};

const startShift = () => {
  const startingCash = prompt("輸入起始現金金額:");
  if (startingCash && !isNaN(parseFloat(startingCash))) {
    currentShift.value = {
      id: `shift_${Date.now()}`,
      name: "早班",
      startTime: new Date().toISOString(),
      registerId: currentRegister.value?.id || "reg_001",
      operatorId: 1,
      startingCash: parseFloat(startingCash),
      totalRevenue: 0,
      processedOrders: 0,
      status: "active",
    };
  }
};

const endShift = () => {
  if (currentShift.value && confirm("確認結束當前班次？")) {
    currentShift.value.endTime = new Date().toISOString();
    currentShift.value.status = "ended";
    currentShift.value = null;
  }
};

const getShiftDuration = () => {
  if (!currentShift.value) return "0";
  const start = new Date(currentShift.value.startTime);
  const now = new Date();
  const hours = Math.floor(
    (now.getTime() - start.getTime()) / (1000 * 60 * 60),
  );
  return hours.toString();
};

const processQuickPayment = async () => {
  if (!canProcessQuickPayment.value) return;

  try {
    // 模擬支付處理
    const newTransaction: Transaction = {
      id: `txn_${Date.now()}`,
      registerId: currentRegister.value!.id,
      type: "sale",
      amount: quickPayment.value.amount,
      description: `訂單 ${quickPayment.value.orderNumber} 收款`,
      createdAt: new Date().toISOString(),
      operatorId: 1,
    };

    recentTransactions.value.unshift(newTransaction);

    // 更新現金櫃餘額和統計
    if (currentRegister.value) {
      currentRegister.value.currentBalance += quickPayment.value.amount;
      currentRegister.value.todayTransactions++;
      currentRegister.value.lastActivity = new Date().toISOString();
    }

    // 更新班次統計
    if (currentShift.value) {
      currentShift.value.totalRevenue += quickPayment.value.amount;
      currentShift.value.processedOrders++;
    }

    // 重置表單
    quickPayment.value = {
      orderNumber: "",
      amount: 0,
      paymentMethod: "",
    };

    alert("收款成功！");
  } catch (error) {
    alert("收款失敗，請重試");
  }
};

const openCashMovement = (register: CashRegister) => {
  currentRegister.value = register;
  showCashMovementDialog.value = true;
  cashMovement.value = { type: "", amount: 0, description: "" };
};

const closeCashMovementDialog = () => {
  showCashMovementDialog.value = false;
};

const processCashMovement = async () => {
  if (!canProcessCashMovement.value || !currentRegister.value) return;

  try {
    const isIncoming = ["cash_in", "drawer_count"].includes(
      cashMovement.value.type,
    );
    const amount = isIncoming
      ? cashMovement.value.amount
      : -cashMovement.value.amount;

    const newTransaction: Transaction = {
      id: `txn_${Date.now()}`,
      registerId: currentRegister.value.id,
      type: cashMovement.value.type as any,
      amount,
      description: cashMovement.value.description,
      createdAt: new Date().toISOString(),
      operatorId: 1,
    };

    recentTransactions.value.unshift(newTransaction);
    currentRegister.value.currentBalance += amount;
    currentRegister.value.lastActivity = new Date().toISOString();

    closeCashMovementDialog();
    alert("現金異動成功！");
  } catch (error) {
    alert("異動失敗，請重試");
  }
};

const openPromotionsDialog = () => {
  showPromotionsDialog.value = true;
};

const closePromotionsDialog = () => {
  showPromotionsDialog.value = false;
};

const createPromotion = () => {
  const title = prompt("輸入促銷活動名稱:");
  if (title) {
    const newPromotion: Promotion = {
      id: `promo_${Date.now()}`,
      title,
      description: "新促銷活動",
      discountType: "percentage",
      discountValue: 10,
      isActive: false,
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      conditions: "manual",
    };
    allPromotions.value.push(newPromotion);
  }
};

const editPromotion = (promotion: Promotion) => {
  console.log("Edit promotion:", promotion.id);
};

const togglePromotion = (promotion: Promotion) => {
  promotion.isActive = !promotion.isActive;
  if (promotion.isActive) {
    activePromotions.value.push(promotion);
  } else {
    const index = activePromotions.value.findIndex(
      (p) => p.id === promotion.id,
    );
    if (index > -1) {
      activePromotions.value.splice(index, 1);
    }
  }
};

const openRegisterManagement = () => {
  console.log("Open register management");
};

const refreshTransactions = () => {
  console.log("Refreshing transactions...");
};

const exportTransactions = () => {
  alert("匯出交易記錄功能開發中...");
};

const generateShiftReport = () => {
  alert("生成班次報告功能開發中...");
};

// 生命週期
onMounted(async () => {
  // 初始化時選擇第一個現金櫃
  if (registers.value.length > 0) {
    currentRegister.value = registers.value[0];
  }
});
</script>

<style scoped>
.pos-view {
  padding: 1.5rem;
  min-height: 100vh;
  background-color: #f9fafb;
}

@media (max-width: 640px) {
  .pos-view {
    padding: 1rem;
  }
}
</style>
