import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { KitchenSettings } from '@/types'

const defaultSettings: KitchenSettings = {
  audioEnabled: true,
  autoRefresh: true,
  refreshInterval: 30,
  showEstimatedTime: true,
  showCustomerNames: true,
  theme: 'light',
  fontSize: 'normal',
  urgentThreshold: 15, // 15分鐘後標記為緊急
  warningThreshold: 10, // 10分鐘後標記為警告
  soundVolume: 70,
  keyboardShortcuts: true
}

export const useSettingsStore = defineStore('settings', () => {
  // State
  const settings = ref<KitchenSettings>({ ...defaultSettings })

  // Actions
  const loadSettings = () => {
    try {
      const saved = localStorage.getItem('kitchen_settings')
      if (saved) {
        const savedSettings = JSON.parse(saved)
        // 合併設定，確保新增的設定項目有預設值
        settings.value = { ...defaultSettings, ...savedSettings }
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
      settings.value = { ...defaultSettings }
    }
  }

  const saveSettings = () => {
    try {
      localStorage.setItem('kitchen_settings', JSON.stringify(settings.value))
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
  }

  const updateSetting = <K extends keyof KitchenSettings>(
    key: K,
    value: KitchenSettings[K]
  ) => {
    settings.value[key] = value
    saveSettings()
  }

  const resetSettings = () => {
    settings.value = { ...defaultSettings }
    saveSettings()
  }

  // Computed getters
  const audioEnabled = ref(settings.value.audioEnabled)
  const autoRefresh = ref(settings.value.autoRefresh)
  const refreshInterval = ref(settings.value.refreshInterval)
  const showEstimatedTime = ref(settings.value.showEstimatedTime)
  const showCustomerNames = ref(settings.value.showCustomerNames)
  const theme = ref(settings.value.theme)
  const fontSize = ref(settings.value.fontSize)
  const urgentThreshold = ref(settings.value.urgentThreshold)
  const warningThreshold = ref(settings.value.warningThreshold)
  const soundVolume = ref(settings.value.soundVolume)
  const keyboardShortcuts = ref(settings.value.keyboardShortcuts)

  // Watch for changes and update refs
  watch(settings, (newSettings) => {
    audioEnabled.value = newSettings.audioEnabled
    autoRefresh.value = newSettings.autoRefresh
    refreshInterval.value = newSettings.refreshInterval
    showEstimatedTime.value = newSettings.showEstimatedTime
    showCustomerNames.value = newSettings.showCustomerNames
    theme.value = newSettings.theme
    fontSize.value = newSettings.fontSize
    urgentThreshold.value = newSettings.urgentThreshold
    warningThreshold.value = newSettings.warningThreshold
    soundVolume.value = newSettings.soundVolume
    keyboardShortcuts.value = newSettings.keyboardShortcuts
  }, { deep: true })

  // Convenient toggle methods
  const toggleAudio = () => {
    updateSetting('audioEnabled', !settings.value.audioEnabled)
  }

  const toggleAutoRefresh = () => {
    updateSetting('autoRefresh', !settings.value.autoRefresh)
  }

  const toggleEstimatedTime = () => {
    updateSetting('showEstimatedTime', !settings.value.showEstimatedTime)
  }

  const toggleCustomerNames = () => {
    updateSetting('showCustomerNames', !settings.value.showCustomerNames)
  }

  const toggleKeyboardShortcuts = () => {
    updateSetting('keyboardShortcuts', !settings.value.keyboardShortcuts)
  }

  const setTheme = (newTheme: 'light' | 'dark' | 'high-contrast') => {
    updateSetting('theme', newTheme)
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  const setFontSize = (newSize: 'normal' | 'large' | 'extra-large') => {
    updateSetting('fontSize', newSize)
    // Apply font size to document
    const sizeClasses = {
      'normal': 'text-base',
      'large': 'text-lg',
      'extra-large': 'text-xl'
    }
    document.documentElement.className = sizeClasses[newSize]
  }

  const setSoundVolume = (volume: number) => {
    const clampedVolume = Math.max(0, Math.min(100, volume))
    updateSetting('soundVolume', clampedVolume)
  }

  const setRefreshInterval = (interval: number) => {
    const clampedInterval = Math.max(5, Math.min(300, interval)) // 5秒到5分鐘
    updateSetting('refreshInterval', clampedInterval)
  }

  const setUrgentThreshold = (threshold: number) => {
    const clampedThreshold = Math.max(1, Math.min(60, threshold)) // 1到60分鐘
    updateSetting('urgentThreshold', clampedThreshold)
  }

  const setWarningThreshold = (threshold: number) => {
    const clampedThreshold = Math.max(1, Math.min(60, threshold)) // 1到60分鐘
    updateSetting('warningThreshold', clampedThreshold)
  }

  // Initialize
  const initialize = () => {
    loadSettings()
    // Apply initial theme and font size
    setTheme(settings.value.theme)
    setFontSize(settings.value.fontSize)
  }

  return {
    // State
    settings,
    
    // Individual settings as refs (for reactivity)
    audioEnabled,
    autoRefresh,
    refreshInterval,
    showEstimatedTime,
    showCustomerNames,
    theme,
    fontSize,
    urgentThreshold,
    warningThreshold,
    soundVolume,
    keyboardShortcuts,
    
    // Actions
    loadSettings,
    saveSettings,
    updateSetting,
    resetSettings,
    initialize,
    
    // Toggle methods
    toggleAudio,
    toggleAutoRefresh,
    toggleEstimatedTime,
    toggleCustomerNames,
    toggleKeyboardShortcuts,
    
    // Setter methods
    setTheme,
    setFontSize,
    setSoundVolume,
    setRefreshInterval,
    setUrgentThreshold,
    setWarningThreshold
  }
})