<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <div class="bg-white shadow-sm border-b border-gray-200">
      <div class="container mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <button
              @click="$router.back()"
              class="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors"
            >
              <ArrowLeftIcon class="w-5 h-5 text-gray-600" />
            </button>
            <h1 class="text-xl font-bold text-gray-900">系統設定</h1>
          </div>
          
          <button
            @click="resetToDefaults"
            class="text-red-600 hover:text-red-700 text-sm font-medium"
          >
            恢復預設
          </button>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="container mx-auto px-4 py-6">
      <div class="max-w-2xl mx-auto space-y-6">
        
        <!-- Audio Settings -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">音效設定</h2>
          
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <div class="font-medium text-gray-900">啟用音效</div>
                <div class="text-sm text-gray-500">新訂單和狀態變更提示音</div>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  v-model="settings.audioEnabled"
                  type="checkbox"
                  class="sr-only peer"
                  @change="settingsStore.updateSetting('audioEnabled', settings.audioEnabled)"
                >
                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-kitchen-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-kitchen-600"></div>
              </label>
            </div>
            
            <div>
              <div class="flex items-center justify-between mb-2">
                <div class="font-medium text-gray-900">音效音量</div>
                <div class="text-sm text-gray-500">{{ settings.soundVolume }}%</div>
              </div>
              <input
                v-model="settings.soundVolume"
                type="range"
                min="0"
                max="100"
                step="5"
                class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                @change="settingsStore.updateSetting('soundVolume', settings.soundVolume)"
                :disabled="!settings.audioEnabled"
              >
            </div>
          </div>
        </div>

        <!-- Display Settings -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">顯示設定</h2>
          
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <div class="font-medium text-gray-900">顯示預估時間</div>
                <div class="text-sm text-gray-500">在訂單中顯示製作預估時間</div>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  v-model="settings.showEstimatedTime"
                  type="checkbox"
                  class="sr-only peer"
                  @change="settingsStore.updateSetting('showEstimatedTime', settings.showEstimatedTime)"
                >
                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-kitchen-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-kitchen-600"></div>
              </label>
            </div>
            
            <div class="flex items-center justify-between">
              <div>
                <div class="font-medium text-gray-900">顯示顧客姓名</div>
                <div class="text-sm text-gray-500">在訂單中顯示顧客姓名</div>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  v-model="settings.showCustomerNames"
                  type="checkbox"
                  class="sr-only peer"
                  @change="settingsStore.updateSetting('showCustomerNames', settings.showCustomerNames)"
                >
                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-kitchen-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-kitchen-600"></div>
              </label>
            </div>
            
            <div>
              <div class="font-medium text-gray-900 mb-2">字體大小</div>
              <select
                v-model="settings.fontSize"
                class="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-kitchen-500"
                @change="settingsStore.setFontSize(settings.fontSize)"
              >
                <option value="normal">正常</option>
                <option value="large">大字體</option>
                <option value="extra-large">超大字體</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Auto Refresh Settings -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">自動刷新</h2>
          
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <div class="font-medium text-gray-900">啟用自動刷新</div>
                <div class="text-sm text-gray-500">定期自動更新訂單資訊</div>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  v-model="settings.autoRefresh"
                  type="checkbox"
                  class="sr-only peer"
                  @change="settingsStore.updateSetting('autoRefresh', settings.autoRefresh)"
                >
                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-kitchen-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-kitchen-600"></div>
              </label>
            </div>
            
            <div v-if="settings.autoRefresh">
              <div class="flex items-center justify-between mb-2">
                <div class="font-medium text-gray-900">刷新間隔</div>
                <div class="text-sm text-gray-500">{{ settings.refreshInterval }} 秒</div>
              </div>
              <input
                v-model="settings.refreshInterval"
                type="range"
                min="5"
                max="120"
                step="5"
                class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                @change="settingsStore.updateSetting('refreshInterval', settings.refreshInterval)"
              >
            </div>
          </div>
        </div>

        <!-- Alert Thresholds -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">警示設定</h2>
          
          <div class="space-y-4">
            <div>
              <div class="flex items-center justify-between mb-2">
                <div class="font-medium text-gray-900">警告時間</div>
                <div class="text-sm text-gray-500">{{ settings.warningThreshold }} 分鐘</div>
              </div>
              <div class="text-sm text-gray-500 mb-2">超過此時間顯示警告標示</div>
              <input
                v-model="settings.warningThreshold"
                type="range"
                min="1"
                max="30"
                step="1"
                class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                @change="settingsStore.updateSetting('warningThreshold', settings.warningThreshold)"
              >
            </div>
            
            <div>
              <div class="flex items-center justify-between mb-2">
                <div class="font-medium text-gray-900">緊急時間</div>
                <div class="text-sm text-gray-500">{{ settings.urgentThreshold }} 分鐘</div>
              </div>
              <div class="text-sm text-gray-500 mb-2">超過此時間標記為緊急訂單</div>
              <input
                v-model="settings.urgentThreshold"
                type="range"
                min="5"
                max="60"
                step="5"
                class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                @change="settingsStore.updateSetting('urgentThreshold', settings.urgentThreshold)"
              >
            </div>
          </div>
        </div>

        <!-- Keyboard Shortcuts -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">快捷鍵</h2>
          
          <div class="space-y-4">
            <div class="flex items-center justify-between mb-4">
              <div>
                <div class="font-medium text-gray-900">啟用鍵盤快捷鍵</div>
                <div class="text-sm text-gray-500">使用鍵盤快速操作訂單</div>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  v-model="settings.keyboardShortcuts"
                  type="checkbox"
                  class="sr-only peer"
                  @change="settingsStore.updateSetting('keyboardShortcuts', settings.keyboardShortcuts)"
                >
                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-kitchen-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-kitchen-600"></div>
              </label>
            </div>
            
            <div v-if="settings.keyboardShortcuts" class="bg-gray-50 rounded-lg p-4">
              <div class="text-sm font-medium text-gray-700 mb-3">可用快捷鍵：</div>
              <div class="space-y-2 text-sm text-gray-600">
                <div class="flex justify-between">
                  <span>標記完成</span>
                  <span class="keyboard-hint">Space</span>
                </div>
                <div class="flex justify-between">
                  <span>開始製作</span>
                  <span class="keyboard-hint">Enter</span>
                </div>
                <div class="flex justify-between">
                  <span>音效開關</span>
                  <span class="keyboard-hint">M</span>
                </div>
                <div class="flex justify-between">
                  <span>全屏模式</span>
                  <span class="keyboard-hint">F</span>
                </div>
                <div class="flex justify-between">
                  <span>幫助</span>
                  <span class="keyboard-hint">?</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Save Button -->
        <div class="flex justify-center pt-6">
          <button
            @click="$router.back()"
            class="btn-kitchen-primary px-8 py-3"
          >
            完成設定
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue'
import { ArrowLeftIcon } from '@heroicons/vue/24/outline'
import { useSettingsStore } from '@/stores/settings'
import { useToast } from 'vue-toastification'
import { storeToRefs } from 'pinia'

const settingsStore = useSettingsStore()
const toast = useToast()
const { settings: storeSettings } = storeToRefs(settingsStore)

// Create reactive copy of settings
const settings = reactive({ ...storeSettings.value })

const resetToDefaults = () => {
  if (confirm('確定要恢復所有設定為預設值嗎？')) {
    settingsStore.resetSettings()
    Object.assign(settings, storeSettings.value)
    toast.success('設定已恢復為預設值')
  }
}
</script>