<template>
  <div class="group-orders-view">
    <!-- 標題區域 -->
    <div
      class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8"
    >
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-gray-900">
          {{ t("groupOrders.title") }}
        </h1>
        <p class="text-gray-600 text-sm sm:text-base">
          {{ t("groupOrders.subtitle") }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <!-- 即時統計 -->
        <div class="bg-blue-100 px-3 py-2 rounded-lg">
          <p class="text-sm text-blue-800 font-medium whitespace-nowrap">
            {{ t("groupOrders.activeOrders") }}: {{ activeGroupOrders }}
          </p>
          <p class="text-xs text-blue-600 whitespace-nowrap">
            {{ t("groupOrders.todayTotal") }}: {{ todayGroupOrders }}
          </p>
        </div>

        <!-- 功能按鈕 -->
        <button
          class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm whitespace-nowrap"
          @click="createGroupOrder"
        >
          {{ t("groupOrders.createOrder") }}
        </button>

        <button
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm whitespace-nowrap"
          @click="generateShareCode"
        >
          {{ t("groupOrders.generateShareCode") }}
        </button>
      </div>
    </div>

    <!-- 統計卡片 -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-8">
      <div class="bg-white rounded-lg shadow p-3 sm:p-6">
        <div class="flex items-center gap-3">
          <div class="p-2 sm:p-3 rounded-full bg-green-100 flex-shrink-0">
            <UserGroupIcon class="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
          </div>
          <div class="min-w-0">
            <p class="text-xs sm:text-sm font-medium text-gray-500 truncate">
              {{ t("groupOrders.activeOrders") }}
            </p>
            <p class="text-xl sm:text-2xl font-semibold text-gray-900">
              {{ activeGroupOrders }}
            </p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow p-3 sm:p-6">
        <div class="flex items-center gap-3">
          <div class="p-2 sm:p-3 rounded-full bg-blue-100 flex-shrink-0">
            <ShareIcon class="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
          </div>
          <div class="min-w-0">
            <p class="text-xs sm:text-sm font-medium text-gray-500 truncate">
              {{ t("groupOrders.shareCount") }}
            </p>
            <p class="text-xl sm:text-2xl font-semibold text-gray-900">
              {{ totalShares }}
            </p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow p-3 sm:p-6">
        <div class="flex items-center gap-3">
          <div class="p-2 sm:p-3 rounded-full bg-purple-100 flex-shrink-0">
            <CreditCardIcon class="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
          </div>
          <div class="min-w-0">
            <p class="text-xs sm:text-sm font-medium text-gray-500 truncate">
              {{ t("groupOrders.splitBillOrders") }}
            </p>
            <p class="text-xl sm:text-2xl font-semibold text-gray-900">
              {{ splitBillOrders }}
            </p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow p-3 sm:p-6">
        <div class="flex items-center gap-3">
          <div class="p-2 sm:p-3 rounded-full bg-yellow-100 flex-shrink-0">
            <ClockIcon class="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600" />
          </div>
          <div class="min-w-0">
            <p class="text-xs sm:text-sm font-medium text-gray-500 truncate">
              {{ t("groupOrders.avgCompletionTime") }}
            </p>
            <p class="text-xl sm:text-2xl font-semibold text-gray-900">
              {{ avgCompletionTime }}{{ t("groupOrders.minutes") }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- 主要內容區域 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
      <!-- 左側：整體團體訂單列表 -->
      <div class="lg:col-span-2">
        <div class="bg-white rounded-lg shadow">
          <div class="p-4 sm:p-6 border-b border-gray-200">
            <div
              class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <h2 class="text-lg sm:text-xl font-semibold text-gray-900">
                {{ t("groupOrders.orderList") }}
              </h2>
              <div class="flex flex-wrap items-center gap-2 sm:gap-4">
                <!-- 搜尋篩選 -->
                <div class="relative flex-1 min-w-[160px]">
                  <MagnifyingGlassIcon
                    class="absolute left-3 top-3 h-4 w-4 text-gray-400"
                  />
                  <input
                    v-model="searchQuery"
                    type="text"
                    :placeholder="t('groupOrders.searchPlaceholder')"
                    class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  />
                </div>

                <select
                  v-model="statusFilter"
                  class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="">{{ t("groupOrders.allStatus") }}</option>
                  <option value="active">
                    {{ t("groupOrders.status.active") }}
                  </option>
                  <option value="ready_to_pay">
                    {{ t("groupOrders.status.readyToPay") }}
                  </option>
                  <option value="completed">
                    {{ t("groupOrders.status.completed") }}
                  </option>
                  <option value="cancelled">
                    {{ t("groupOrders.status.cancelled") }}
                  </option>
                </select>

                <button
                  class="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex-shrink-0"
                  @click="refreshGroupOrders"
                >
                  <ArrowPathIcon class="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>

          <div class="divide-y divide-gray-200">
            <div
              v-for="groupOrder in filteredGroupOrders"
              :key="groupOrder.id"
              class="p-4 sm:p-6 hover:bg-gray-50 cursor-pointer transition-colors"
              @click="selectGroupOrder(groupOrder)"
            >
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <!-- 訂單基本信息 -->
                  <div class="flex items-center mb-3">
                    <div class="flex-shrink-0">
                      <div
                        class="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center"
                      >
                        <UserGroupIcon class="w-6 h-6 text-white" />
                      </div>
                    </div>
                    <div class="ml-4">
                      <div class="flex items-center">
                        <h3 class="text-lg font-medium text-gray-900">
                          {{ groupOrder.shareCode }}
                        </h3>
                        <span
                          :class="getStatusClass(groupOrder.status)"
                          class="ml-2 px-2 py-1 text-xs font-medium rounded-full"
                        >
                          {{ getStatusText(groupOrder.status) }}
                        </span>
                      </div>
                      <div class="flex items-center mt-1 text-sm text-gray-500">
                        <MapPinIcon class="w-4 h-4 mr-1" />
                        <span>{{
                          groupOrder.tableNumber
                            ? t("groupOrders.tableNumber", {
                                number: groupOrder.tableNumber,
                              })
                            : t("groupOrders.takeaway")
                        }}</span>
                        <span class="mx-2">·</span>
                        <ClockIcon class="w-4 h-4 mr-1" />
                        <span>{{ formatDateTime(groupOrder.createdAt) }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- 成員與金額信息 -->
                  <div class="grid grid-cols-2 gap-4 mb-4">
                    <div class="bg-blue-50 p-3 rounded-lg">
                      <p class="text-sm text-blue-800 font-medium">
                        {{ t("groupOrders.members") }}
                      </p>
                      <div class="flex items-center mt-1">
                        <span class="text-2xl font-bold text-blue-900">{{
                          groupOrder.memberCount
                        }}</span>
                        <span class="text-sm text-blue-600 ml-2">{{
                          t("groupOrders.people")
                        }}</span>
                      </div>
                      <div class="text-xs text-blue-600 mt-1">
                        {{ t("groupOrders.host") }}: {{ groupOrder.hostName }}
                      </div>
                    </div>

                    <div class="bg-green-50 p-3 rounded-lg">
                      <p class="text-sm text-green-800 font-medium">
                        {{ t("groupOrders.orderTotal") }}
                      </p>
                      <div class="flex items-center mt-1">
                        <span class="text-2xl font-bold text-green-900">{{
                          formatPrice(groupOrder.totalAmount)
                        }}</span>
                      </div>
                      <div class="text-xs text-green-600 mt-1">
                        {{ groupOrder.itemCount }} {{ t("groupOrders.items") }}
                      </div>
                    </div>
                  </div>

                  <!-- 付款狀態 -->
                  <div class="flex items-center justify-between">
                    <div class="flex items-center">
                      <!-- 成員頭像 -->
                      <div class="flex -space-x-2">
                        <div
                          v-for="(member, index) in groupOrder.members.slice(
                            0,
                            4,
                          )"
                          :key="member.id"
                          :class="[
                            'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2 border-white',
                            getMemberColor(index),
                          ]"
                          :title="member.name || ''"
                        >
                          {{ (member.name || "?").charAt(0) }}
                        </div>
                        <div
                          v-if="groupOrder.members.length > 4"
                          class="w-8 h-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-xs font-medium text-gray-600"
                        >
                          +{{ groupOrder.members.length - 4 }}
                        </div>
                      </div>
                    </div>

                    <!-- 付款信息 -->
                    <div class="text-right">
                      <div class="flex items-center text-sm">
                        <span class="text-gray-500">{{
                          t("groupOrders.paid")
                        }}</span>
                        <span class="ml-1 font-medium"
                          >{{ groupOrder.paidMembers }}/{{
                            groupOrder.memberCount
                          }}</span
                        >
                      </div>
                      <div class="w-32 bg-gray-200 rounded-full h-2 mt-1">
                        <div
                          class="bg-green-600 h-2 rounded-full transition-all duration-300"
                          :style="{
                            width: `${(groupOrder.paidMembers / groupOrder.memberCount) * 100}%`,
                          }"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 操作按鈕 -->
                <div class="flex flex-col space-y-2 ml-6">
                  <button
                    v-if="groupOrder.status === 'active'"
                    class="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
                    @click.stop="shareGroupOrder(groupOrder)"
                  >
                    {{ t("groupOrders.share") }}
                  </button>

                  <button
                    v-if="groupOrder.status === 'ready_to_pay'"
                    class="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
                    @click.stop="processSplitBill(groupOrder)"
                  >
                    {{ t("groupOrders.splitBill") }}
                  </button>

                  <button
                    class="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 transition-colors"
                    @click.stop="selectGroupOrder(groupOrder)"
                  >
                    {{ t("groupOrders.details") }}
                  </button>
                </div>
              </div>
            </div>

            <!-- 空狀態 -->
            <div
              v-if="filteredGroupOrders.length === 0"
              class="p-12 text-center"
            >
              <UserGroupIcon class="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 class="text-lg font-medium text-gray-900 mb-2">
                {{ t("groupOrders.noOrders") }}
              </h3>
              <p class="text-gray-500">{{ t("groupOrders.noOrdersHint") }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 右側：詳細信息面板 -->
      <div class="space-y-6">
        <!-- 選中訂單詳情 -->
        <div class="bg-white rounded-lg shadow">
          <div class="p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">
              {{
                selectedGroupOrder
                  ? t("groupOrders.orderDetails")
                  : t("groupOrders.selectOrder")
              }}
            </h3>

            <div v-if="selectedGroupOrder">
              <!-- 基本信息 -->
              <div class="mb-6">
                <div class="flex items-center justify-between mb-4">
                  <h4 class="font-medium text-gray-900">
                    {{ selectedGroupOrder.shareCode }}
                  </h4>
                  <div class="flex items-center space-x-2">
                    <button
                      class="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                      :title="t('groupOrders.copyShareCode')"
                      @click="copyShareCode(selectedGroupOrder.shareCode)"
                    >
                      <DocumentDuplicateIcon class="w-4 h-4" />
                    </button>
                    <button
                      class="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
                      :title="t('groupOrders.generateQR')"
                      @click="shareGroupOrder(selectedGroupOrder!)"
                    >
                      <QrCodeIcon class="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-3 text-sm">
                  <div class="flex justify-between">
                    <span class="text-gray-600"
                      >{{ t("groupOrders.statusLabel") }}:</span
                    >
                    <span
                      :class="getStatusClass(selectedGroupOrder.status)"
                      class="px-2 py-1 text-xs font-medium rounded-full"
                    >
                      {{ getStatusText(selectedGroupOrder.status) }}
                    </span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600"
                      >{{ t("groupOrders.tableLabel") }}:</span
                    >
                    <span>{{
                      selectedGroupOrder.tableNumber ||
                      t("groupOrders.takeaway")
                    }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600"
                      >{{ t("groupOrders.createdTime") }}:</span
                    >
                    <span>{{ formatTime(selectedGroupOrder.createdAt) }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600"
                      >{{ t("groupOrders.hostLabel") }}:</span
                    >
                    <span>{{ selectedGroupOrder.hostName }}</span>
                  </div>
                </div>
              </div>

              <!-- 成員列表 -->
              <div class="mb-6">
                <h5 class="font-medium text-gray-900 mb-3">
                  {{ t("groupOrders.members") }} ({{
                    selectedGroupOrder.members.length
                  }})
                </h5>
                <div class="space-y-2">
                  <div
                    v-for="(member, index) in selectedGroupOrder.members"
                    :key="member.id"
                    class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div class="flex items-center">
                      <div
                        :class="[
                          'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                          getMemberColor(index),
                        ]"
                      >
                        {{ (member.name || "?").charAt(0) }}
                      </div>
                      <div class="ml-3">
                        <p class="text-sm font-medium text-gray-900">
                          {{ member.name || "" }}
                        </p>
                        <p class="text-xs text-gray-500">
                          {{ member.itemCount }}
                          {{ t("groupOrders.items") }}・{{
                            formatPrice(member.totalAmount)
                          }}
                        </p>
                      </div>
                    </div>

                    <div class="flex items-center">
                      <span
                        :class="[
                          'px-2 py-1 text-xs font-medium rounded-full',
                          member.paymentStatus === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : member.paymentStatus === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800',
                        ]"
                      >
                        {{ getPaymentStatusText(member.paymentStatus) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 訂單金額 -->
              <div class="border-t border-gray-200 pt-4">
                <div class="space-y-2 text-sm">
                  <div class="flex justify-between">
                    <span class="text-gray-600"
                      >{{ t("groupOrders.subtotal") }}:</span
                    >
                    <span>{{ formatPrice(selectedGroupOrder.subtotal) }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600"
                      >{{ t("groupOrders.serviceCharge") }}:</span
                    >
                    <span>{{
                      formatPrice(selectedGroupOrder.serviceCharge)
                    }}</span>
                  </div>
                  <div class="flex justify-between">
                    <span class="text-gray-600"
                      >{{ t("groupOrders.tax") }}:</span
                    >
                    <span>{{ formatPrice(selectedGroupOrder.taxAmount) }}</span>
                  </div>
                  <div
                    class="flex justify-between font-bold text-lg pt-2 border-t border-gray-200"
                  >
                    <span>{{ t("groupOrders.total") }}:</span>
                    <span class="text-green-600">{{
                      formatPrice(selectedGroupOrder.totalAmount)
                    }}</span>
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="text-center py-8">
              <CursorArrowRaysIcon
                class="mx-auto h-12 w-12 text-gray-400 mb-2"
              />
              <p class="text-gray-500">
                {{ t("groupOrders.selectOrderHint") }}
              </p>
            </div>
          </div>
        </div>

        <!-- 快速操作 -->
        <div class="bg-white rounded-lg shadow">
          <div class="p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">
              {{ t("groupOrders.quickActions") }}
            </h3>

            <div class="space-y-3">
              <button
                class="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                @click="createGroupOrder"
              >
                {{ t("groupOrders.createOrder") }}
              </button>

              <button
                class="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                @click="joinGroupOrder"
              >
                {{ t("groupOrders.joinOrder") }}
              </button>

              <button
                class="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                @click="generateShareCode"
              >
                {{ t("groupOrders.generateShareCode") }}
              </button>

              <button
                class="w-full py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                @click="exportGroupOrderReport"
              >
                {{ t("groupOrders.exportReport") }}
              </button>
            </div>
          </div>
        </div>

        <!-- 統計圖表 -->
        <div class="bg-white rounded-lg shadow">
          <div class="p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">
              {{ t("groupOrders.usageStats") }}
            </h3>

            <div class="space-y-4">
              <!-- 每日訂單數量 -->
              <div>
                <div class="flex justify-between text-sm mb-2">
                  <span class="text-gray-600">{{
                    t("groupOrders.todayOrders")
                  }}</span>
                  <span class="font-medium">{{ todayGroupOrders }}</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                  <div
                    class="bg-blue-600 h-2 rounded-full"
                    :style="{
                      width: `${Math.min(todayGroupOrders * 5, 100)}%`,
                    }"
                  />
                </div>
              </div>

              <!-- 平均成員數 -->
              <div>
                <div class="flex justify-between text-sm mb-2">
                  <span class="text-gray-600">{{
                    t("groupOrders.avgMembers")
                  }}</span>
                  <span class="font-medium"
                    >{{ avgGroupSize.toFixed(1)
                    }}{{ t("groupOrders.people") }}</span
                  >
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                  <div
                    class="bg-green-600 h-2 rounded-full"
                    :style="{ width: `${Math.min(avgGroupSize * 10, 100)}%` }"
                  />
                </div>
              </div>

              <!-- 分帳完成率 -->
              <div>
                <div class="flex justify-between text-sm mb-2">
                  <span class="text-gray-600">{{
                    t("groupOrders.splitBillRate")
                  }}</span>
                  <span class="font-medium">{{ completionRate }}%</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                  <div
                    class="bg-purple-600 h-2 rounded-full"
                    :style="{ width: `${completionRate}%` }"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 建立訂單模態框 -->
    <div v-if="showCreateDialog" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div
          class="fixed inset-0 bg-black opacity-30"
          @click="closeCreateDialog"
        />
        <div class="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-semibold text-gray-900">
              {{ t("groupOrders.createOrder") }}
            </h3>
            <button
              class="text-gray-400 hover:text-gray-600"
              @click="closeCreateDialog"
            >
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">{{
                t("groupOrders.tableNumberLabel")
              }}</label>
              <input
                v-model="newGroupOrder.tableNumber"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                :placeholder="t('groupOrders.tableNumberPlaceholder')"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">{{
                t("groupOrders.hostNameLabel")
              }}</label>
              <input
                v-model="newGroupOrder.hostName"
                type="text"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                :placeholder="t('groupOrders.hostNamePlaceholder')"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">{{
                t("groupOrders.expectedMembers")
              }}</label>
              <input
                v-model.number="newGroupOrder.expectedMembers"
                type="number"
                min="2"
                max="20"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                :placeholder="t('groupOrders.expectedMembersPlaceholder')"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">{{
                t("groupOrders.notesLabel")
              }}</label>
              <textarea
                v-model="newGroupOrder.notes"
                rows="3"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                :placeholder="t('groupOrders.notesPlaceholder')"
              />
            </div>
          </div>

          <div class="flex justify-end space-x-3 mt-6">
            <button
              class="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 transition-colors"
              @click="closeCreateDialog"
            >
              {{ t("groupOrders.cancel") }}
            </button>
            <button
              :disabled="!canCreateGroupOrder"
              class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              @click="submitCreateGroupOrder"
            >
              {{ t("groupOrders.createOrderBtn") }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 加入訂單模態框 -->
    <div v-if="showJoinDialog" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div
          class="fixed inset-0 bg-black opacity-30"
          @click="showJoinDialog = false"
        />
        <div class="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-semibold text-gray-900">
              {{ t("groupOrders.joinOrder") }}
            </h3>
            <button
              class="text-gray-400 hover:text-gray-600"
              @click="showJoinDialog = false"
            >
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">{{
                t("groupOrders.shareCode")
              }}</label>
              <input
                v-model="joinShareCode"
                type="text"
                :placeholder="t('groupOrders.prompts.enterShareCode')"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                @keyup.enter="submitJoinGroupOrder"
              />
            </div>
          </div>
          <div class="flex justify-end space-x-3 mt-6">
            <button
              class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              @click="showJoinDialog = false"
            >
              {{ t("groupOrders.cancel") }}
            </button>
            <button
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              :disabled="!joinShareCode.trim()"
              @click="submitJoinGroupOrder"
            >
              {{ t("groupOrders.joinOrder") }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 分享模態框 -->
    <div v-if="showShareDialog" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div
          class="fixed inset-0 bg-black opacity-30"
          @click="closeShareDialog"
        />
        <div class="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-semibold text-gray-900">
              {{ t("groupOrders.shareOrder") }}
            </h3>
            <button
              class="text-gray-400 hover:text-gray-600"
              @click="closeShareDialog"
            >
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>

          <div class="text-center space-y-6">
            <!-- QR 碼區域 -->
            <div class="bg-gray-100 p-8 rounded-lg">
              <div
                class="w-48 h-48 mx-auto bg-white rounded-lg flex items-center justify-center"
              >
                <!-- QR 碼會在這裡顯示 -->
                <QrCodeIcon class="w-24 h-24 text-gray-400" />
              </div>
            </div>

            <!-- 分享資訊 -->
            <div>
              <p class="text-sm text-gray-600 mb-2">
                {{ t("groupOrders.shareCode") }}
              </p>
              <div class="flex items-center space-x-2">
                <input
                  :value="shareData.shareCode"
                  readonly
                  class="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                />
                <button
                  class="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  @click="copyShareCode(shareData.shareCode)"
                >
                  {{ t("groupOrders.copy") }}
                </button>
              </div>
            </div>

            <!-- 分享連結 -->
            <div>
              <p class="text-sm text-gray-600 mb-2">
                {{ t("groupOrders.shareLink") }}
              </p>
              <div class="flex items-center space-x-2">
                <input
                  :value="shareData.shareUrl"
                  readonly
                  class="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-xs"
                />
                <button
                  class="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  @click="copyShareUrl"
                >
                  {{ t("groupOrders.copy") }}
                </button>
              </div>
            </div>

            <!-- 分享按鈕 -->
            <div class="grid grid-cols-2 gap-3">
              <button
                class="py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                @click="shareToWhatsApp"
              >
                WhatsApp
              </button>
              <button
                class="py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                @click="shareToWechat"
              >
                {{ t("groupOrders.wechat") }}
              </button>
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
  UserGroupIcon,
  CreditCardIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  MapPinIcon,
  DocumentDuplicateIcon,
  CursorArrowRaysIcon,
  XMarkIcon,
} from "@heroicons/vue/24/outline";
import QrCodeIcon from "@heroicons/vue/24/outline/QrCodeIcon";
import ShareIcon from "@heroicons/vue/24/outline/ShareIcon";
import { useI18n } from "@/i18n";
import { useCurrency } from "@/composables/useCurrency";
import { useAuthStore } from "@/stores/auth";
import { groupOrdersService } from "@/services/groupOrdersService";

