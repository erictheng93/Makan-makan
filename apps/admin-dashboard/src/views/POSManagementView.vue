<template>
  <div class="pos-management">
    <!-- 收銀櫃管理操作列 -->
    <div class="flex justify-between items-center mb-6">
      <div class="flex items-center space-x-4">
        <!-- 收銀櫃狀態 -->
        <div class="bg-green-50 px-4 py-2 rounded-2xl">
          <p class="text-sm text-green-800 font-medium">
            {{ t("pos.register") }}:
            {{ currentRegister?.name || t("pos.notSelected") }}
          </p>
          <p class="text-xs text-green-600">
            {{ t("pos.balance") }}:
            {{ formatPrice(currentRegister?.currentBalance || 0) }}
          </p>
        </div>

        <!-- 班次資訊 -->
        <div class="bg-blue-50 px-4 py-2 rounded-2xl">
          <p class="text-sm text-blue-800 font-medium">
            {{ t("pos.shift") }}:
            {{ currentShift?.name || t("pos.notStarted") }}
          </p>
          <p class="text-xs text-blue-600">
            {{
              currentShift
                ? `${formatTime(currentShift.startTime || "")} - ${formatTime(currentShift.endTime || "")}`
                : t("pos.pleaseStartShift")
            }}
          </p>
        </div>
      </div>

      <!-- 功能按鈕 -->
      <div class="flex items-center space-x-2">
        <button
          v-if="!currentShift"
          class="px-4 py-2 bg-[#34C759] text-white rounded-full hover:bg-green-600 transition-colors text-sm"
          @click="startShift"
        >
          {{ t("pos.startShift") }}
        </button>
        <button
          v-else
          class="px-4 py-2 bg-[#FF3B30] text-white rounded-full hover:bg-red-600 transition-colors text-sm"
          @click="endShift"
        >
          {{ t("pos.endShift") }}
        </button>

        <button
          class="px-3 py-2 bg-[#007AFF] text-white rounded-full hover:bg-blue-600 transition-colors text-sm"
          @click="openRegisterManagement"
        >
          {{ t("pos.registerManagement") }}
        </button>

        <button
          class="px-3 py-2 bg-[#FF9500] text-white rounded-full hover:bg-orange-600 transition-colors text-sm"
          @click="openPromotionsDialog"
        >
          {{ t("pos.promotionManagement") }}
        </button>
      </div>
    </div>

    <!-- 統計卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-blue-100">
            <BanknotesIcon class="h-6 w-6 text-blue-600" />
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500">
              {{ t("pos.todayRevenue") }}
            </p>
            <p class="text-2xl font-semibold text-gray-900">
              {{ formatPrice(todayStats.revenue) }}
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
            <p class="text-sm font-medium text-gray-500">
              {{ t("pos.orderCount") }}
            </p>
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
            <p class="text-sm font-medium text-gray-500">
              {{ t("pos.activeRegisters") }}
            </p>
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
            <p class="text-sm font-medium text-gray-500">
              {{ t("pos.avgServiceTime") }}
            </p>
            <p class="text-2xl font-semibold text-gray-900">
              {{ todayStats.avgServiceTime }}{{ t("pos.minutes") }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- 主要內容區 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- 左側：現金櫃管理 -->
      <div class="lg:col-span-2 space-y-6">
        <!-- 收銀櫃列表 -->
        <div class="bg-white rounded-lg shadow">
          <div class="p-6 border-b border-gray-200">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-semibold text-gray-900">
                {{ t("pos.registerList") }}
              </h2>
              <button
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                @click="createRegister"
              >
                {{ t("pos.addRegister") }}
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
                    <span class="text-gray-600"
                      >{{ t("pos.currentBalance") }}:</span
                    >
                    <span class="font-semibold">{{
                      formatPrice(register.currentBalance)
                    }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600"
                      >{{ t("pos.todayTransactions") }}:</span
                    >
                    <span>{{ register.todayTransactions }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600"
                      >{{ t("pos.lastActivity") }}:</span
                    >
                    <span>{{ formatTime(register.lastActivity) }}</span>
                  </div>
                </div>

                <div class="mt-4 flex space-x-2">
                  <button
                    v-if="register.status === 'inactive'"
                    class="flex-1 py-2 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors"
                    @click.stop="activateRegister(register.id)"
                  >
                    {{ t("pos.activate") }}
                  </button>
                  <button
                    v-else
                    class="flex-1 py-2 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-colors"
                    @click.stop="deactivateRegister(register.id)"
                  >
                    {{ t("pos.deactivate") }}
                  </button>

                  <button
                    class="flex-1 py-2 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                    @click.stop="openCashMovement(register)"
                  >
                    {{ t("pos.cashManagement") }}
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
              <h2 class="text-xl font-semibold text-gray-900">
                {{ t("pos.recentTransactions") }}
              </h2>
              <div class="flex space-x-2">
                <button
                  class="px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm hover:bg-gray-200 transition-colors"
                  @click="exportTransactions"
                >
                  {{ t("pos.export") }}
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
                      {{ transaction.description }} -
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
                    {{ transaction.amount >= 0 ? "+" : "-"
                    }}{{ formatPrice(Math.abs(transaction.amount)) }}
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
                {{ t("pos.noTransactions") }}
              </h3>
              <p class="text-gray-500">{{ t("pos.noTransactionsHint") }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 右側：快速操作 -->
      <div class="space-y-6">
        <!-- 快速收款 -->
        <div class="bg-white rounded-lg shadow">
          <div class="p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">
              {{ t("pos.quickPayment") }}
            </h3>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">{{
                  t("pos.orderNumber")
                }}</label>
                <input
                  v-model="quickPayment.orderNumber"
                  type="text"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  :placeholder="t('pos.orderNumberPlaceholder')"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">{{
                  t("pos.amount")
                }}</label>
                <div class="relative">
                  <span class="absolute left-3 top-3 text-gray-500">{{
                    currencySymbol
                  }}</span>
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
                <label class="block text-sm font-medium text-gray-700 mb-2">{{
                  t("pos.paymentMethod")
                }}</label>
                <select
                  v-model="quickPayment.paymentMethod"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">{{ t("pos.selectMethod") }}</option>
                  <option value="cash">{{ t("pos.methods.cash") }}</option>
                  <option value="card">{{ t("pos.methods.card") }}</option>
                  <option value="digital_wallet">
                    {{ t("pos.methods.digitalWallet") }}
                  </option>
                  <option value="bank_transfer">
                    {{ t("pos.methods.bankTransfer") }}
                  </option>
                </select>
              </div>

              <button
                :disabled="!canProcessQuickPayment"
                class="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                @click="processQuickPayment"
              >
                {{ t("pos.confirmPayment") }}
              </button>
            </div>
          </div>
        </div>

        <!-- 促銷活動 -->
        <div class="bg-white rounded-lg shadow">
          <div class="p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold text-gray-900">
                {{ t("pos.activePromotions") }}
              </h3>
              <button
                class="text-blue-600 hover:text-blue-700 text-sm font-medium"
                @click="openPromotionsDialog"
              >
                {{ t("pos.managePromotions") }}
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
                        : formatPrice(promotion.discountValue)
                    }}
                  </span>
                </div>
              </div>

              <div
                v-if="activePromotions.length === 0"
                class="text-center py-4"
              >
                <p class="text-sm text-gray-500">{{ t("pos.noPromotions") }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 今日班次狀況 -->
        <div class="bg-white rounded-lg shadow">
          <div class="p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold text-gray-900">
                {{ t("pos.todayShift") }}
              </h3>
              <button
                class="text-blue-600 hover:text-blue-700 text-sm font-medium"
                @click="generateShiftReport"
              >
                {{ t("pos.generateReport") }}
              </button>
            </div>

            <div v-if="currentShift" class="space-y-3">
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">{{ t("pos.startTime") }}:</span>
                <span class="font-medium">{{
                  formatTime(currentShift.startTime)
                }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">{{ t("pos.workHours") }}:</span>
                <span class="font-medium"
                  >{{ getShiftDuration() }}{{ t("pos.hours") }}</span
                >
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600"
                  >{{ t("pos.processedOrders") }}:</span
                >
                <span class="font-medium">{{
                  currentShift.processedOrders
                }}</span>
              </div>
              <div class="flex justify-between text-sm">
                <span class="text-gray-600">{{ t("pos.totalRevenue") }}:</span>
                <span class="font-medium text-green-600">{{
                  formatPrice(currentShift.totalRevenue)
                }}</span>
              </div>
            </div>

            <div v-else class="text-center py-4">
              <p class="text-sm text-gray-500 mb-3">{{ t("pos.noShift") }}</p>
              <button
                class="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                @click="startShift"
              >
                {{ t("pos.startShift") }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 現金管理模態框 -->
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
            <h3 class="text-xl font-semibold text-gray-900">
              {{ t("pos.cashManagement") }}
            </h3>
            <button
              class="text-gray-400 hover:text-gray-600"
              @click="closeCashMovementDialog"
            >
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">{{
                t("pos.operationType")
              }}</label>
              <select
                v-model="cashMovement.type"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">{{ t("pos.selectMethod") }}</option>
                <option value="cash_in">{{ t("pos.cashIn") }}</option>
                <option value="cash_out">{{ t("pos.cashOut") }}</option>
                <option value="drawer_count">{{ t("pos.drawerCount") }}</option>
                <option value="refund">{{ t("pos.refund") }}</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">{{
                t("pos.amount")
              }}</label>
              <div class="relative">
                <span class="absolute left-3 top-3 text-gray-500">{{
                  currencySymbol
                }}</span>
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
              <label class="block text-sm font-medium text-gray-700 mb-2">{{
                t("pos.description")
              }}</label>
              <textarea
                v-model="cashMovement.description"
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                :placeholder="t('pos.descriptionPlaceholder')"
              />
            </div>
          </div>

          <div class="flex justify-end space-x-3 mt-6">
            <button
              class="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors"
              @click="closeCashMovementDialog"
            >
              {{ t("pos.cancel") }}
            </button>
            <button
              :disabled="!canProcessCashMovement"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              @click="processCashMovement"
            >
              {{ t("pos.confirmOperation") }}
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
            <h3 class="text-xl font-semibold text-gray-900">
              {{ t("pos.promotionManagementTitle") }}
            </h3>
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
              {{ t("pos.addPromotion") }}
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
                  {{ promotion.isActive ? t("pos.enabled") : t("pos.paused") }}
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
                      : formatPrice(promotion.discountValue)
                  }}
                </span>

                <div class="flex space-x-2">
                  <button
                    class="px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm hover:bg-gray-200 transition-colors"
                    @click="editPromotion(promotion)"
                  >
                    {{ t("pos.edit") }}
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
                    {{ promotion.isActive ? t("pos.pause") : t("pos.enable") }}
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
import { useI18n } from "@/i18n";
import { useCurrency } from "@/composables/useCurrency";

