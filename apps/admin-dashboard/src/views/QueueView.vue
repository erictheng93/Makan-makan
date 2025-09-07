<template>
  <div class="queue-view">
    <!-- 標題區域 -->
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">候位管理系統</h1>
        <p class="text-gray-600">智能排隊管理和座位分配</p>
      </div>
      <div class="flex items-center space-x-4">
        <!-- 即時狀態 -->
        <div class="bg-green-100 px-4 py-2 rounded-lg">
          <p class="text-sm text-green-800 font-medium">
            候位中: {{ currentWaiting }}
          </p>
          <p class="text-xs text-green-600">平均等待: {{ avgWaitTime }}分鐘</p>
        </div>

        <!-- 功能按鈕 -->
        <button
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          @click="openQueueSettings"
        >
          排隊設定
        </button>

        <button
          class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          @click="openDisplaySettings"
        >
          顯示設定
        </button>

        <button
          class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          @click="callNextCustomer"
        >
          呼叫下一位
        </button>
      </div>
    </div>

    <!-- 狀態統計卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-blue-100">
            <UsersIcon class="h-6 w-6 text-blue-600" />
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500">候位中</p>
            <p class="text-2xl font-semibold text-gray-900">
              {{ currentWaiting }}
            </p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-green-100">
            <ClockIcon class="h-6 w-6 text-green-600" />
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500">平均等待</p>
            <p class="text-2xl font-semibold text-gray-900">
              {{ avgWaitTime }}分
            </p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-purple-100">
            <BuildingStorefrontIcon class="h-6 w-6 text-purple-600" />
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500">可用桌位</p>
            <p class="text-2xl font-semibold text-gray-900">
              {{ availableTables }}
            </p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-orange-100">
            <ChartBarIcon class="h-6 w-6 text-orange-600" />
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500">今日服務</p>
            <p class="text-2xl font-semibold text-gray-900">
              {{ todayServed }}
            </p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-red-100">
            <ExclamationTriangleIcon class="h-6 w-6 text-red-600" />
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500">逾期候位</p>
            <p class="text-2xl font-semibold text-gray-900">
              {{ overdueQueue }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- 主要內容區域 -->
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <!-- 左側：排隊佇列 -->
      <div class="lg:col-span-2">
        <div class="bg-white rounded-lg shadow">
          <div class="p-6 border-b border-gray-200">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-semibold text-gray-900">排隊佇列</h2>
              <div class="flex items-center space-x-4">
                <!-- 篩選器 -->
                <select
                  v-model="queueFilter"
                  class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">全部</option>
                  <option value="waiting">候位中</option>
                  <option value="called">已叫號</option>
                  <option value="no_show">未到場</option>
                </select>

                <button
                  class="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  @click="refreshQueue"
                >
                  <ArrowPathIcon class="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          <div class="divide-y divide-gray-200">
            <div
              v-for="(queueItem, index) in filteredQueue"
              :key="queueItem.id"
              :class="[
                'p-4 cursor-pointer hover:bg-gray-50 transition-colors',
                queueItem.status === 'called' ? 'bg-yellow-50' : '',
                queueItem.status === 'no_show' ? 'bg-red-50' : '',
              ]"
              @click="selectQueueItem(queueItem)"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center">
                  <!-- 排號 -->
                  <div class="flex-shrink-0">
                    <div
                      :class="[
                        'w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg',
                        getQueueNumberColor(queueItem.status),
                      ]"
                    >
                      {{ queueItem.queueNumber }}
                    </div>
                  </div>

                  <!-- 基本資訊 -->
                  <div class="ml-4">
                    <div class="flex items-center">
                      <h3 class="text-lg font-medium text-gray-900">
                        {{
                          queueItem.customerName ||
                          `顧客 ${queueItem.queueNumber}`
                        }}
                      </h3>
                      <span
                        :class="getStatusClass(queueItem.status)"
                        class="ml-2 px-2 py-1 text-xs font-medium rounded-full"
                      >
                        {{ getStatusText(queueItem.status) }}
                      </span>
                    </div>

                    <div class="flex items-center mt-1 text-sm text-gray-500">
                      <UsersIcon class="w-4 h-4 mr-1" />
                      <span>{{ queueItem.partySize }} 人</span>
                      <span class="mx-2">•</span>
                      <ClockIcon class="w-4 h-4 mr-1" />
                      <span>等待 {{ getWaitTime(queueItem.joinedAt) }}分</span>

                      <span v-if="queueItem.tablePreference" class="mx-2"
                        >•</span
                      >
                      <BuildingStorefrontIcon
                        v-if="queueItem.tablePreference"
                        class="w-4 h-4 mr-1"
                      />
                      <span v-if="queueItem.tablePreference">{{
                        queueItem.tablePreference
                      }}</span>
                    </div>
                  </div>
                </div>

                <!-- 操作區域 -->
                <div class="flex items-center space-x-2">
                  <!-- 優先級指示 -->
                  <div v-if="queueItem.priority > 0" class="flex items-center">
                    <StarIcon class="w-4 h-4 text-yellow-500" />
                    <span class="text-xs text-yellow-600 ml-1">VIP</span>
                  </div>

                  <!-- 預計等待時間 -->
                  <div class="text-right">
                    <p class="text-sm font-medium text-gray-900">
                      預計: {{ calculateEstimatedWait(index) }}分
                    </p>
                    <p class="text-xs text-gray-500">
                      {{ formatTime(queueItem.joinedAt) }} 加入
                    </p>
                  </div>

                  <!-- 快速操作按鈕 -->
                  <div class="flex flex-col space-y-1">
                    <button
                      v-if="queueItem.status === 'waiting'"
                      class="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors"
                      @click.stop="callCustomer(queueItem)"
                    >
                      叫號
                    </button>

                    <button
                      v-if="queueItem.status === 'called'"
                      class="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 transition-colors"
                      @click.stop="seatCustomer(queueItem)"
                    >
                      安排座位
                    </button>

                    <button
                      class="px-3 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700 transition-colors"
                      @click.stop="editQueueItem(queueItem)"
                    >
                      編輯
                    </button>
                  </div>
                </div>
              </div>

              <!-- 特殊需求和備註 -->
              <div
                v-if="queueItem.specialRequests || queueItem.notes"
                class="mt-3 p-2 bg-gray-50 rounded"
              >
                <p
                  v-if="queueItem.specialRequests"
                  class="text-xs text-gray-600"
                >
                  <span class="font-medium">特殊需求:</span>
                  {{ queueItem.specialRequests }}
                </p>
                <p v-if="queueItem.notes" class="text-xs text-gray-600 mt-1">
                  <span class="font-medium">備註:</span> {{ queueItem.notes }}
                </p>
              </div>
            </div>

            <!-- 空狀態 -->
            <div v-if="filteredQueue.length === 0" class="p-12 text-center">
              <UsersIcon class="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 class="text-lg font-medium text-gray-900 mb-2">
                暫無候位顧客
              </h3>
              <p class="text-gray-500">當前沒有顧客在排隊等待</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 右側上：桌位狀態 -->
      <div class="lg:col-span-2">
        <div class="bg-white rounded-lg shadow mb-6">
          <div class="p-6 border-b border-gray-200">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-semibold text-gray-900">桌位狀態</h2>
              <div class="flex space-x-2">
                <button
                  class="px-3 py-1 bg-green-100 text-green-800 rounded text-sm"
                  :class="{
                    'bg-green-600 text-white': tableViewFilter === 'available',
                  }"
                  @click="toggleTableView('available')"
                >
                  可用 ({{ availableTables }})
                </button>
                <button
                  class="px-3 py-1 bg-red-100 text-red-800 rounded text-sm"
                  :class="{
                    'bg-red-600 text-white': tableViewFilter === 'occupied',
                  }"
                  @click="toggleTableView('occupied')"
                >
                  使用中 ({{ occupiedTables }})
                </button>
                <button
                  class="px-3 py-1 bg-gray-100 text-gray-800 rounded text-sm"
                  :class="{
                    'bg-gray-600 text-white': tableViewFilter === 'all',
                  }"
                  @click="toggleTableView('all')"
                >
                  全部
                </button>
              </div>
            </div>
          </div>

          <div class="p-6">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div
                v-for="table in filteredTables"
                :key="table.id"
                :class="[
                  'relative p-4 rounded-lg border-2 cursor-pointer transition-all',
                  getTableStatusColor(table.status),
                  selectedTable?.id === table.id ? 'ring-2 ring-blue-500' : '',
                ]"
                @click="selectTable(table)"
              >
                <div class="text-center">
                  <div class="font-bold text-lg">{{ table.number }}</div>
                  <div class="text-sm text-gray-600">
                    {{ table.capacity }}人桌
                  </div>

                  <!-- 狀態指示 -->
                  <div class="mt-2">
                    <span
                      :class="getTableStatusTextColor(table.status)"
                      class="text-xs font-medium px-2 py-1 rounded-full"
                    >
                      {{ getTableStatusText(table.status) }}
                    </span>
                  </div>

                  <!-- 使用時間（如果有） -->
                  <div
                    v-if="table.occupiedSince"
                    class="text-xs text-gray-500 mt-1"
                  >
                    用餐 {{ getOccupiedTime(table.occupiedSince) }}分
                  </div>
                </div>

                <!-- 清潔狀態 -->
                <div
                  v-if="table.cleaningStatus === 'cleaning'"
                  class="absolute top-2 right-2"
                >
                  <div
                    class="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 快速操作面板 -->
        <div class="bg-white rounded-lg shadow">
          <div class="p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">快速操作</h3>

            <div class="grid grid-cols-2 gap-4">
              <!-- 手動加入排隊 -->
              <button
                class="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-center"
                @click="addToQueue"
              >
                <PlusIcon class="w-6 h-6 text-gray-400 mx-auto mb-2" />
                <span class="text-sm font-medium text-gray-700"
                  >手動加入排隊</span
                >
              </button>

              <!-- 清理桌位 -->
              <button
                v-if="selectedTable && selectedTable.status === 'occupied'"
                class="p-4 bg-orange-100 rounded-lg hover:bg-orange-200 transition-colors text-center"
                @click="cleanTable(selectedTable)"
              >
                <SparklesIcon class="w-6 h-6 text-orange-600 mx-auto mb-2" />
                <span class="text-sm font-medium text-orange-800"
                  >清理桌位</span
                >
              </button>

              <!-- 叫號通知 -->
              <button
                class="p-4 bg-purple-100 rounded-lg hover:bg-purple-200 transition-colors text-center"
                @click="sendNotification"
              >
                <BellIcon class="w-6 h-6 text-purple-600 mx-auto mb-2" />
                <span class="text-sm font-medium text-purple-800"
                  >批量通知</span
                >
              </button>

              <!-- 統計報表 -->
              <button
                class="p-4 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-center"
                @click="generateReport"
              >
                <DocumentChartBarIcon
                  class="w-6 h-6 text-gray-600 mx-auto mb-2"
                />
                <span class="text-sm font-medium text-gray-800">統計報表</span>
              </button>
            </div>

            <!-- 自動分配控制 -->
            <div
              class="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg"
            >
              <div class="flex items-center justify-between mb-3">
                <h4 class="font-medium text-gray-900">智慧分配</h4>
                <label class="relative inline-flex items-center cursor-pointer">
                  <input
                    v-model="autoAssignment"
                    type="checkbox"
                    class="sr-only peer"
                    @change="toggleAutoAssignment"
                  />
                  <div
                    class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
                  ></div>
                </label>
              </div>
              <p class="text-sm text-gray-600">
                {{
                  autoAssignment ? "已開啟自動座位分配" : "已關閉自動座位分配"
                }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 手動加入排隊模態框 -->
    <div v-if="showAddDialog" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div
          class="fixed inset-0 bg-black opacity-30"
          @click="closeAddDialog"
        />
        <div class="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-semibold text-gray-900">加入排隊</h3>
            <button
              class="text-gray-400 hover:text-gray-600"
              @click="closeAddDialog"
            >
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2"
                >顧客姓名</label
              >
              <input
                v-model="newQueueItem.customerName"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="輸入顧客姓名（可選）"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2"
                >聯絡電話</label
              >
              <input
                v-model="newQueueItem.phoneNumber"
                type="tel"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="輸入聯絡電話"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2"
                >用餐人數</label
              >
              <select
                v-model.number="newQueueItem.partySize"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option v-for="n in 12" :key="n" :value="n">{{ n }} 人</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2"
                >桌位偏好</label
              >
              <select
                v-model="newQueueItem.tablePreference"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">無偏好</option>
                <option value="window">靠窗</option>
                <option value="corner">角落</option>
                <option value="center">中央區域</option>
                <option value="quiet">安靜區域</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2"
                >特殊需求</label
              >
              <textarea
                v-model="newQueueItem.specialRequests"
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="兒童座椅、輪椅通道等（可選）"
              />
            </div>

            <div>
              <label class="flex items-center">
                <input
                  v-model="newQueueItem.isVIP"
                  type="checkbox"
                  class="rounded border-gray-300 text-yellow-600 shadow-sm focus:border-yellow-300 focus:ring focus:ring-yellow-200 focus:ring-opacity-50"
                />
                <span class="ml-2 text-sm text-gray-700"
                  >VIP 顧客（優先處理）</span
                >
              </label>
            </div>
          </div>

          <div class="flex justify-end space-x-3 mt-6">
            <button
              class="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors"
              @click="closeAddDialog"
            >
              取消
            </button>
            <button
              :disabled="!canAddToQueue"
              class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              @click="submitAddToQueue"
            >
              加入排隊
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 安排座位模態框 -->
    <div v-if="showSeatDialog" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div
          class="fixed inset-0 bg-black opacity-30"
          @click="closeSeatDialog"
        />
        <div class="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-semibold text-gray-900">安排座位</h3>
            <button
              class="text-gray-400 hover:text-gray-600"
              @click="closeSeatDialog"
            >
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>

          <div v-if="selectedQueueItem" class="space-y-4">
            <!-- 顧客資訊 -->
            <div class="bg-gray-50 p-4 rounded-lg">
              <h4 class="font-medium text-gray-900 mb-2">顧客資訊</h4>
              <div class="text-sm space-y-1">
                <p>
                  <span class="text-gray-600">排號:</span>
                  {{ selectedQueueItem.queueNumber }}
                </p>
                <p>
                  <span class="text-gray-600">姓名:</span>
                  {{ selectedQueueItem.customerName || "未提供" }}
                </p>
                <p>
                  <span class="text-gray-600">人數:</span>
                  {{ selectedQueueItem.partySize }} 人
                </p>
                <p v-if="selectedQueueItem.tablePreference">
                  <span class="text-gray-600">偏好:</span>
                  {{ selectedQueueItem.tablePreference }}
                </p>
                <p>
                  <span class="text-gray-600">等待時間:</span>
                  {{ getWaitTime(selectedQueueItem.joinedAt) }} 分鐘
                </p>
              </div>
            </div>

            <!-- 推薦桌位 -->
            <div>
              <h4 class="font-medium text-gray-900 mb-3">推薦桌位</h4>
              <div class="grid grid-cols-2 gap-3">
                <div
                  v-for="table in recommendedTables"
                  :key="table.id"
                  :class="[
                    'p-3 border-2 rounded-lg cursor-pointer transition-all',
                    seatAssignment.tableId === table.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300',
                  ]"
                  @click="seatAssignment.tableId = table.id"
                >
                  <div class="text-center">
                    <div class="font-bold">桌號 {{ table.number }}</div>
                    <div class="text-sm text-gray-600">
                      {{ table.capacity }}人桌
                    </div>
                    <div class="text-xs text-green-600 mt-1">
                      適合度: {{ table.matchScore }}%
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 備註 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2"
                >服務備註</label
              >
              <textarea
                v-model="seatAssignment.notes"
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="座位安排備註..."
              />
            </div>
          </div>

          <div class="flex justify-end space-x-3 mt-6">
            <button
              class="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors"
              @click="closeSeatDialog"
            >
              取消
            </button>
            <button
              :disabled="!seatAssignment.tableId"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              @click="confirmSeatAssignment"
            >
              確認安排
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import {
  UsersIcon,
  ClockIcon,
  BuildingStorefrontIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  StarIcon,
  PlusIcon,
  SparklesIcon,
  BellIcon,
  XMarkIcon,
} from "@heroicons/vue/24/outline";
import DocumentChartBarIcon from "@heroicons/vue/24/outline/DocumentChartBarIcon";

