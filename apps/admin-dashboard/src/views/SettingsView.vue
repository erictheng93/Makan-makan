<template>
  <div class="settings-view">
    <!-- 頁面標題 -->
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">
          {{ t("settings.title") }}
        </h1>
        <p class="text-gray-600">{{ t("settings.subtitle") }}</p>
      </div>
      <div class="flex items-center space-x-3">
        <button
          class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          @click="resetToDefaults"
        >
          {{ t("settings.resetDefaults") }}
        </button>
        <button
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          @click="saveSettings"
        >
          {{ t("settings.saveSettings") }}
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
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          {{ t("settings.general.restaurantInfo") }}
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">{{
              t("settings.general.restaurantName")
            }}</label>
            <input
              v-model="settings.restaurant.name"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">{{
              t("settings.general.contactPhone")
            }}</label>
            <input
              v-model="settings.restaurant.phone"
              type="tel"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div class="md:col-span-2">
            <label class="block text-sm font-medium text-gray-700 mb-2">{{
              t("settings.general.restaurantAddress")
            }}</label>
            <textarea
              v-model="settings.restaurant.address"
              rows="3"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">{{
              t("settings.general.businessHours")
            }}</label>
            <div class="flex items-center space-x-2">
              <input
                v-model="settings.restaurant.openTime"
                type="time"
                class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span class="text-gray-500">{{ t("settings.general.to") }}</span>
              <input
                v-model="settings.restaurant.closeTime"
                type="time"
                class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">{{
              t("settings.general.timezone")
            }}</label>
            <select
              v-model="settings.restaurant.timezone"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="Asia/Taipei">
                {{ t("settings.general.timezones.taiwan") }}
              </option>
              <option value="Asia/Kuala_Lumpur">
                {{ t("settings.general.timezones.malaysia") }}
              </option>
              <option value="Asia/Singapore">
                {{ t("settings.general.timezones.singapore") }}
              </option>
              <option value="Asia/Tokyo">
                {{ t("settings.general.timezones.japan") }}
              </option>
              <option value="Asia/Shanghai">
                {{ t("settings.general.timezones.china") }}
              </option>
              <option value="Asia/Ho_Chi_Minh">
                {{ t("settings.general.timezones.vietnam") }}
              </option>
              <option value="Asia/Jakarta">
                {{ t("settings.general.timezones.indonesia") }}
              </option>
              <option value="America/New_York">
                {{ t("settings.general.timezones.usEast") }}
              </option>
              <option value="America/Los_Angeles">
                {{ t("settings.general.timezones.usWest") }}
              </option>
            </select>
          </div>
        </div>
      </div>

      <!-- 系統偏好 -->
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          {{ t("settings.general.systemPreferences") }}
        </h3>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-900">{{
                t("settings.general.language")
              }}</label>
              <p class="text-sm text-gray-500">
                {{ t("settings.general.languageDesc") }}
              </p>
            </div>
            <select
              v-model="settings.system.language"
              class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="zh-TW">繁體中文</option>
              <option value="zh-CN">简体中文</option>
              <option value="en-US">English</option>
              <option value="ja-JP">日本語</option>
              <option value="vi-VN">Tiếng Việt</option>
              <option value="id-ID">Bahasa Indonesia</option>
            </select>
          </div>

          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-900">{{
                t("settings.general.currency")
              }}</label>
              <p class="text-sm text-gray-500">
                {{ t("settings.general.currencyDesc") }}
              </p>
            </div>
            <select
              v-model="settings.system.currency"
              class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="MYR">
                {{ t("settings.general.currencies.myr") }}
              </option>
              <option value="TWD">
                {{ t("settings.general.currencies.twd") }}
              </option>
            </select>
          </div>

          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-900">{{
                t("settings.general.autoLogout")
              }}</label>
              <p class="text-sm text-gray-500">
                {{ t("settings.general.autoLogoutDesc") }}
              </p>
            </div>
            <select
              v-model.number="settings.system.autoLogoutMinutes"
              class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="30">{{ t("settings.general.minutes30") }}</option>
              <option value="60">{{ t("settings.general.hour1") }}</option>
              <option value="120">{{ t("settings.general.hours2") }}</option>
              <option value="240">{{ t("settings.general.hours4") }}</option>
              <option value="0">{{ t("settings.general.neverLogout") }}</option>
            </select>
          </div>
        </div>
      </div>
    </div>

    <!-- 訂單設定 -->
    <div v-show="activeTab === 'orders'" class="space-y-8">
      <!-- 訂單流程 -->
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          {{ t("settings.orders.title") }}
        </h3>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-900">{{
                t("settings.orders.autoConfirm")
              }}</label>
              <p class="text-sm text-gray-500">
                {{ t("settings.orders.autoConfirmDesc") }}
              </p>
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
              <label class="text-sm font-medium text-gray-900">{{
                t("settings.orders.prepTimeAlert")
              }}</label>
              <p class="text-sm text-gray-500">
                {{ t("settings.orders.prepTimeAlertDesc") }}
              </p>
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
            <label class="block text-sm font-medium text-gray-700 mb-2">{{
              t("settings.orders.defaultPrepTime")
            }}</label>
            <input
              v-model.number="settings.orders.defaultPreparationTime"
              type="number"
              min="5"
              max="60"
              class="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <!-- 最低消費設定 -->
          <div class="border-t border-gray-200 pt-4">
            <div class="flex items-center justify-between mb-4">
              <div>
                <label class="text-sm font-medium text-gray-900">{{
                  t("settings.orders.enableMinOrder")
                }}</label>
                <p class="text-sm text-gray-500">
                  {{ t("settings.orders.enableMinOrderDesc") }}
                </p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  v-model="settings.orders.minimumOrderEnabled"
                  type="checkbox"
                  class="sr-only peer"
                />
                <div
                  class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
                />
              </label>
            </div>

            <div v-if="settings.orders.minimumOrderEnabled" class="space-y-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  {{ t("settings.orders.minOrderAmount") }} ({{
                    settings.system.currency
                  }})
                </label>
                <div class="flex items-center space-x-2">
                  <span class="text-gray-500">RM</span>
                  <input
                    v-model.number="settings.orders.minimumOrderAmount"
                    type="number"
                    min="0"
                    step="0.50"
                    max="500"
                    class="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>
                <p class="text-xs text-gray-500 mt-1">
                  {{ t("settings.orders.minOrderHint") }}
                </p>
              </div>

              <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div class="flex items-start space-x-2">
                  <svg
                    class="w-5 h-5 text-blue-600 mt-0.5"
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
                  <div>
                    <p class="text-sm font-medium text-blue-800">
                      {{ t("settings.orders.reminder") }}
                    </p>
                    <p class="text-sm text-blue-700">
                      {{ t("settings.orders.minOrderWarning") }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">{{
              t("settings.orders.retentionDays")
            }}</label>
            <select
              v-model.number="settings.orders.retentionDays"
              class="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="30">30 {{ t("settings.days") }}</option>
              <option value="90">90 {{ t("settings.days") }}</option>
              <option value="180">180 {{ t("settings.days") }}</option>
              <option value="365">1 {{ t("settings.year") }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- 外帶/外送設定 -->
      <div class="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h3 class="text-lg font-bold text-gray-900 mb-1">
          {{ t("settings.delivery.title") }}
        </h3>
        <p class="text-sm text-gray-500 mb-4">
          {{ t("settings.delivery.subtitle") }}
        </p>

        <!-- Enable Takeaway -->
        <div
          class="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-2"
        >
          <div>
            <div class="font-semibold text-sm">
              🛍️ {{ t("settings.delivery.enableTakeaway") }}
            </div>
            <div class="text-xs text-gray-500">
              {{ t("settings.delivery.enableTakeawayDesc") }}
            </div>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input
              v-model="deliverySettings.enableTakeaway"
              type="checkbox"
              class="sr-only peer"
            />
            <div
              class="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"
            ></div>
          </label>
        </div>

        <!-- Enable Delivery -->
        <div
          class="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-4"
        >
          <div>
            <div class="font-semibold text-sm">
              🛵 {{ t("settings.delivery.enableDelivery") }}
            </div>
            <div class="text-xs text-gray-500">
              {{ t("settings.delivery.enableDeliveryDesc") }}
            </div>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input
              v-model="deliverySettings.enableDelivery"
              type="checkbox"
              class="sr-only peer"
            />
            <div
              class="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"
            ></div>
          </label>
        </div>

        <!-- Delivery Fee -->
        <div class="border border-gray-200 rounded-lg p-3 mb-3">
          <label class="block font-semibold text-sm mb-2">{{
            t("settings.delivery.deliveryFee")
          }}</label>
          <div class="flex items-center gap-2">
            <span class="text-gray-500 text-sm">NT$</span>
            <input
              v-model.number="deliverySettings.deliveryFee"
              type="number"
              min="0"
              step="10"
              class="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <p class="text-xs text-gray-400 mt-1">
            {{ t("settings.delivery.freeDeliveryHint") }}
          </p>
        </div>

        <!-- Estimated Prep Time -->
        <div class="border border-gray-200 rounded-lg p-3">
          <label class="block font-semibold text-sm mb-2">{{
            t("settings.delivery.estimatedPrepTime")
          }}</label>
          <div class="flex items-center gap-2">
            <input
              v-model.number="deliverySettings.estimatedPrepTimeMin"
              type="number"
              min="1"
              max="120"
              class="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <span class="text-gray-500">~</span>
            <input
              v-model.number="deliverySettings.estimatedPrepTimeMax"
              type="number"
              min="1"
              max="120"
              class="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <span class="text-gray-500 text-sm">{{
              t("settings.minutes")
            }}</span>
          </div>
        </div>
      </div>

      <!-- 桌台設定 -->
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          {{ t("settings.tables.title") }}
        </h3>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">{{
              t("settings.tables.prefix")
            }}</label>
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
              <label class="text-sm font-medium text-gray-900">{{
                t("settings.tables.autoClean")
              }}</label>
              <p class="text-sm text-gray-500">
                {{ t("settings.tables.autoCleanDesc") }}
              </p>
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
            <label class="block text-sm font-medium text-gray-700 mb-2">{{
              t("settings.tables.cleanDelay")
            }}</label>
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

    <!-- QR Code 設定 -->
    <div v-show="activeTab === 'qrcode'" class="space-y-8">
      <!-- 店家模式設定 -->
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-lg font-semibold text-gray-900">
              {{ t("settings.qrcode.shopTitle") }}
            </h3>
            <p class="text-sm text-gray-500 mt-1">
              {{ t("settings.qrcode.shopDesc") }}
            </p>
          </div>
        </div>

        <!-- 啟用店家模式 -->
        <div class="border-b border-gray-200 pb-4 mb-4">
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-900">{{
                t("settings.qrcode.enableShopMode")
              }}</label>
              <p class="text-sm text-gray-500">
                {{ t("settings.qrcode.enableShopModeDesc") }}
              </p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                v-model="shopQR.enabled"
                type="checkbox"
                class="sr-only peer"
                @change="handleToggleShopMode"
              />
              <div
                class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
              />
            </label>
          </div>
        </div>

        <!-- 店家設定 -->
        <div v-if="shopQR.enabled" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              {{ t("settings.qrcode.displayName") }}
            </label>
            <input
              v-model="shopQR.settings.displayName"
              type="text"
              maxlength="50"
              :placeholder="t('settings.qrcode.displayNameExample')"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p class="text-xs text-gray-500 mt-1">
              {{ t("settings.qrcode.displayNameHint") }}
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              {{ t("settings.qrcode.instructions") }}
            </label>
            <textarea
              v-model="shopQR.settings.instructions"
              rows="2"
              maxlength="100"
              :placeholder="t('settings.qrcode.instructionsExample')"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p class="text-xs text-gray-500 mt-1">
              {{ t("settings.qrcode.instructionsHint") }}
            </p>
          </div>

          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-900">{{
                t("settings.qrcode.requirePhone")
              }}</label>
              <p class="text-sm text-gray-500">
                {{ t("settings.qrcode.requirePhoneDesc") }}
              </p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input
                v-model="shopQR.settings.requirePhone"
                type="checkbox"
                class="sr-only peer"
              />
              <div
                class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"
              />
            </label>
          </div>

          <!-- 儲存設定按鈕 -->
          <div class="flex justify-end pt-4">
            <button
              :disabled="isSavingShopSettings"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              @click="saveShopSettings"
            >
              <span v-if="!isSavingShopSettings">{{
                t("settings.qrcode.saveSettings")
              }}</span>
              <span v-else class="flex items-center">
                <svg
                  class="animate-spin h-4 w-4 mr-2"
                  xmlns="http://www.w3.org/2000/svg"
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
                  ></circle>
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                {{ t("settings.qrcode.saving") }}
              </span>
            </button>
          </div>
        </div>
      </div>

      <!-- QR Code 管理 -->
      <div v-if="shopQR.enabled" class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          {{ t("settings.qrcode.management") }}
        </h3>

        <!-- 沒有 QR Code 時 -->
        <div v-if="!shopQR.qrCode" class="text-center py-8">
          <div
            class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <svg
              class="w-10 h-10 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
              />
            </svg>
          </div>
          <p class="text-gray-600 mb-4">
            {{ t("settings.qrcode.notGenerated") }}
          </p>
          <button
            :disabled="isGeneratingQR"
            class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            @click="generateShopQR"
          >
            <span v-if="!isGeneratingQR">{{
              t("settings.qrcode.generateQR")
            }}</span>
            <span v-else class="flex items-center">
              <svg
                class="animate-spin h-4 w-4 mr-2"
                xmlns="http://www.w3.org/2000/svg"
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
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              {{ t("settings.qrcode.generating") }}
            </span>
          </button>
        </div>

        <!-- 已有 QR Code 時 -->
        <div v-else class="space-y-6">
          <!-- QR Code 顯示 -->
          <div class="flex flex-col md:flex-row gap-6">
            <!-- QR Code 圖片 -->
            <div class="flex-shrink-0">
              <div
                class="w-64 h-64 bg-white border-2 border-gray-200 rounded-lg p-4 flex items-center justify-center"
              >
                <div
                  v-if="shopQR.qrCodeImageUrl"
                  class="w-full h-full flex items-center justify-center"
                >
                  <img
                    :src="shopQR.qrCodeImageUrl"
                    alt="Shop QR Code"
                    class="max-w-full max-h-full"
                  />
                </div>
                <div v-else class="text-center">
                  <svg
                    class="w-32 h-32 text-gray-400 mx-auto"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                    />
                  </svg>
                  <p class="text-sm text-gray-500 mt-2">QR Code</p>
                </div>
              </div>
            </div>

            <!-- QR Code 資訊 -->
            <div class="flex-1 space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1"
                  >QR Code</label
                >
                <div class="flex items-center space-x-2">
                  <code
                    class="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm font-mono"
                  >
                    {{ shopQR.qrCode }}
                  </code>
                  <button
                    class="px-3 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                    :title="t('settings.qrcode.copy')"
                    @click="copyQRCode"
                  >
                    <svg
                      class="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">{{
                  t("settings.qrcode.version")
                }}</label>
                <p class="text-sm text-gray-600">v{{ shopQR.version }}</p>
              </div>

              <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div class="flex items-start space-x-2">
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
                  <div>
                    <p class="text-sm font-medium text-blue-800">
                      {{ t("settings.qrcode.usageGuide") }}
                    </p>
                    <p class="text-sm text-blue-700">
                      {{ t("settings.qrcode.usageGuideText") }}
                    </p>
                  </div>
                </div>
              </div>

              <!-- 操作按鈕 -->
              <div class="flex flex-wrap gap-3 pt-2">
                <button
                  class="px-4 py-2 text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                  @click="downloadQRCode"
                >
                  <span class="flex items-center">
                    <svg
                      class="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    {{ t("settings.qrcode.downloadQR") }}
                  </span>
                </button>

                <button
                  :disabled="isRegeneratingQR"
                  class="px-4 py-2 text-orange-600 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  @click="regenerateShopQR"
                >
                  <span v-if="!isRegeneratingQR" class="flex items-center">
                    <svg
                      class="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    {{ t("settings.qrcode.regenerate") }}
                  </span>
                  <span v-else class="flex items-center">
                    <svg
                      class="animate-spin h-4 w-4 mr-2"
                      xmlns="http://www.w3.org/2000/svg"
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
                      ></circle>
                      <path
                        class="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    {{ t("settings.qrcode.regenerating") }}
                  </span>
                </button>
              </div>

              <!-- 重新生成警告 -->
              <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div class="flex items-start space-x-2">
                  <svg
                    class="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <div>
                    <p class="text-sm font-medium text-yellow-800">
                      {{ t("settings.qrcode.warning") }}
                    </p>
                    <p class="text-sm text-yellow-700">
                      {{ t("settings.qrcode.warningText") }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 通知設定 -->
    <div v-show="activeTab === 'notifications'" class="space-y-8">
      <!-- 音效通知 -->
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">
          {{ t("settings.notifications.soundTitle") }}
        </h3>
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-900">{{
                t("settings.notifications.enableSound")
              }}</label>
              <p class="text-sm text-gray-500">
                {{ t("settings.notifications.enableSoundDesc") }}
              </p>
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
              <label class="block text-sm font-medium text-gray-700 mb-2">{{
                t("settings.notifications.volume")
              }}</label>
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
              <label class="block text-sm font-medium text-gray-700 mb-2">{{
                t("settings.notifications.newOrderSound")
              }}</label>
              <select
                v-model="settings.notifications.sound.newOrder"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="bell">
                  {{ t("settings.notifications.sounds.bell") }}
                </option>
                <option value="chime">
                  {{ t("settings.notifications.sounds.chime") }}
                </option>
                <option value="notification">
                  {{ t("settings.notifications.sounds.notification") }}
                </option>
                <option value="custom">
                  {{ t("settings.notifications.sounds.custom") }}
                </option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">{{
                t("settings.notifications.completeSound")
              }}</label>
              <select
                v-model="settings.notifications.sound.complete"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="success">
                  {{ t("settings.notifications.sounds.success") }}
                </option>
                <option value="ding">
                  {{ t("settings.notifications.sounds.ding") }}
                </option>
                <option value="chime">
                  {{ t("settings.notifications.sounds.chime") }}
                </option>
                <option value="custom">
                  {{ t("settings.notifications.sounds.custom") }}
                </option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 桌面通知 -->
    <div class="bg-white rounded-lg shadow p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">
        {{ t("settings.notifications.desktopTitle") }}
      </h3>
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <label class="text-sm font-medium text-gray-900">{{
              t("settings.notifications.enableDesktop")
            }}</label>
            <p class="text-sm text-gray-500">
              {{ t("settings.notifications.enableDesktopDesc") }}
            </p>
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
            <label class="block text-sm font-medium text-gray-700 mb-2">{{
              t("settings.notifications.duration")
            }}</label>
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
      <h3 class="text-lg font-semibold text-gray-900 mb-4">
        {{ t("settings.security.passwordTitle") }}
      </h3>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">{{
            t("settings.security.minLength")
          }}</label>
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
            <label class="text-sm font-medium text-gray-900">{{
              t("settings.security.requireNumbers")
            }}</label>
            <p class="text-sm text-gray-500">
              {{ t("settings.security.requireNumbersDesc") }}
            </p>
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
            <label class="text-sm font-medium text-gray-900">{{
              t("settings.security.requireSymbols")
            }}</label>
            <p class="text-sm text-gray-500">
              {{ t("settings.security.requireSymbolsDesc") }}
            </p>
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
          <label class="block text-sm font-medium text-gray-700 mb-2">{{
            t("settings.security.expireDays")
          }}</label>
          <select
            v-model.number="settings.security.password.expireDays"
            class="w-48 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="0">{{ t("settings.security.neverExpire") }}</option>
            <option value="30">30 {{ t("settings.days") }}</option>
            <option value="60">60 {{ t("settings.days") }}</option>
            <option value="90">90 {{ t("settings.days") }}</option>
            <option value="180">180 {{ t("settings.days") }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 登入安全 -->
    <div class="bg-white rounded-lg shadow p-6">
      <h3 class="text-lg font-semibold text-gray-900 mb-4">
        {{ t("settings.security.loginTitle") }}
      </h3>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">{{
            t("settings.security.maxAttempts")
          }}</label>
          <input
            v-model.number="settings.security.login.maxAttempts"
            type="number"
            min="3"
            max="10"
            class="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">{{
            t("settings.security.lockoutMinutes")
          }}</label>
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
            <label class="text-sm font-medium text-gray-900">{{
              t("settings.security.logActivity")
            }}</label>
            <p class="text-sm text-gray-500">
              {{ t("settings.security.logActivityDesc") }}
            </p>
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

  <!-- 外送平台串接設定 -->
  <div v-show="activeTab === 'integrations'" class="space-y-8">
    <IntegrationsSettings />
  </div>

  <!-- 成功提示 -->
  <div
    v-if="showSuccessMessage"
    class="fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg shadow-lg z-50"
  >
    <div class="flex items-center">
      <CheckCircleIcon class="h-5 w-5 mr-2" />
      <span>{{ t("settings.savedSuccess") }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { CheckCircleIcon } from "@heroicons/vue/24/outline";
import IntegrationsSettings from "@/components/settings/IntegrationsSettings.vue";
import { useI18n } from "@/i18n";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/services/api";
import { setRestaurantCurrency } from "@/composables/useCurrency";
import type { CurrencyCode } from "@makanmakan/shared-types";

const { t } = useI18n();
const authStore = useAuthStore();

// 分頁選項
const tabs = [
  { id: "general", name: t("settings.tabs.general") },
  { id: "orders", name: t("settings.tabs.orders") },
  { id: "qrcode", name: t("settings.tabs.qrcode") },
  { id: "notifications", name: t("settings.tabs.notifications") },
  { id: "security", name: t("settings.tabs.security") },
  { id: "integrations", name: t("settings.tabs.integrations") },
];

const activeTab = ref("general");
const showSuccessMessage = ref(false);

// Shop QR 狀態
const shopQR = reactive({
  enabled: false,
  qrCode: "",
  qrCodeImageUrl: "",
  version: 1,
  settings: {
    displayName: "",
    instructions: "",
    requirePhone: true,
  },
});

const isGeneratingQR = ref(false);
const isRegeneratingQR = ref(false);
const isSavingShopSettings = ref(false);

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
    minimumOrderEnabled: false,
    minimumOrderAmount: 0,
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

// 外帶/外送設定
const deliverySettings = reactive({
  enableTakeaway: true,
  enableDelivery: false,
  deliveryFee: 0,
  estimatedPrepTimeMin: 15,
  estimatedPrepTimeMax: 20,
});

// 預設設定
const defaultSettings = { ...settings };

// 方法
const saveSettings = async () => {
  try {
    const restaurantId = authStore.restaurantId;
    if (restaurantId) {
      await api.put(`/restaurants/${restaurantId}`, {
        settings: { currency: settings.system.currency },
      });
      setRestaurantCurrency(settings.system.currency as CurrencyCode);
    }

    showSuccessMessage.value = true;
    setTimeout(() => {
      showSuccessMessage.value = false;
    }, 3000);
  } catch (error) {
    console.error("Failed to save settings:", error);
    alert(t("settings.alerts.saveFailed"));
  }
};

const resetToDefaults = () => {
  if (confirm(t("settings.confirms.resetDefaults"))) {
    Object.assign(settings, defaultSettings);
  }
};

const loadSettings = async () => {
  try {
    const restaurantId = authStore.restaurantId;
    if (restaurantId) {
      const response = await api.get<{ settings?: { currency?: string } }>(
        `/restaurants/${restaurantId}`,
      );
      const data = response.data?.data;
      if (data?.settings?.currency) {
        settings.system.currency = data.settings.currency;
        setRestaurantCurrency(data.settings.currency as CurrencyCode);
      }
    }
  } catch (error) {
    console.error("Failed to load settings:", error);
  }
};

// Shop QR 方法
const loadShopQRInfo = async () => {
  try {
    const restaurantId = 1; // 從用戶 session 獲取
    const response = await fetch(
      `/api/v1/restaurants/${restaurantId}/qr/shop`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      },
    );

    if (response.ok) {
      const data = await response.json();
      shopQR.enabled = data.enabled || false;
      shopQR.qrCode = data.qrCode || "";
      shopQR.qrCodeImageUrl = data.qrCodeImageUrl || "";
      shopQR.version = data.version || 1;
      if (data.settings) {
        shopQR.settings = { ...shopQR.settings, ...data.settings };
      }
    }
  } catch (error) {
    console.error("Failed to load shop QR info:", error);
  }
};

