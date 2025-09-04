<template>
  <div class="cashier-view">
    <!-- 收銀台標題 -->
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">收銀台</h1>
        <p class="text-gray-600">處理訂單結帳和付款</p>
      </div>
      <div class="flex items-center space-x-6">
        <!-- 班次資訊 -->
        <div class="bg-blue-100 px-4 py-2 rounded-lg">
          <p class="text-sm text-blue-800 font-medium">
            班次: {{ currentShift.name }}
          </p>
          <p class="text-xs text-blue-600">
            {{ currentShift.startTime }} - {{ currentShift.endTime }}
          </p>
        </div>

        <!-- 今日業績 -->
        <div class="text-right">
          <p class="text-sm text-gray-500">今日業績</p>
          <p class="text-lg font-semibold text-green-600">
            RM{{ formatMoney(todayRevenue) }}
          </p>
        </div>

        <!-- 現在時間 -->
        <div class="text-right">
          <p class="text-sm text-gray-500">當前時間</p>
          <p class="text-lg font-semibold">
            {{ currentTime }}
          </p>
        </div>

        <!-- 功能按鈕 -->
        <div class="flex items-center space-x-2">
          <button
            class="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
            @click="openShiftReport"
          >
            班次報告
          </button>
          <button
            class="px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm"
            @click="openRefundDialog"
          >
            退款處理
          </button>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- 左側：待結帳訂單列表 -->
      <div class="lg:col-span-2">
        <div class="bg-white rounded-lg shadow">
          <div class="p-6 border-b border-gray-200">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-semibold text-gray-900">待結帳訂單</h2>
              <div class="flex items-center space-x-4">
                <div class="relative">
                  <MagnifyingGlassIcon
                    class="absolute left-3 top-3 h-4 w-4 text-gray-400"
                  />
                  <input
                    v-model="searchQuery"
                    type="text"
                    placeholder="搜索訂單編號或桌號..."
                    class="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <button
                  class="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  @click="refreshOrders"
                >
                  <ArrowPathIcon class="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          <div class="divide-y divide-gray-200">
            <div
              v-for="order in filteredOrders"
              :key="order.id"
              :class="[
                'p-6 cursor-pointer hover:bg-gray-50 transition-colors',
                selectedOrder?.id === order.id
                  ? 'bg-blue-50 border-l-4 border-blue-500'
                  : '',
              ]"
              @click="selectOrder(order)"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center">
                  <div class="flex-shrink-0">
                    <div
                      class="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center"
                    >
                      <DocumentTextIcon class="w-5 h-5 text-blue-600" />
                    </div>
                  </div>
                  <div class="ml-4">
                    <div class="flex items-center">
                      <h3 class="text-lg font-medium text-gray-900">
                        {{ order.orderNumber }}
                      </h3>
                      <span
                        :class="getOrderStatusClass(order.status)"
                        class="ml-2 px-2 py-1 text-xs font-medium rounded-full"
                      >
                        {{ getOrderStatusText(order.status) }}
                      </span>
                    </div>
                    <div class="flex items-center mt-1 text-sm text-gray-500">
                      <MapPinIcon class="w-4 h-4 mr-1" />
                      <span>{{
                        order.tableNumber ? `桌號 ${order.tableNumber}` : "外帶"
                      }}</span>
                      <span class="mx-2">•</span>
                      <ClockIcon class="w-4 h-4 mr-1" />
                      <span>{{ formatTime(order.createdAt) }}</span>
                    </div>
                  </div>
                </div>
                <div class="text-right">
                  <p class="text-xl font-bold text-gray-900">
                    RM{{ formatMoney(order.totalAmount) }}
                  </p>
                  <p class="text-sm text-gray-500">
                    {{ order.items.length }} 項商品
                  </p>
                </div>
              </div>
            </div>

            <!-- 空狀態 -->
            <div v-if="filteredOrders.length === 0" class="p-12 text-center">
              <ShoppingBagIcon class="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 class="text-lg font-medium text-gray-900 mb-2">
                暫無待結帳訂單
              </h3>
              <p class="text-gray-500">所有訂單都已完成結帳</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 右側：結帳區域 -->
      <div class="space-y-6">
        <!-- 選中的訂單詳情 -->
        <div class="bg-white rounded-lg shadow">
          <div class="p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">
              {{ selectedOrder ? "訂單詳情" : "選擇訂單" }}
            </h3>

            <div v-if="selectedOrder">
              <!-- 訂單基本信息 -->
              <div class="mb-6">
                <div class="flex items-center justify-between mb-4">
                  <h4 class="font-medium text-gray-900">
                    {{ selectedOrder.orderNumber }}
                  </h4>
                  <span
                    :class="getOrderStatusClass(selectedOrder.status)"
                    class="px-2 py-1 text-xs font-medium rounded-full"
                  >
                    {{ getOrderStatusText(selectedOrder.status) }}
                  </span>
                </div>
                <div class="text-sm text-gray-600 space-y-1">
                  <div class="flex justify-between">
                    <span>桌號:</span>
                    <span>{{ selectedOrder.tableNumber || "外帶" }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span>下單時間:</span>
                    <span>{{ formatDateTime(selectedOrder.createdAt) }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span>客戶:</span>
                    <span>{{ selectedOrder.customerName || "客戶" }}</span>
                  </div>
                </div>
              </div>

              <!-- 商品清單 -->
              <div class="mb-6">
                <h5 class="font-medium text-gray-900 mb-3">商品清單</h5>
                <div class="space-y-2">
                  <div
                    v-for="item in selectedOrder.items"
                    :key="item.id"
                    class="flex justify-between text-sm"
                  >
                    <div>
                      <span class="font-medium">{{ item.menuItemName }}</span>
                      <span class="text-gray-500 ml-2"
                        >x{{ item.quantity }}</span
                      >
                    </div>
                    <span>RM{{ formatMoney(item.totalPrice) }}</span>
                  </div>
                </div>
              </div>

              <!-- 金額計算 -->
              <div class="border-t border-gray-200 pt-4 space-y-2">
                <div class="flex justify-between text-sm">
                  <span>小計:</span>
                  <span>RM{{ formatMoney(selectedOrder.subtotal) }}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span>服務費 (10%):</span>
                  <span>RM{{ formatMoney(selectedOrder.serviceCharge) }}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span>稅費 (6%):</span>
                  <span>RM{{ formatMoney(selectedOrder.taxAmount) }}</span>
                </div>
                <div
                  v-if="selectedOrder.discountAmount > 0"
                  class="flex justify-between text-sm text-green-600"
                >
                  <span>折扣:</span>
                  <span
                    >-RM{{ formatMoney(selectedOrder.discountAmount) }}</span
                  >
                </div>
                <div
                  class="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-200"
                >
                  <span>總計:</span>
                  <span>RM{{ formatMoney(selectedOrder.totalAmount) }}</span>
                </div>
              </div>
            </div>

            <div v-else class="text-center py-8">
              <CursorArrowRaysIcon
                class="mx-auto h-12 w-12 text-gray-400 mb-2"
              />
              <p class="text-gray-500">請選擇要結帳的訂單</p>
            </div>
          </div>
        </div>

        <!-- 付款方式選擇 -->
        <div v-if="selectedOrder" class="bg-white rounded-lg shadow">
          <div class="p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">付款方式</h3>

            <div class="grid grid-cols-2 gap-3 mb-4">
              <button
                v-for="method in paymentMethods"
                :key="method.id"
                :class="[
                  'flex flex-col items-center p-4 border-2 rounded-lg transition-colors',
                  selectedPaymentMethod === method.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300',
                ]"
                @click="selectedPaymentMethod = method.id"
              >
                <component :is="method.icon" class="w-6 h-6 mb-2" />
                <span class="text-sm font-medium">{{ method.name }}</span>
              </button>
            </div>

            <!-- 現金付款輸入 -->
            <div v-if="selectedPaymentMethod === 'cash'" class="mb-4">
              <label class="block text-sm font-medium text-gray-700 mb-2"
                >客戶給付金額</label
              >
              <div class="relative">
                <span class="absolute left-3 top-3 text-gray-500">RM</span>
                <input
                  v-model.number="cashReceived"
                  type="number"
                  step="0.01"
                  min="0"
                  class="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                  placeholder="0.00"
                />
              </div>
              <div
                v-if="cashReceived > 0"
                class="mt-2 p-3 bg-gray-50 rounded-lg"
              >
                <div class="flex justify-between text-sm">
                  <span>應收:</span>
                  <span class="font-medium"
                    >RM{{ formatMoney(selectedOrder.totalAmount) }}</span
                  >
                </div>
                <div class="flex justify-between text-sm">
                  <span>實收:</span>
                  <span class="font-medium"
                    >RM{{ formatMoney(cashReceived) }}</span
                  >
                </div>
                <div
                  class="flex justify-between text-lg font-bold mt-1 pt-1 border-t border-gray-200"
                >
                  <span>找零:</span>
                  <span
                    :class="change >= 0 ? 'text-green-600' : 'text-red-600'"
                  >
                    RM{{ formatMoney(change) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- 結帳按鈕 -->
            <div class="space-y-3">
              <button
                :disabled="!canProcessPayment"
                class="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-lg"
                @click="processPayment"
              >
                確認收款
              </button>

              <div class="grid grid-cols-2 gap-3">
                <button
                  class="py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm"
                  @click="applyDiscount"
                >
                  套用折扣
                </button>
                <button
                  class="py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                  @click="printReceipt"
                >
                  列印收據
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 班次報告模態框 -->
    <div v-if="showShiftReport" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div
          class="fixed inset-0 bg-black opacity-30"
          @click="closeShiftReport"
        />
        <div
          class="relative bg-white rounded-lg shadow-xl max-w-2xl w-full p-6"
        >
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-semibold text-gray-900">班次報告</h3>
            <button
              class="text-gray-400 hover:text-gray-600"
              @click="closeShiftReport"
            >
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>

          <div class="space-y-6">
            <!-- 班次基本資訊 -->
            <div class="grid grid-cols-2 gap-4">
              <div class="bg-blue-50 p-4 rounded-lg">
                <h4 class="font-medium text-blue-900 mb-2">班次資訊</h4>
                <div class="text-sm text-blue-800 space-y-1">
                  <p>班次: {{ shiftReport.name }}</p>
                  <p>
                    時間: {{ shiftReport.startTime }} -
                    {{ shiftReport.endTime }}
                  </p>
                  <p>收銀員: {{ shiftReport.cashierName }}</p>
                </div>
              </div>
              <div class="bg-green-50 p-4 rounded-lg">
                <h4 class="font-medium text-green-900 mb-2">盈收總計</h4>
                <div class="text-sm text-green-800 space-y-1">
                  <p>現金: RM{{ formatMoney(shiftReport.cashTotal) }}</p>
                  <p>刷卡: RM{{ formatMoney(shiftReport.cardTotal) }}</p>
                  <p>電子支付: RM{{ formatMoney(shiftReport.digitalTotal) }}</p>
                  <p class="font-bold text-lg pt-1 border-t border-green-200">
                    總計: RM{{ formatMoney(shiftReport.totalRevenue) }}
                  </p>
                </div>
              </div>
            </div>

            <!-- 交易明細 -->
            <div>
              <h4 class="font-medium text-gray-900 mb-3">交易明細</h4>
              <div class="grid grid-cols-3 gap-4 text-center">
                <div class="bg-gray-50 p-3 rounded">
                  <p class="text-sm text-gray-600">總訂單數</p>
                  <p class="text-2xl font-bold text-gray-900">
                    {{ shiftReport.totalOrders }}
                  </p>
                </div>
                <div class="bg-gray-50 p-3 rounded">
                  <p class="text-sm text-gray-600">平均客單價</p>
                  <p class="text-2xl font-bold text-gray-900">
                    RM{{ formatMoney(shiftReport.avgOrderValue) }}
                  </p>
                </div>
                <div class="bg-gray-50 p-3 rounded">
                  <p class="text-sm text-gray-600">退款次數</p>
                  <p class="text-2xl font-bold text-gray-900">
                    {{ shiftReport.refundCount }}
                  </p>
                </div>
              </div>
            </div>

            <!-- 現金盤點 -->
            <div class="bg-yellow-50 p-4 rounded-lg">
              <h4 class="font-medium text-yellow-900 mb-3">現金盤點</h4>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-yellow-800 mb-1"
                    >系統記錄金額</label
                  >
                  <div class="text-lg font-bold text-yellow-900">
                    RM{{ formatMoney(shiftReport.systemCashAmount) }}
                  </div>
                </div>
                <div>
                  <label class="block text-sm font-medium text-yellow-800 mb-1"
                    >實際盤點金額</label
                  >
                  <input
                    v-model.number="actualCashAmount"
                    type="number"
                    step="0.01"
                    class="w-full px-3 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div
                class="mt-3 p-2 rounded"
                :class="
                  cashDifference === 0
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                "
              >
                <p class="text-sm font-medium">
                  {{
                    cashDifference === 0
                      ? "盤點符合"
                      : cashDifference > 0
                        ? `現金多 RM${formatMoney(Math.abs(cashDifference))}`
                        : `現金少 RM${formatMoney(Math.abs(cashDifference))}`
                  }}
                </p>
              </div>
            </div>
          </div>

          <div class="flex justify-end space-x-3 mt-6">
            <button
              class="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors"
              @click="closeShiftReport"
            >
              關閉
            </button>
            <button
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              @click="printShiftReport"
            >
              列印報告
            </button>
            <button
              class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              @click="endShift"
            >
              結束班次
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 退款處理模態框 -->
    <div v-if="showRefundDialog" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div
          class="fixed inset-0 bg-black opacity-30"
          @click="closeRefundDialog"
        />
        <div class="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-semibold text-gray-900">退款處理</h3>
            <button
              class="text-gray-400 hover:text-gray-600"
              @click="closeRefundDialog"
            >
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2"
                >訂單編號</label
              >
              <input
                v-model="refundData.orderNumber"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="輸入訂單編號"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2"
                >退款金額</label
              >
              <div class="relative">
                <span class="absolute left-3 top-3 text-gray-500">RM</span>
                <input
                  v-model.number="refundData.amount"
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
                >退款原因</label
              >
              <select
                v-model="refundData.reason"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">請選擇原因</option>
                <option value="quality_issue">菜品品質問題</option>
                <option value="wrong_order">上錯菜</option>
                <option value="customer_change">客戶改變主意</option>
                <option value="service_issue">服務問題</option>
                <option value="other">其他原因</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2"
                >備註</label
              >
              <textarea
                v-model="refundData.notes"
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="選填備註資訊"
              />
            </div>
          </div>

          <div class="flex justify-end space-x-3 mt-6">
            <button
              class="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors"
              @click="closeRefundDialog"
            >
              取消
            </button>
            <button
              :disabled="!canProcessRefund"
              class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              @click="processRefund"
            >
              確認退款
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 收款成功模態框 -->
    <div v-if="showPaymentSuccess" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div class="fixed inset-0 bg-black opacity-30" />
        <div
          class="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6 text-center"
        >
          <CheckCircleIcon class="mx-auto h-16 w-16 text-green-600 mb-4" />
          <h3 class="text-xl font-semibold text-gray-900 mb-2">收款成功！</h3>
          <p class="text-gray-600 mb-6">
            訂單 {{ completedOrder?.orderNumber }} 已完成結帳
          </p>
          <div class="space-y-3">
            <button
              class="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              @click="printFinalReceipt"
            >
              列印收據
            </button>
            <button
              class="w-full py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors"
              @click="closePaymentSuccess"
            >
              完成
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  MapPinIcon,
  ClockIcon,
  ShoppingBagIcon,
  CursorArrowRaysIcon,
  CheckCircleIcon,
  XMarkIcon,
} from "@heroicons/vue/24/outline";
import {
  CreditCardIcon,
  BanknotesIcon,
  DevicePhoneMobileIcon,
  BuildingLibraryIcon,
} from "@heroicons/vue/24/solid";

// Type definitions
interface OrderItem {
  id: number;
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface CashierOrder {
  id: number;
  orderNumber: string;
  tableNumber: string;
  customerName: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
  subtotal: number;
  serviceCharge: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod?: string;
  items: OrderItem[];
}

// 響應式數據
const currentTime = ref("");
const searchQuery = ref("");
const selectedOrder = ref<CashierOrder | null>(null);
const selectedPaymentMethod = ref("cash");
const cashReceived = ref(0);
const showPaymentSuccess = ref(false);
const completedOrder = ref<CashierOrder | null>(null);

// 新增的狀態
const showShiftReport = ref(false);
const showRefundDialog = ref(false);
const actualCashAmount = ref(0);
const todayRevenue = ref(1250.75);

let timeInterval: NodeJS.Timeout | null = null;

// 班次資訊
const currentShift = ref({
  name: "早班",
  startTime: "08:00",
  endTime: "16:00",
  cashierName: "李小明",
});

// 班次報告數據
const shiftReport = ref({
  name: "早班",
  startTime: "08:00",
  endTime: "16:00",
  cashierName: "李小明",
  cashTotal: 450.25,
  cardTotal: 680.5,
  digitalTotal: 120.0,
  totalRevenue: 1250.75,
  totalOrders: 28,
  avgOrderValue: 44.67,
  refundCount: 2,
  systemCashAmount: 450.25,
});

// 退款數據
const refundData = ref({
  orderNumber: "",
  amount: 0,
  reason: "",
  notes: "",
});

// 付款方式
const paymentMethods = [
  { id: "cash", name: "現金", icon: BanknotesIcon },
  { id: "card", name: "刷卡", icon: CreditCardIcon },
  { id: "digital_wallet", name: "電子錢包", icon: DevicePhoneMobileIcon },
  { id: "bank_transfer", name: "銀行轉帳", icon: BuildingLibraryIcon },
];

// 模擬待結帳訂單
const orders = ref([
  {
    id: 1,
    orderNumber: "ORD-001",
    tableNumber: "T01",
    customerName: "張先生",
    status: "ready",
    paymentStatus: "unpaid",
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    subtotal: 45.0,
    serviceCharge: 4.5,
    taxAmount: 2.97,
    discountAmount: 0,
    totalAmount: 52.47,
    items: [
      {
        id: 1,
        menuItemName: "招牌炒飯",
        quantity: 2,
        unitPrice: 12.0,
        totalPrice: 24.0,
      },
      {
        id: 2,
        menuItemName: "冰奶茶",
        quantity: 1,
        unitPrice: 5.0,
        totalPrice: 5.0,
      },
      {
        id: 3,
        menuItemName: "春卷",
        quantity: 2,
        unitPrice: 8.0,
        totalPrice: 16.0,
      },
    ],
  },
  {
    id: 2,
    orderNumber: "ORD-002",
    tableNumber: "T03",
    customerName: "李小姐",
    status: "served",
    paymentStatus: "unpaid",
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    subtotal: 28.5,
    serviceCharge: 2.85,
    taxAmount: 1.88,
    discountAmount: 5.0,
    totalAmount: 28.23,
    items: [
      {
        id: 4,
        menuItemName: "南洋咖啡",
        quantity: 2,
        unitPrice: 2.8,
        totalPrice: 5.6,
      },
      {
        id: 5,
        menuItemName: "咖椰吐司",
        quantity: 1,
        unitPrice: 3.5,
        totalPrice: 3.5,
      },
      {
        id: 6,
        menuItemName: "半生熟蛋",
        quantity: 2,
        unitPrice: 2.4,
        totalPrice: 4.8,
      },
      {
        id: 7,
        menuItemName: "紅豆冰",
        quantity: 2,
        unitPrice: 6.5,
        totalPrice: 13.0,
      },
    ],
  },
]);

// 計算屬性
const filteredOrders = computed(() => {
  let filtered = orders.value.filter(
    (order) =>
      ["ready", "served"].includes(order.status) &&
      order.paymentStatus === "unpaid",
  );

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(
      (order) =>
        order.orderNumber.toLowerCase().includes(query) ||
        order.tableNumber?.toLowerCase().includes(query) ||
        order.customerName?.toLowerCase().includes(query),
    );
  }

  return filtered.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
});

const change = computed(() => {
  if (!selectedOrder.value || selectedPaymentMethod.value !== "cash") return 0;
  return cashReceived.value - selectedOrder.value.totalAmount;
});

const canProcessPayment = computed(() => {
  if (!selectedOrder.value || !selectedPaymentMethod.value) return false;

  if (selectedPaymentMethod.value === "cash") {
    return cashReceived.value >= selectedOrder.value.totalAmount;
  }

  return true;
});

const canProcessRefund = computed(() => {
  return (
    refundData.value.orderNumber &&
    refundData.value.amount > 0 &&
    refundData.value.reason
  );
});

const cashDifference = computed(() => {
  return actualCashAmount.value - shiftReport.value.systemCashAmount;
});

// 方法
const updateCurrentTime = () => {
  currentTime.value = new Date().toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const refreshOrders = async () => {
  // 模擬API調用
  console.log("Refreshing cashier orders...");
};

const selectOrder = (order: CashierOrder) => {
  selectedOrder.value = order;
  cashReceived.value = 0;
  selectedPaymentMethod.value = "cash";
};

const formatMoney = (amount: number) => {
  return amount.toFixed(2);
};

const formatTime = (dateTime: string) => {
  return new Date(dateTime).toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateTime = (dateTime: string) => {
  return new Date(dateTime).toLocaleString("zh-TW");
};

const getOrderStatusClass = (status: string) => {
  const classes: Record<string, string> = {
    ready: "bg-green-100 text-green-800",
    served: "bg-blue-100 text-blue-800",
    completed: "bg-gray-100 text-gray-800",
  };
  return classes[status] || "bg-gray-100 text-gray-800";
};

const getOrderStatusText = (status: string) => {
  const texts: Record<string, string> = {
    ready: "待取餐",
    served: "已送達",
    completed: "已完成",
  };
  return texts[status] || status;
};

const processPayment = async () => {
  if (!canProcessPayment.value) return;

  try {
    // 模擬支付處理
    const orderIndex = orders.value.findIndex(
      (o) => o.id === selectedOrder.value!.id,
    );
    if (orderIndex > -1) {
      orders.value[orderIndex].paymentStatus = "paid";
      orders.value[orderIndex].status = "completed" as string;
      (orders.value[orderIndex] as CashierOrder).paymentMethod =
        selectedPaymentMethod.value;

      completedOrder.value = { ...selectedOrder.value! };
      showPaymentSuccess.value = true;
      selectedOrder.value = null;
    }
  } catch (error) {
    console.error("Payment processing error:", error);
    alert("支付處理失敗，請重試");
  }
};

const applyDiscount = () => {
  if (!selectedOrder.value) return;

  const discountPercent = prompt("請輸入折扣百分比 (例如: 10 表示 10% 折扣)");
  if (discountPercent && !isNaN(parseFloat(discountPercent))) {
    const discount =
      (selectedOrder.value.subtotal +
        selectedOrder.value.serviceCharge +
        selectedOrder.value.taxAmount) *
      (parseFloat(discountPercent) / 100);
    selectedOrder.value.discountAmount = Math.max(0, discount);
    selectedOrder.value.totalAmount = Math.max(
      0,
      selectedOrder.value.subtotal +
        selectedOrder.value.serviceCharge +
        selectedOrder.value.taxAmount -
        selectedOrder.value.discountAmount,
    );
  }
};

const printReceipt = () => {
  alert("收據列印功能開發中...");
};

const printFinalReceipt = () => {
  alert(`正在列印 ${completedOrder.value?.orderNumber} 的收據...`);
  closePaymentSuccess();
};

const closePaymentSuccess = () => {
  showPaymentSuccess.value = false;
  completedOrder.value = null;
};

// 班次報告相關方法
const openShiftReport = () => {
  showShiftReport.value = true;
  actualCashAmount.value = shiftReport.value.systemCashAmount;
};

const closeShiftReport = () => {
  showShiftReport.value = false;
};

const printShiftReport = () => {
  alert("正在列印班次報告...");
};

const endShift = () => {
  if (confirm("確定要結束當前班次嗎？結束後將無法再進行修改。")) {
    alert("班次已結束，資料已保存。");
    closeShiftReport();
  }
};

// 退款相關方法
const openRefundDialog = () => {
  showRefundDialog.value = true;
  refundData.value = {
    orderNumber: "",
    amount: 0,
    reason: "",
    notes: "",
  };
};

const closeRefundDialog = () => {
  showRefundDialog.value = false;
};

const processRefund = async () => {
  try {
    // 模擬退款處理
    alert(
      `退款處理成功：\n訂單: ${refundData.value.orderNumber}\n金額: RM${formatMoney(refundData.value.amount)}\n原因: ${getRefundReasonText(refundData.value.reason)}`,
    );

    // 更新統計數據
    shiftReport.value.refundCount++;
    shiftReport.value.totalRevenue -= refundData.value.amount;
    todayRevenue.value -= refundData.value.amount;

    closeRefundDialog();
  } catch (error) {
    console.error("Refund processing error:", error);
    alert("退款處理失敗，請重試");
  }
};

const getRefundReasonText = (reason: string) => {
  const reasons: Record<string, string> = {
    quality_issue: "菜品品質問題",
    wrong_order: "上錯菜",
    customer_change: "客戶改變主意",
    service_issue: "服務問題",
    other: "其他原因",
  };
  return reasons[reason] || reason;
};

// 生命周期
onMounted(() => {
  updateCurrentTime();
  timeInterval = setInterval(updateCurrentTime, 1000);
});

onUnmounted(() => {
  if (timeInterval) clearInterval(timeInterval);
});
</script>

<style scoped>
.cashier-view {
  padding: 1.5rem;
  min-height: 100vh;
  background-color: #f9fafb;
}

@media (max-width: 640px) {
  .cashier-view {
    padding: 1rem;
  }
}
</style>