// 型別定義
interface QueueItem {
  id: string;
  queueNumber: number;
  customerName: string | null;
  phoneNumber: string;
  partySize: number;
  tablePreference: string | null;
  specialRequests: string | null;
  priority: number;
  status: "waiting" | "called" | "seated" | "no_show" | "cancelled";
  joinedAt: string;
  calledAt: string | null;
  seatedAt: string | null;
  estimatedWaitTime: number;
  notes: string | null;
}

interface Table {
  id: string;
  number: string;
  capacity: number;
  status: "available" | "occupied" | "reserved" | "cleaning";
  occupiedSince: string | null;
  cleaningStatus: "clean" | "cleaning" | "dirty";
  matchScore?: number;
}

// 響應式狀態
const queueFilter = ref("");
const tableViewFilter = ref("all");
const selectedQueueItem = ref<QueueItem | null>(null);
const selectedTable = ref<Table | null>(null);
const showAddDialog = ref(false);
const showSeatDialog = ref(false);
const autoAssignment = ref(true);

// 統計數據
const currentWaiting = ref(8);
const avgWaitTime = ref(15);
const availableTables = ref(12);
const occupiedTables = ref(8);
const todayServed = ref(45);
const overdueQueue = ref(2);

// 表單數據
const newQueueItem = ref({
  customerName: "",
  phoneNumber: "",
  partySize: 2,
  tablePreference: "",
  specialRequests: "",
  isVIP: false,
});