const { t } = useI18n();
const { formatPrice, currencySymbol } = useCurrency();

// 類型定義
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

// 收銀櫃列表
const registers = ref<CashRegister[]>([
  {
    id: "reg_001",
    name: "主收銀機",
    status: "active",
    currentBalance: 850.25,
    todayTransactions: 28,
    lastActivity: new Date().toISOString(),
    location: "櫃台-01",
  },
  {
    id: "reg_002",
    name: "備用收銀機",
    status: "inactive",
    currentBalance: 200.0,
    todayTransactions: 0,
    lastActivity: new Date(Date.now() - 3600000).toISOString(),
    location: "櫃台-02",
  },
]);

// 最近交易
const recentTransactions = ref<Transaction[]>([
  {
    id: "txn_001",
    registerId: "reg_001",
    type: "sale",
    amount: 45.8,
    description: "訂單 ORD-001 付款",
    createdAt: new Date().toISOString(),
    operatorId: 1,
  },
  {
    id: "txn_002",
    registerId: "reg_001",
    type: "cash_in",
    amount: 500.0,
    description: "當次班次 - 起始金額",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    operatorId: 1,
  },
]);

// 促銷活動
const activePromotions = ref<Promotion[]>([
  {
    id: "promo_001",
    title: "午餐優惠",
    description: "11:30-14:30 全部菜品",
    discountType: "percentage",
    discountValue: 10,
    isActive: true,
    startDate: "2025-01-01",
    endDate: "2025-12-31",
    conditions: "time_based",
  },
]);