const { t } = useI18n();
const { formatPrice } = useCurrency();
const authStore = useAuthStore();

// 類別定義
interface GroupOrderMember {
  id: string;
  name: string;
  itemCount: number;
  totalAmount: number;
  paymentStatus: "unpaid" | "pending" | "paid";
  joinedAt: string;
}

interface GroupOrder {
  id: string;
  shareCode: string;
  masterOrderId: string | null;
  tableNumber: string | null;
  status: "active" | "ready_to_pay" | "completed" | "cancelled";
  hostName: string;
  memberCount: number;
  paidMembers: number;
  totalAmount: number;
  subtotal: number;
  serviceCharge: number;
  taxAmount: number;
  itemCount: number;
  members: GroupOrderMember[];
  createdAt: string;
  completedAt: string | null;
  expiresAt: string;
}

// 響應式狀態
const searchQuery = ref("");
const statusFilter = ref("");
const selectedGroupOrder = ref<GroupOrder | null>(null);
const showCreateDialog = ref(false);
const showShareDialog = ref(false);
const showJoinDialog = ref(false);
const joinShareCode = ref("");

// 統計數據 - populated from API
const activeGroupOrders = ref(0);
const todayGroupOrders = ref(0);
const totalShares = ref(0);
const splitBillOrders = ref(0);
const avgCompletionTime = ref(0);
const avgGroupSize = ref(0);
const completionRate = ref(0);

