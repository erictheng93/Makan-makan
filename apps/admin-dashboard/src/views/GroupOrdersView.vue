<template>
  <div class="group-orders-view">
    <!-- 標題區域 -->
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">
          {{ t("groupOrders.title") }}
        </h1>
        <p class="text-gray-600">{{ t("groupOrders.subtitle") }}</p>
      </div>
      <div class="flex items-center space-x-4">
        <!-- 即時統計 -->
        <div class="bg-blue-100 px-4 py-2 rounded-lg">
          <p class="text-sm text-blue-800 font-medium">
            {{ t("groupOrders.activeOrders") }}: {{ activeGroupOrders }}
          </p>
          <p class="text-xs text-blue-600">
            {{ t("groupOrders.todayTotal") }}: {{ todayGroupOrders }}
          </p>
        </div>

        <!-- 功能按鈕 -->
        <button
          class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          @click="createGroupOrder"
        >
          {{ t("groupOrders.createOrder") }}
        </button>

        <button
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          @click="generateShareCode"
        >
          {{ t("groupOrders.generateShareCode") }}
        </button>
      </div>
    </div>

    <!-- 統計卡片 -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-green-100">
            <UserGroupIcon class="h-6 w-6 text-green-600" />
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500">
              {{ t("groupOrders.activeOrders") }}
            </p>
            <p class="text-2xl font-semibold text-gray-900">
              {{ activeGroupOrders }}
            </p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-blue-100">
            <ShareIcon class="h-6 w-6 text-blue-600" />
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500">
              {{ t("groupOrders.shareCount") }}
            </p>
            <p class="text-2xl font-semibold text-gray-900">
              {{ totalShares }}
            </p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-3 rounded-full bg-purple-100">
            <CreditCardIcon class="h-6 w-6 text-purple-600" />
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500">
              {{ t("groupOrders.splitBillOrders") }}
            </p>
            <p class="text-2xl font-semibold text-gray-900">
              {{ splitBillOrders }}
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
              {{ t("groupOrders.avgCompletionTime") }}
            </p>
            <p class="text-2xl font-semibold text-gray-900">
              {{ avgCompletionTime }}{{ t("groupOrders.minutes") }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- 主要內容區域 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- 左側：整體團體訂單列表 -->
      <div class="lg:col-span-2">
        <div class="bg-white rounded-lg shadow">
          <div class="p-6 border-b border-gray-200">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-semibold text-gray-900">
                {{ t("groupOrders.orderList") }}
              </h2>
              <div class="flex items-center space-x-4">
                <!-- 搜尋篩選 -->
                <div class="relative">
                  <MagnifyingGlassIcon
                    class="absolute left-3 top-3 h-4 w-4 text-gray-400"
                  />
                  <input
                    v-model="searchQuery"
                    type="text"
                    :placeholder="t('groupOrders.searchPlaceholder')"
                    class="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <select
                  v-model="statusFilter"
                  class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                  class="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
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
              class="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
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
                          :title="member.name"
                        >
                          {{ member.name.charAt(0) }}
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
                    @click.stop="viewGroupOrderDetails(groupOrder)"
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
                      @click="generateQRCode(selectedGroupOrder)"
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
                        {{ member.name.charAt(0) }}
                      </div>
                      <div class="ml-3">
                        <p class="text-sm font-medium text-gray-900">
                          {{ member.name }}
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
                    :style="{ width: '75%' }"
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
                    >3.2{{ t("groupOrders.people") }}</span
                  >
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                  <div
                    class="bg-green-600 h-2 rounded-full"
                    :style="{ width: '64%' }"
                  />
                </div>
              </div>

              <!-- 分帳完成率 -->
              <div>
                <div class="flex justify-between text-sm mb-2">
                  <span class="text-gray-600">{{
                    t("groupOrders.splitBillRate")
                  }}</span>
                  <span class="font-medium">87%</span>
                </div>
                <div class="w-full bg-gray-200 rounded-full h-2">
                  <div
                    class="bg-purple-600 h-2 rounded-full"
                    :style="{ width: '87%' }"
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

const { t } = useI18n();
const { formatPrice } = useCurrency();

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

// 統計數據
const activeGroupOrders = ref(5);
const todayGroupOrders = ref(12);
const totalShares = ref(28);
const splitBillOrders = ref(8);
const avgCompletionTime = ref(23);

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

// 模擬團體訂單數據
const groupOrders = ref<GroupOrder[]>([
  {
    id: "group_001",
    shareCode: "PARTY-ABC123",
    masterOrderId: null,
    tableNumber: "T05",
    status: "active",
    hostName: "張小明",
    memberCount: 4,
    paidMembers: 2,
    totalAmount: 156.8,
    subtotal: 140.0,
    serviceCharge: 14.0,
    taxAmount: 2.8,
    itemCount: 12,
    members: [
      {
        id: "member_001",
        name: "張小明",
        itemCount: 3,
        totalAmount: 45.6,
        paymentStatus: "paid",
        joinedAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: "member_002",
        name: "李小華",
        itemCount: 4,
        totalAmount: 52.2,
        paymentStatus: "paid",
        joinedAt: new Date(Date.now() - 3000000).toISOString(),
      },
      {
        id: "member_003",
        name: "王大明",
        itemCount: 3,
        totalAmount: 38.5,
        paymentStatus: "pending",
        joinedAt: new Date(Date.now() - 2400000).toISOString(),
      },
      {
        id: "member_004",
        name: "陳小美",
        itemCount: 2,
        totalAmount: 20.5,
        paymentStatus: "unpaid",
        joinedAt: new Date(Date.now() - 1800000).toISOString(),
      },
    ],
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    completedAt: null,
    expiresAt: new Date(Date.now() + 7200000).toISOString(),
  },
  {
    id: "group_002",
    shareCode: "LUNCH-XYZ789",
    masterOrderId: "order_123",
    tableNumber: "T08",
    status: "ready_to_pay",
    hostName: "林小強",
    memberCount: 3,
    paidMembers: 3,
    totalAmount: 95.4,
    subtotal: 85.0,
    serviceCharge: 8.5,
    taxAmount: 1.9,
    itemCount: 8,
    members: [
      {
        id: "member_005",
        name: "林小強",
        itemCount: 3,
        totalAmount: 35.2,
        paymentStatus: "paid",
        joinedAt: new Date(Date.now() - 5400000).toISOString(),
      },
      {
        id: "member_006",
        name: "劉小敏",
        itemCount: 3,
        totalAmount: 32.8,
        paymentStatus: "paid",
        joinedAt: new Date(Date.now() - 4800000).toISOString(),
      },
      {
        id: "member_007",
        name: "黃大華",
        itemCount: 2,
        totalAmount: 27.4,
        paymentStatus: "paid",
        joinedAt: new Date(Date.now() - 4200000).toISOString(),
      },
    ],
    createdAt: new Date(Date.now() - 5400000).toISOString(),
    completedAt: null,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  },
]);

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

  return filtered.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
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
  console.log("Refreshing group orders...");
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
    const shareCode = `PARTY-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const newGroup: GroupOrder = {
      id: `group_${Date.now()}`,
      shareCode,
      masterOrderId: null,
      tableNumber: newGroupOrder.value.tableNumber || null,
      status: "active",
      hostName: newGroupOrder.value.hostName,
      memberCount: 1,
      paidMembers: 0,
      totalAmount: 0,
      subtotal: 0,
      serviceCharge: 0,
      taxAmount: 0,
      itemCount: 0,
      members: [
        {
          id: `member_${Date.now()}`,
          name: newGroupOrder.value.hostName,
          itemCount: 0,
          totalAmount: 0,
          paymentStatus: "unpaid",
          joinedAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      completedAt: null,
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(), // 4小時後過期
    };

    groupOrders.value.unshift(newGroup);
    closeCreateDialog();

    // 自動分享已建立的訂單
    shareGroupOrder(newGroup);

    alert(t("groupOrders.alerts.orderCreated", { shareCode }));
  } catch (_error) {
    alert(t("groupOrders.alerts.createFailed"));
  }
};

const shareGroupOrder = (groupOrder: GroupOrder) => {
  shareData.value = {
    shareCode: groupOrder.shareCode,
    shareUrl: `${window.location.origin}/order/group/${groupOrder.shareCode}`,
  };
  showShareDialog.value = true;
};

const closeShareDialog = () => {
  showShareDialog.value = false;
};

const copyShareCode = async (shareCode: string) => {
  try {
    await navigator.clipboard.writeText(shareCode);
    alert(t("groupOrders.alerts.shareCodeCopied"));
  } catch (_error) {
    alert(t("groupOrders.alerts.copyFailed"));
  }
};

const copyShareUrl = async () => {
  try {
    await navigator.clipboard.writeText(shareData.value.shareUrl);
    alert(t("groupOrders.alerts.shareLinkCopied"));
  } catch (_error) {
    alert(t("groupOrders.alerts.copyFailed"));
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
  alert(t("groupOrders.alerts.wechatInDev"));
};

const generateQRCode = (groupOrder: GroupOrder) => {
  console.log("Generate QR code for:", groupOrder.shareCode);
  alert(t("groupOrders.alerts.qrInDev"));
};

const joinGroupOrder = () => {
  const shareCode = prompt(t("groupOrders.prompts.enterShareCode"));
  if (shareCode) {
    console.log("Join group order:", shareCode);
    alert(t("groupOrders.alerts.joinInDev"));
  }
};

const generateShareCode = () => {
  const shareCode = `PARTY-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  alert(t("groupOrders.alerts.shareCodeGenerated", { shareCode }));
};

const processSplitBill = (groupOrder: GroupOrder) => {
  console.log("Process split bill for:", groupOrder.id);
  alert(t("groupOrders.alerts.splitBillInDev"));
};

const viewGroupOrderDetails = (groupOrder: GroupOrder) => {
  selectedGroupOrder.value = groupOrder;
  console.log("View details for:", groupOrder.id);
};

const exportGroupOrderReport = () => {
  alert(t("groupOrders.alerts.exportInDev"));
};

// 生命週期
onMounted(async () => {
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