const seatAssignment = ref({
  tableId: "",
  notes: "",
});

// 模擬排隊數據
const queueItems = ref<QueueItem[]>([
  {
    id: "queue_001",
    queueNumber: 1,
    customerName: "張先生",
    phoneNumber: "012-3456789",
    partySize: 4,
    tablePreference: "window",
    specialRequests: "需要兒童座椅",
    priority: 1,
    status: "called",
    joinedAt: new Date(Date.now() - 1800000).toISOString(), // 30分鐘前
    calledAt: new Date(Date.now() - 300000).toISOString(), // 5分鐘前
    seatedAt: null,
    estimatedWaitTime: 20,
    notes: "VIP顧客",
  },
  {
    id: "queue_002",
    queueNumber: 2,
    customerName: "李小姐",
    phoneNumber: "012-9876543",
    partySize: 2,
    tablePreference: "quiet",
    specialRequests: null,
    priority: 0,
    status: "waiting",
    joinedAt: new Date(Date.now() - 1200000).toISOString(), // 20分鐘前
    calledAt: null,
    seatedAt: null,
    estimatedWaitTime: 15,
    notes: null,
  },
  {
    id: "queue_003",
    queueNumber: 3,
    customerName: null,
    phoneNumber: "012-5555555",
    partySize: 6,
    tablePreference: null,
    specialRequests: "輪椅通道",
    priority: 0,
    status: "waiting",
    joinedAt: new Date(Date.now() - 900000).toISOString(), // 15分鐘前
    calledAt: null,
    seatedAt: null,
    estimatedWaitTime: 25,
    notes: null,
  },
]);