// 表單數據
const newGroupOrder = ref({
  tableNumber: "",
  hostName: "",
  expectedMembers: 2,
  notes: "",
});

const shareData = ref({
  shareCode: "",
  shareUrl: "",
});

// 團體訂單數據 - fetched from API
const groupOrders = ref<GroupOrder[]>([]);

// 計算屬性
const filteredGroupOrders = computed(() => {
  let filtered = [...groupOrders.value];

  // 狀態篩選
  if (statusFilter.value) {
    filtered = filtered.filter((order) => order.status === statusFilter.value);
  }

  // 搜尋篩選
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(
      (order) =>
        order.shareCode.toLowerCase().includes(query) ||
        order.tableNumber?.toLowerCase().includes(query) ||
        order.hostName.toLowerCase().includes(query),
    );
  }

  return filtered;
});

const canCreateGroupOrder = computed(() => {
  return (
    newGroupOrder.value.hostName && newGroupOrder.value.expectedMembers >= 2
  );
});

// 工具函數
const formatTime = (dateTime: string) =>
  new Date(dateTime).toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
  });
const formatDateTime = (dateTime: string) =>
  new Date(dateTime).toLocaleString("zh-TW");

const getStatusClass = (status: string) => {
  const classes: Record<string, string> = {
    active: "bg-blue-100 text-blue-800",
    ready_to_pay: "bg-green-100 text-green-800",
    completed: "bg-gray-100 text-gray-800",
    cancelled: "bg-red-100 text-red-800",
  };
  return classes[status] || "bg-gray-100 text-gray-800";
};

