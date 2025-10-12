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

          <!-- 最低消費設定 -->
          <div class="border-t border-gray-200 pt-4">
            <div class="flex items-center justify-between mb-4">
              <div>
                <label class="text-sm font-medium text-gray-900">啟用最低消費</label>
                <p class="text-sm text-gray-500">設定餐廳最低消費金額限制</p>
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
                  最低消費金額 ({{ settings.system.currency }})
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
                  設定為 0 表示停用最低消費限制
                </p>
              </div>

              <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div class="flex items-start space-x-2">
                  <svg class="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <div>
                    <p class="text-sm font-medium text-blue-800">提醒</p>
                    <p class="text-sm text-blue-700">
                      客戶訂單未達最低消費時將無法下單，系統會自動提示客戶需要加點的金額。
                    </p>
                  </div>
                </div>
              </div>
            </div>
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

    <!-- QR Code 設定 -->
    <div v-show="activeTab === 'qrcode'" class="space-y-8">
      <!-- 店家模式設定 -->
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h3 class="text-lg font-semibold text-gray-900">店家 QR Code 設定</h3>
            <p class="text-sm text-gray-500 mt-1">
              為沒有桌號的攤位（如小吃攤、鷄排攤）提供店家級別 QR Code
            </p>
          </div>
        </div>

        <!-- 啟用店家模式 -->
        <div class="border-b border-gray-200 pb-4 mb-4">
          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-900">啟用店家模式</label>
              <p class="text-sm text-gray-500">啟用後顧客可以掃描店家 QR Code 直接點餐，無需桌號</p>
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
              店家顯示名稱
            </label>
            <input
              v-model="shopQR.settings.displayName"
              type="text"
              maxlength="50"
              placeholder="例如：鷄排攤"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p class="text-xs text-gray-500 mt-1">此名稱將顯示在掃描後的頁面</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              掃描說明
            </label>
            <textarea
              v-model="shopQR.settings.instructions"
              rows="2"
              maxlength="100"
              placeholder="例如：掃描QR碼開始點餐"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p class="text-xs text-gray-500 mt-1">向顧客說明如何使用</p>
          </div>

          <div class="flex items-center justify-between">
            <div>
              <label class="text-sm font-medium text-gray-900">需要手機驗證</label>
              <p class="text-sm text-gray-500">要求顧客輸入手機號碼後3位以識別訂單</p>
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
              @click="saveShopSettings"
              :disabled="isSavingShopSettings"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span v-if="!isSavingShopSettings">儲存設定</span>
              <span v-else class="flex items-center">
                <svg class="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                儲存中...
              </span>
            </button>
          </div>
        </div>
      </div>

      <!-- QR Code 管理 -->
      <div v-if="shopQR.enabled" class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">QR Code 管理</h3>

        <!-- 沒有 QR Code 時 -->
        <div v-if="!shopQR.qrCode" class="text-center py-8">
          <div class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </div>
          <p class="text-gray-600 mb-4">尚未生成店家 QR Code</p>
          <button
            @click="generateShopQR"
            :disabled="isGeneratingQR"
            class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="!isGeneratingQR">生成 QR Code</span>
            <span v-else class="flex items-center">
              <svg class="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              生成中...
            </span>
          </button>
        </div>

        <!-- 已有 QR Code 時 -->
        <div v-else class="space-y-6">
          <!-- QR Code 顯示 -->
          <div class="flex flex-col md:flex-row gap-6">
            <!-- QR Code 圖片 -->
            <div class="flex-shrink-0">
              <div class="w-64 h-64 bg-white border-2 border-gray-200 rounded-lg p-4 flex items-center justify-center">
                <div v-if="shopQR.qrCodeImageUrl" class="w-full h-full flex items-center justify-center">
                  <img :src="shopQR.qrCodeImageUrl" alt="Shop QR Code" class="max-w-full max-h-full" />
                </div>
                <div v-else class="text-center">
                  <svg class="w-32 h-32 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  <p class="text-sm text-gray-500 mt-2">QR Code</p>
                </div>
              </div>
            </div>

            <!-- QR Code 資訊 -->
            <div class="flex-1 space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">QR Code</label>
                <div class="flex items-center space-x-2">
                  <code class="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm font-mono">
                    {{ shopQR.qrCode }}
                  </code>
                  <button
                    @click="copyQRCode"
                    class="px-3 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                    title="複製"
                  >
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">版本</label>
                <p class="text-sm text-gray-600">v{{ shopQR.version }}</p>
              </div>

              <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div class="flex items-start space-x-2">
                  <svg class="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p class="text-sm font-medium text-blue-800">使用說明</p>
                    <p class="text-sm text-blue-700">
                      顧客掃描此 QR Code 後將進入店家點餐流程，無需選擇桌號。訂單會以手機號碼後3位作為識別。
                    </p>
                  </div>
                </div>
              </div>

              <!-- 操作按鈕 -->
              <div class="flex flex-wrap gap-3 pt-2">
                <button
                  @click="downloadQRCode"
                  class="px-4 py-2 text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <span class="flex items-center">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    下載 QR Code
                  </span>
                </button>

                <button
                  @click="regenerateShopQR"
                  :disabled="isRegeneratingQR"
                  class="px-4 py-2 text-orange-600 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span v-if="!isRegeneratingQR" class="flex items-center">
                    <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    重新生成
                  </span>
                  <span v-else class="flex items-center">
                    <svg class="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    重新生成中...
                  </span>
                </button>
              </div>

              <!-- 重新生成警告 -->
              <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div class="flex items-start space-x-2">
                  <svg class="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p class="text-sm font-medium text-yellow-800">注意</p>
                    <p class="text-sm text-yellow-700">
                      重新生成 QR Code 將更新版本號，舊 QR Code 將繼續有效（除非您停用店家模式）。建議在 QR Code 洩露或安全性顧慮時才重新生成。
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
  { id: "qrcode", name: "QR Code" },
  { id: "notifications", name: "通知設定" },
  { id: "security", name: "安全設定" },
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