const allPromotions = ref<Promotion[]>([...activePromotions.value]);

// 快速收款
const quickPayment = ref({
  orderNumber: "",
  amount: 0,
  paymentMethod: "",
});

// 現金管理
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

// 輔助函數
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
    active: t("pos.registerStatus.active"),
    inactive: t("pos.registerStatus.inactive"),
    maintenance: t("pos.registerStatus.maintenance"),
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
    sale: t("pos.transactionType.sale"),
    refund: t("pos.transactionType.refund"),
    cash_in: t("pos.transactionType.cashIn"),
    cash_out: t("pos.transactionType.cashOut"),
    drawer_count: t("pos.transactionType.drawerCount"),
  };
  return texts[type] || type;
};

const selectRegister = (register: CashRegister) => {
  currentRegister.value = register;
};

const createRegister = () => {
  const name = prompt(t("pos.prompts.registerName"));
  if (name) {
    const newRegister: CashRegister = {
      id: `reg_${Date.now()}`,
      name,
      status: "inactive",
      currentBalance: 0,
      todayTransactions: 0,
      lastActivity: new Date().toISOString(),
      location: t("pos.defaults.locationPending"),
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
  const startingCash = prompt(t("pos.prompts.startingCash"));
  if (startingCash && !isNaN(parseFloat(startingCash))) {
    currentShift.value = {
      id: `shift_${Date.now()}`,
      name: t("pos.defaults.morningShift"),
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
  if (currentShift.value && confirm(t("pos.confirms.endShift"))) {
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
    // 模擬處理付款
    const newTransaction: Transaction = {
      id: `txn_${Date.now()}`,
      registerId: currentRegister.value!.id,
      type: "sale",
      amount: quickPayment.value.amount,
      description: t("pos.defaults.orderPayment", {
        orderNumber: quickPayment.value.orderNumber,
      }),
      createdAt: new Date().toISOString(),
      operatorId: 1,
    };

    recentTransactions.value.unshift(newTransaction);

    // 更新收銀櫃餘額和統計
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

    alert(t("pos.alerts.paymentSuccess"));
  } catch {
    alert(t("pos.alerts.paymentFailed"));
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
    alert(t("pos.alerts.cashSuccess"));
  } catch {
    alert(t("pos.alerts.operationFailed"));
  }
};

const openPromotionsDialog = () => {
  showPromotionsDialog.value = true;
};

const closePromotionsDialog = () => {
  showPromotionsDialog.value = false;
};

const createPromotion = () => {
  const title = prompt(t("pos.prompts.promotionName"));
  if (title) {
    const newPromotion: Promotion = {
      id: `promo_${Date.now()}`,
      title,
      description: t("pos.defaults.newPromotion"),
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
  alert(t("pos.alerts.exportInDev"));
};

const generateShiftReport = () => {
  alert(t("pos.alerts.reportInDev"));
};

// 生命週期
onMounted(async () => {
  // 自動選擇第一個現金櫃
  if (registers.value.length > 0) {
    currentRegister.value = registers.value[0];
  }
});
</script>

<style scoped>
.pos-management {
  /* Inherits padding from parent POSView container */
}
</style>