const getStatusText = (status: string) => {
  const texts: Record<string, string> = {
    active: t("groupOrders.status.active"),
    ready_to_pay: t("groupOrders.status.readyToPay"),
    completed: t("groupOrders.status.completed"),
    cancelled: t("groupOrders.status.cancelled"),
  };
  return texts[status] || status;
};

const getPaymentStatusText = (status: string) => {
  const texts: Record<string, string> = {
    unpaid: t("groupOrders.paymentStatus.unpaid"),
    pending: t("groupOrders.paymentStatus.pending"),
    paid: t("groupOrders.paymentStatus.paid"),
  };
  return texts[status] || status;
};

const getMemberColor = (index: number) => {
  const colors = [
    "bg-blue-500 text-white",
    "bg-green-500 text-white",
    "bg-purple-500 text-white",
    "bg-orange-500 text-white",
    "bg-pink-500 text-white",
    "bg-indigo-500 text-white",
  ];
  return colors[index % colors.length];
};

// 操作函數
const selectGroupOrder = (groupOrder: GroupOrder) => {
  selectedGroupOrder.value = groupOrder;
};

const refreshGroupOrders = async () => {
  try {
    const restaurantId = authStore.restaurantId ?? undefined;
    const [ordersData, statsData] = await Promise.all([
      groupOrdersService.getGroupOrders({ restaurantId }),
      groupOrdersService.getGroupOrderStats({ restaurantId }),
    ]);

    groupOrders.value = (ordersData as any[]).map((o: any) => ({
      ...o,
      members: (o.members || []).map((m: any) => ({
        ...m,
        name: m.name || m.memberName || "",
      })),
      paidMembers:
        o.paidMembers ??
        o.members?.filter((m: any) => m.paymentStatus === "paid").length ??
        0,
    })) as GroupOrder[];

    activeGroupOrders.value = statsData.activeGroupOrders ?? 0;
    todayGroupOrders.value = statsData.totalGroupOrders ?? 0;
    totalShares.value = statsData.totalGroupOrders ?? 0;
    splitBillOrders.value = 0; // Derived from orders if needed
    avgCompletionTime.value = 0; // Derived from stats if available
    avgGroupSize.value = statsData.averageGroupSize ?? 0;
    completionRate.value = statsData.conversionRate ?? 0;

    // Update selected order with fresh data
    if (selectedGroupOrder.value) {
      const updated = groupOrders.value.find(
        (o) => o.id === selectedGroupOrder.value!.id,
      );
      if (updated) {
        selectedGroupOrder.value = updated;
      }
    }
  } catch (err) {
    console.error("Failed to refresh group orders:", err);
  }
};