// Shop QR 方法
const loadShopQRInfo = async () => {
  try {
    const restaurantId = 1; // 從用戶 session 獲取
    const response = await fetch(`/api/v1/restaurants/${restaurantId}/qr/shop`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

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
    const response = await fetch(`/api/v1/restaurants/${restaurantId}/shop-mode`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({
        enabled: shopQR.enabled,
        settings: shopQR.settings,
      }),
    });

    if (response.ok) {
      alert(shopQR.enabled ? "店家模式已啟用" : "店家模式已停用");
      await loadShopQRInfo();
    } else {
      throw new Error("Failed to toggle shop mode");
    }
  } catch (error) {
    console.error("Failed to toggle shop mode:", error);
    alert("操作失敗，請稍後再試");
    // 恢復原狀態
    shopQR.enabled = !shopQR.enabled;
  }
};

const saveShopSettings = async () => {
  try {
    isSavingShopSettings.value = true;
    const restaurantId = 1;
    const response = await fetch(`/api/v1/restaurants/${restaurantId}/shop-mode`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({
        enabled: shopQR.enabled,
        settings: shopQR.settings,
      }),
    });

    if (response.ok) {
      alert("設定已儲存");
    } else {
      throw new Error("Failed to save settings");
    }
  } catch (error) {
    console.error("Failed to save shop settings:", error);
    alert("儲存失敗，請稍後再試");
  } finally {
    isSavingShopSettings.value = false;
  }
};

const generateShopQR = async () => {
  try {
    isGeneratingQR.value = true;
    const restaurantId = 1;
    const response = await fetch(`/api/v1/restaurants/${restaurantId}/qr/shop/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      shopQR.qrCode = data.qrCode;
      shopQR.qrCodeImageUrl = data.qrCodeImageUrl;
      shopQR.version = data.version;
      alert("QR Code 已生成");
    } else {
      throw new Error("Failed to generate QR code");
    }
  } catch (error) {
    console.error("Failed to generate shop QR:", error);
    alert("生成失敗，請稍後再試");
  } finally {
    isGeneratingQR.value = false;
  }
};

const regenerateShopQR = async () => {
  if (!confirm("確定要重新生成 QR Code 嗎？這將更新版本號。")) {
    return;
  }

  try {
    isRegeneratingQR.value = true;
    const restaurantId = 1;
    const response = await fetch(`/api/v1/restaurants/${restaurantId}/qr/shop/regenerate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      shopQR.qrCode = data.qrCode;
      shopQR.qrCodeImageUrl = data.qrCodeImageUrl;
      shopQR.version = data.version;
      alert(`QR Code 已重新生成（版本 ${data.version}）`);
    } else {
      throw new Error("Failed to regenerate QR code");
    }
  } catch (error) {
    console.error("Failed to regenerate shop QR:", error);
    alert("重新生成失敗，請稍後再試");
  } finally {
    isRegeneratingQR.value = false;
  }
};

const copyQRCode = () => {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(shopQR.qrCode).then(() => {
      alert("已複製到剪貼簿");
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
    alert("無法下載 QR Code");
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