// 模擬桌位數據
const tables = ref<Table[]>([
  {
    id: "table_001",
    number: "T01",
    capacity: 2,
    status: "available",
    occupiedSince: null,
    cleaningStatus: "clean",
  },
  {
    id: "table_002",
    number: "T02",
    capacity: 2,
    status: "occupied",
    occupiedSince: new Date(Date.now() - 2700000).toISOString(),
    cleaningStatus: "clean",
  },
  {
    id: "table_003",
    number: "T03",
    capacity: 4,
    status: "available",
    occupiedSince: null,
    cleaningStatus: "clean",
  },
  {
    id: "table_004",
    number: "T04",
    capacity: 4,
    status: "cleaning",
    occupiedSince: null,
    cleaningStatus: "cleaning",
  },
  {
    id: "table_005",
    number: "T05",
    capacity: 6,
    status: "available",
    occupiedSince: null,
    cleaningStatus: "clean",
  },
  {
    id: "table_006",
    number: "T06",
    capacity: 6,
    status: "occupied",
    occupiedSince: new Date(Date.now() - 3600000).toISOString(),
    cleaningStatus: "clean",
  },
  {
    id: "table_007",
    number: "T07",
    capacity: 8,
    status: "available",
    occupiedSince: null,
    cleaningStatus: "clean",
  },
  {
    id: "table_008",
    number: "T08",
    capacity: 8,
    status: "reserved",
    occupiedSince: null,
    cleaningStatus: "clean",
  },
]);