const handleToggleShopMode = async () => {
  try {
    const restaurantId = 1;
    const response = await fetch(
      `/api/v1/restaurants/${restaurantId}/shop-mode`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          enabled: shopQR.enabled,
          settings: shopQR.settings,
        }),
      },
    );

    if (response.ok) {
      alert(
        shopQR.enabled
          ? t("settings.alerts.shopModeEnabled")
          : t("settings.alerts.shopModeDisabled"),
      );
      await loadShopQRInfo();
    } else {
      throw new Error("Failed to toggle shop mode");
    }
  } catch (error) {
    console.error("Failed to toggle shop mode:", error);
    alert(t("settings.alerts.operationFailed"));
    // 恢復原狀態
    shopQR.enabled = !shopQR.enabled;
  }
};

const saveShopSettings = async () => {
  try {
    isSavingShopSettings.value = true;
    const restaurantId = 1;
    const response = await fetch(
      `/api/v1/restaurants/${restaurantId}/shop-mode`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          enabled: shopQR.enabled,
          settings: shopQR.settings,
        }),
      },
    );

    if (response.ok) {
      alert(t("settings.alerts.settingsSaved"));
    } else {
      throw new Error("Failed to save settings");
    }
  } catch (error) {
    console.error("Failed to save shop settings:", error);
    alert(t("settings.alerts.saveFailed"));
  } finally {
    isSavingShopSettings.value = false;
  }
};