const createGroupOrder = () => {
  showCreateDialog.value = true;
  newGroupOrder.value = {
    tableNumber: "",
    hostName: "",
    expectedMembers: 2,
    notes: "",
  };
};

const closeCreateDialog = () => {
  showCreateDialog.value = false;
};

const submitCreateGroupOrder = async () => {
  if (!canCreateGroupOrder.value) return;

  try {
    const restaurantId = authStore.restaurantId;
    if (!restaurantId) return;

    const created = await groupOrdersService.createGroupOrder({
      tableNumber: newGroupOrder.value.tableNumber || undefined,
      hostName: newGroupOrder.value.hostName,
      expectedMembers: newGroupOrder.value.expectedMembers,
      restaurantId,
      notes: newGroupOrder.value.notes || undefined,
    });

    closeCreateDialog();

    // Refresh list from API
    await refreshGroupOrders();

    // Auto-share the newly created order
    const newGroup =
      groupOrders.value.find((o) => o.id === created.id) || (created as any);
    if (newGroup) {
      shareGroupOrder(newGroup as GroupOrder);
    }

    console.log(
      t("groupOrders.alerts.orderCreated", { shareCode: created.shareCode }),
    );
  } catch (_error) {
    console.error("Failed to create group order:", _error);
  }
};

const buildShareUrl = (shareCode: string) =>
  `${window.location.origin}/order/group/${shareCode}`;