// 計算屬性
const filteredQueue = computed(() => {
  let filtered = [...queueItems.value];

  if (queueFilter.value) {
    filtered = filtered.filter((item) => item.status === queueFilter.value);
  }

  return filtered.sort((a, b) => {
    // 優先級排序，然後按加入時間
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
  });
});

const filteredTables = computed(() => {
  if (tableViewFilter.value === "all") {
    return tables.value;
  }

  const statusMap: Record<string, string[]> = {
    available: ["available"],
    occupied: ["occupied", "reserved"],
  };

  return tables.value.filter((table) =>
    statusMap[tableViewFilter.value]?.includes(table.status),
  );
});

const recommendedTables = computed(() => {
  if (!selectedQueueItem.value) return [];

  const availableTables = tables.value.filter(
    (table) => table.status === "available",
  );
  const partySize = selectedQueueItem.value.partySize;

  return availableTables
    .map((table) => {
      let score = 100;

      // 容量匹配度
      if (table.capacity === partySize) {
        score += 20;
      } else if (table.capacity === partySize + 1) {
        score += 10;
      } else if (table.capacity < partySize) {
        score -= 50;
      } else if (table.capacity > partySize + 2) {
        score -= 10;
      }

      // 偏好匹配（簡化處理）
      if (selectedQueueItem.value?.tablePreference) {
        if (table.number.includes("1") || table.number.includes("2")) {
          // 假設靠窗
          if (selectedQueueItem.value.tablePreference === "window") score += 15;
        }
      }

      return { ...table, matchScore: Math.max(0, Math.min(100, score)) };
    })
    .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
    .slice(0, 4);
});