const generateShopQR = async () => {
  try {
    isGeneratingQR.value = true;
    const restaurantId = 1;
    const response = await fetch(
      `/api/v1/restaurants/${restaurantId}/qr/shop/generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      },
    );

    if (response.ok) {
      const data = await response.json();
      shopQR.qrCode = data.qrCode;
      shopQR.qrCodeImageUrl = data.qrCodeImageUrl;
      shopQR.version = data.version;
      alert(t("settings.alerts.qrGenerated"));
    } else {
      throw new Error("Failed to generate QR code");
    }
  } catch (error) {
    console.error("Failed to generate shop QR:", error);
    alert(t("settings.alerts.generateFailed"));
  } finally {
    isGeneratingQR.value = false;
  }
};

const regenerateShopQR = async () => {
  if (!confirm(t("settings.confirms.regenerateQR"))) {
    return;
  }

  try {
    isRegeneratingQR.value = true;
    const restaurantId = 1;
    const response = await fetch(
      `/api/v1/restaurants/${restaurantId}/qr/shop/regenerate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      },
    );

    if (response.ok) {
      const data = await response.json();
      shopQR.qrCode = data.qrCode;
      shopQR.qrCodeImageUrl = data.qrCodeImageUrl;
      shopQR.version = data.version;
      alert(t("settings.alerts.qrRegenerated", { version: data.version }));
    } else {
      throw new Error("Failed to regenerate QR code");
    }
  } catch (error) {
    console.error("Failed to regenerate shop QR:", error);
    alert(t("settings.alerts.regenerateFailed"));
  } finally {
    isRegeneratingQR.value = false;
  }
};

const copyQRCode = () => {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(shopQR.qrCode).then(() => {
      alert(t("settings.alerts.copied"));
    });
  }
};

const downloadQRCode = () => {
  if (shopQR.qrCodeImageUrl) {
    const link = document.createElement("a");
    link.href = shopQR.qrCodeImageUrl;
    link.download = `shop-qr-${shopQR.qrCode}.png`;
    link.click();
  } else {
    alert(t("settings.alerts.downloadFailed"));
  }
};

onMounted(() => {
  loadSettings();
  loadShopQRInfo();
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
