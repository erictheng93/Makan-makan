<template>
  <div id="app" class="min-h-screen bg-gray-50">
    <!-- Global Error Boundary -->
    <ErrorBoundary>
      <!-- 主要內容 -->
      <router-view />

      <!-- 音效控制 -->
      <button
        @click="toggleAudio"
        class="audio-control"
        :title="audioEnabled ? '關閉音效' : '開啟音效'"
      >
        <component :is="audioEnabled ? SpeakerWaveIcon : SpeakerXMarkIcon" class="w-6 h-6 text-gray-600" />
      </button>

    <!-- 鍵盤快捷鍵幫助（可選顯示） -->
    <div
      v-if="showKeyboardHelp"
      class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      @click="showKeyboardHelp = false"
    >
      <div class="bg-white rounded-xl p-6 max-w-md w-full">
        <h3 class="text-lg font-semibold mb-4">鍵盤快捷鍵</h3>
        <div class="space-y-2 text-sm">
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
    </ErrorBoundary>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { SpeakerWaveIcon, SpeakerXMarkIcon } from '@heroicons/vue/24/outline'
import { useSettingsStore } from '@/stores/settings'
import { storeToRefs } from 'pinia'
import ErrorBoundary from '@/components/error/ErrorBoundary.vue'
import { useGlobalErrorHandler } from '@/composables/useErrorHandling'

// Store
const settingsStore = useSettingsStore()
const { audioEnabled } = storeToRefs(settingsStore)

// Global error handling
const { setupGlobalHandlers } = useGlobalErrorHandler()

// Local state
const showKeyboardHelp = ref(false)

// Methods
const toggleAudio = () => {
  settingsStore.toggleAudio()
}


// Keyboard shortcuts
const handleKeyDown = (event: KeyboardEvent) => {
  // 避免在輸入框中觸發快捷鍵
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
    return
  }

  switch (event.key) {
    case 'm':
    case 'M':
      event.preventDefault()
      toggleAudio()
      break
    case '?':
      event.preventDefault()
      showKeyboardHelp.value = !showKeyboardHelp.value
      break
    case 'f':
    case 'F':
      event.preventDefault()
      // 全屏切換
      if (document.fullscreenElement) {
        document.exitFullscreen()
      } else {
        document.documentElement.requestFullscreen()
      }
      break
    case 'Escape':
      showKeyboardHelp.value = false
      break
  }
}

// 生命週期
onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
  // Setup global error handlers
  setupGlobalHandlers()
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})
</script>