const canAddToQueue = computed(() => {
  return newQueueItem.value.phoneNumber && newQueueItem.value.partySize > 0;
});

// 工具方法
const formatTime = (dateTime: string) =>
  new Date(dateTime).toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
  });

const getWaitTime = (joinedAt: string) => {
  const now = new Date();
  const joined = new Date(joinedAt);
  return Math.floor((now.getTime() - joined.getTime()) / (1000 * 60));
};

const getOccupiedTime = (occupiedSince: string) => {
  const now = new Date();
  const occupied = new Date(occupiedSince);
  return Math.floor((now.getTime() - occupied.getTime()) / (1000 * 60));
};

const calculateEstimatedWait = (queueIndex: number) => {
  return (queueIndex + 1) * avgWaitTime.value;
};

// 狀態樣式方法
const getQueueNumberColor = (status: string) => {
  const colors: Record<string, string> = {
    waiting: "bg-blue-100 text-blue-800",
    called: "bg-yellow-100 text-yellow-800",
    seated: "bg-green-100 text-green-800",
    no_show: "bg-red-100 text-red-800",
    cancelled: "bg-gray-100 text-gray-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
};

const getStatusClass = (status: string) => {
  const classes: Record<string, string> = {
    waiting: "bg-blue-100 text-blue-800",
    called: "bg-yellow-100 text-yellow-800",
    seated: "bg-green-100 text-green-800",
    no_show: "bg-red-100 text-red-800",
    cancelled: "bg-gray-100 text-gray-800",
  };
  return classes[status] || "bg-gray-100 text-gray-800";
};

const getStatusText = (status: string) => {
  const texts: Record<string, string> = {
    waiting: "候位中",
    called: "已叫號",
    seated: "已入座",
    no_show: "未到場",
    cancelled: "已取消",
  };
  return texts[status] || status;
};

const getTableStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    available: "border-green-200 bg-green-50",
    occupied: "border-red-200 bg-red-50",
    reserved: "border-yellow-200 bg-yellow-50",
    cleaning: "border-orange-200 bg-orange-50",
  };
  return colors[status] || "border-gray-200 bg-gray-50";
};