const shareGroupOrder = (groupOrder: GroupOrder) => {
  shareData.value = {
    shareCode: groupOrder.shareCode,
    shareUrl: buildShareUrl(groupOrder.shareCode),
  };
  showShareDialog.value = true;
};

const closeShareDialog = () => {
  showShareDialog.value = false;
};

const copyShareCode = async (shareCode: string) => {
  try {
    await navigator.clipboard.writeText(shareCode);
    console.log(t("groupOrders.alerts.shareCodeCopied"));
  } catch (_error) {
    console.error("Failed to copy share code:", _error);
  }
};

const copyShareUrl = async () => {
  try {
    await navigator.clipboard.writeText(shareData.value.shareUrl);
    console.log(t("groupOrders.alerts.shareLinkCopied"));
  } catch (_error) {
    console.error("Failed to copy share URL:", _error);
  }
};

const shareToWhatsApp = () => {
  const text = t("groupOrders.whatsappMessage", {
    shareCode: shareData.value.shareCode,
    shareUrl: shareData.value.shareUrl,
  });
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
};

const shareToWechat = () => {
  console.log("WeChat sharing is under development");
};

const joinGroupOrder = () => {
  joinShareCode.value = "";
  showJoinDialog.value = true;
};

const submitJoinGroupOrder = async () => {
  if (!joinShareCode.value.trim()) return;
  try {
    await groupOrdersService.joinGroupOrder(joinShareCode.value.trim(), {
      memberName: authStore.user?.username || "Staff",
    });
    showJoinDialog.value = false;
    await refreshGroupOrders();
  } catch (_error) {
    console.error("Failed to join group order:", _error);
  }
};