const getTableStatusTextColor = (status: string) => {
  const colors: Record<string, string> = {
    available: "bg-green-100 text-green-800",
    occupied: "bg-red-100 text-red-800",
    reserved: "bg-yellow-100 text-yellow-800",
    cleaning: "bg-orange-100 text-orange-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
};

const getTableStatusText = (status: string) => {
  const texts: Record<string, string> = {
    available: "可用",
    occupied: "使用中",
    reserved: "已預約",
    cleaning: "清潔中",
  };
  return texts[status] || status;
};

// 操作方法
const selectQueueItem = (item: QueueItem) => {
  selectedQueueItem.value = item;
};

const selectTable = (table: Table) => {
  selectedTable.value = table;
};

const toggleTableView = (filter: string) => {
  tableViewFilter.value = filter;
};

const refreshQueue = async () => {
  console.log("Refreshing queue...");
};

const callNextCustomer = () => {
  const nextCustomer = queueItems.value.find(
    (item) => item.status === "waiting",
  );
  if (nextCustomer) {
    callCustomer(nextCustomer);
  } else {
    alert("目前沒有等待中的顧客");
  }
};

const callCustomer = async (queueItem: QueueItem) => {
  try {
    queueItem.status = "called";
    queueItem.calledAt = new Date().toISOString();
    alert(
      `已呼叫 ${queueItem.customerName || `排號 ${queueItem.queueNumber}`}`,
    );
  } catch (error) {
    alert("呼叫失敗，請重試");
  }
};

const seatCustomer = (queueItem: QueueItem) => {
  selectedQueueItem.value = queueItem;
  showSeatDialog.value = true;
  seatAssignment.value = { tableId: "", notes: "" };
};

const addToQueue = () => {
  showAddDialog.value = true;
  newQueueItem.value = {
    customerName: "",
    phoneNumber: "",
    partySize: 2,
    tablePreference: "",
    specialRequests: "",
    isVIP: false,
  };
};

const closeAddDialog = () => {
  showAddDialog.value = false;
};

const submitAddToQueue = async () => {
  if (!canAddToQueue.value) return;

  try {
    const nextNumber =
      Math.max(...queueItems.value.map((item) => item.queueNumber)) + 1;

    const newItem: QueueItem = {
      id: `queue_${Date.now()}`,
      queueNumber: nextNumber,
      customerName: newQueueItem.value.customerName || null,
      phoneNumber: newQueueItem.value.phoneNumber,
      partySize: newQueueItem.value.partySize,
      tablePreference: newQueueItem.value.tablePreference || null,
      specialRequests: newQueueItem.value.specialRequests || null,
      priority: newQueueItem.value.isVIP ? 1 : 0,
      status: "waiting",
      joinedAt: new Date().toISOString(),
      calledAt: null,
      seatedAt: null,
      estimatedWaitTime: avgWaitTime.value,
      notes: newQueueItem.value.isVIP ? "VIP顧客" : null,
    };

    queueItems.value.push(newItem);
    closeAddDialog();

    alert(`已加入排隊！排號: ${nextNumber}`);
  } catch (error) {
    alert("加入排隊失敗，請重試");
  }
};

const closeSeatDialog = () => {
  showSeatDialog.value = false;
  selectedQueueItem.value = null;
};

const confirmSeatAssignment = async () => {
  if (!selectedQueueItem.value || !seatAssignment.value.tableId) return;

  try {
    // 更新排隊狀態
    selectedQueueItem.value.status = "seated";
    selectedQueueItem.value.seatedAt = new Date().toISOString();

    // 更新桌位狀態
    const table = tables.value.find(
      (t) => t.id === seatAssignment.value.tableId,
    );
    if (table) {
      table.status = "occupied";
      table.occupiedSince = new Date().toISOString();
    }

    closeSeatDialog();
    alert("座位安排完成！");
  } catch (error) {
    alert("座位安排失敗，請重試");
  }
};

const editQueueItem = (queueItem: QueueItem) => {
  console.log("Edit queue item:", queueItem.id);
  alert("編輯功能開發中...");
};

const cleanTable = async (table: Table) => {
  try {
    table.status = "cleaning";
    table.cleaningStatus = "cleaning";
    table.occupiedSince = null;

    // 模擬清潔時間
    setTimeout(() => {
      table.status = "available";
      table.cleaningStatus = "clean";
      alert(`桌號 ${table.number} 清潔完成，可接受新顧客`);
    }, 3000);

    alert(`開始清潔桌號 ${table.number}`);
  } catch (error) {
    alert("清潔操作失敗");
  }
};

const sendNotification = () => {
  alert("批量通知功能開發中...");
};

const generateReport = () => {
  alert("統計報表功能開發中...");
};

const toggleAutoAssignment = () => {
  console.log("Auto assignment:", autoAssignment.value);
  if (autoAssignment.value) {
    alert("已開啟智慧分配功能");
  } else {
    alert("已關閉智慧分配功能");
  }
};

const openQueueSettings = () => {
  alert("排隊設定功能開發中...");
};

const openDisplaySettings = () => {
  alert("顯示設定功能開發中...");
};

// 生命週期
onMounted(async () => {
  // 初始化時選擇第一個排隊項目
  if (queueItems.value.length > 0) {
    selectedQueueItem.value = queueItems.value[0];
  }

  // 自動刷新數據
  setInterval(() => {
    // 更新統計數據
  }, 30000); // 每30秒更新一次
});
</script>

<style scoped>
.queue-view {
  padding: 1.5rem;
  min-height: 100vh;
  background-color: #f9fafb;
}

@media (max-width: 640px) {
  .queue-view {
    padding: 1rem;
  }
}

/* 自定義滾動條 */
.queue-view ::-webkit-scrollbar {
  width: 6px;
}

.queue-view ::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.queue-view ::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.queue-view ::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>