const generateShareCode = async () => {
  const restaurantId = authStore.restaurantId;
  if (!restaurantId) return;

  try {
    const result = await groupOrdersService.generateShareCode(restaurantId);
    shareData.value = {
      shareCode: result.shareCode,
      shareUrl: buildShareUrl(result.shareCode),
    };
    showShareDialog.value = true;
    // Refresh list since generate-code creates a new group order
    await refreshGroupOrders();
  } catch (_error) {
    console.error("Failed to generate share code:", _error);
  }
};

const processSplitBill = async (groupOrder: GroupOrder) => {
  try {
    await groupOrdersService.initiateSplit(groupOrder.id, {
      splitType: "equal",
    });
    await refreshGroupOrders();
  } catch (_error) {
    console.error("Failed to initiate split bill:", _error);
  }
};

const exportGroupOrderReport = async () => {
  const restaurantId = authStore.restaurantId ?? undefined;
  try {
    const data = await groupOrdersService.exportGroupOrders({
      restaurantId,
      format: "csv",
    });
    // The API returns CSV text, not a Blob — convert it
    const blob =
      data instanceof Blob
        ? data
        : new Blob([typeof data === "string" ? data : JSON.stringify(data)], {
            type: "text/csv;charset=utf-8;",
          });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `group-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (_error) {
    console.error("Failed to export group orders:", _error);
  }
};

// 生命週期
onMounted(async () => {
  await refreshGroupOrders();

  // 預選第一個團體訂單
  if (groupOrders.value.length > 0) {
    selectedGroupOrder.value = groupOrders.value[0];
  }
});
</script>

<style scoped>
.group-orders-view {
  padding: 1.5rem;
  min-height: 100vh;
  background-color: #f9fafb;
}

@media (max-width: 640px) {
  .group-orders-view {
    padding: 1rem;
  }
}
</style>
