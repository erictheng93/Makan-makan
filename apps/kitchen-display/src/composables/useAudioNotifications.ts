import { ref, computed, onMounted, onUnmounted } from 'vue'
import { audioService } from '@/services/audioService'
import type { KitchenOrder, KitchenSSEEvent } from '@/types'

export interface AudioNotificationConfig {
  newOrderSound: boolean
  urgentOrderSound: boolean
  orderReadySound: boolean
  orderCompleteSound: boolean
  warningSound: boolean
  successSound: boolean
  errorSound: boolean
  volume: number
  enabled: boolean
}

export function useAudioNotifications() {
  // State
  const isEnabled = ref(true)
  const config = ref<AudioNotificationConfig>({
    newOrderSound: true,
    urgentOrderSound: true,
    orderReadySound: true,
    orderCompleteSound: true,
    warningSound: true,
    successSound: true,
    errorSound: true,
    volume: 0.7,
    enabled: true
  })

  // Methods
  const playNewOrderSound = async (isUrgent = false) => {
    if (!isEnabled.value || !config.value.enabled) return
    
    try {
      if (isUrgent && config.value.urgentOrderSound) {
        await audioService.playNewOrder(true)
      } else if (config.value.newOrderSound) {
        await audioService.playNewOrder(false)
      }
    } catch (error) {
      console.error('Failed to play new order sound:', error)
    }
  }

  const playOrderReadySound = async () => {
    if (!isEnabled.value || !config.value.enabled || !config.value.orderReadySound) return
    
    try {
      await audioService.playOrderReady()
    } catch (error) {
      console.error('Failed to play order ready sound:', error)
    }
  }

  const playOrderCompleteSound = async () => {
    if (!isEnabled.value || !config.value.enabled || !config.value.orderCompleteSound) return
    
    try {
      await audioService.playOrderComplete()
    } catch (error) {
      console.error('Failed to play order complete sound:', error)
    }
  }

  const playWarningSound = async () => {
    if (!isEnabled.value || !config.value.enabled || !config.value.warningSound) return
    
    try {
      await audioService.playWarning()
    } catch (error) {
      console.error('Failed to play warning sound:', error)
    }
  }

  const playSuccessSound = async () => {
    if (!isEnabled.value || !config.value.enabled || !config.value.successSound) return
    
    try {
      await audioService.playSuccess()
    } catch (error) {
      console.error('Failed to play success sound:', error)
    }
  }

  const playErrorSound = async () => {
    if (!isEnabled.value || !config.value.enabled || !config.value.errorSound) return
    
    try {
      await audioService.playError()
    } catch (error) {
      console.error('Failed to play error sound:', error)
    }
  }

  // SSE Event Handlers
  const handleSSEEvent = async (event: KitchenSSEEvent) => {
    switch (event.type) {
      case 'NEW_ORDER':
        await playNewOrderSound(event.payload?.priority === 'urgent')
        break
      case 'ORDER_STATUS_UPDATE':
        if (event.payload?.status === 'ready') {
          await playOrderReadySound()
        } else if (event.payload?.status === 'completed') {
          await playOrderCompleteSound()
        }
        break
      case 'ORDER_CANCELLED':
        await playWarningSound()
        break
      case 'PRIORITY_UPDATE':
        if (event.payload?.priority === 'urgent') {
          await playNewOrderSound(true)
        }
        break
    }
  }

  // Order Event Handlers
  const handleOrderStartCooking = async () => {
    await playSuccessSound()
  }

  const handleOrderMarkReady = async () => {
    await playOrderReadySound()
  }

  const handleOrderComplete = async () => {
    await playOrderCompleteSound()
  }

  const handleBatchOperation = async (count: number) => {
    // Play different sounds based on batch size
    if (count > 10) {
      await audioService.play('chime', { repeat: 3, priority: 'high' })
    } else if (count > 5) {
      await audioService.play('chime', { repeat: 2, priority: 'medium' })
    } else {
      await playSuccessSound()
    }
  }

  // Time-based notifications
  const checkOrderTimes = async (orders: KitchenOrder[]) => {
    if (!isEnabled.value) return

    const now = Date.now()
    const overdueOrders = orders.filter(order => {
      const elapsedMinutes = Math.floor((now - new Date(order.createdAt).getTime()) / (1000 * 60))
      return elapsedMinutes >= 30 && order.status !== 3 // Not ready yet
    })

    if (overdueOrders.length > 0) {
      await playWarningSound()
    }

    // Check for orders approaching estimated completion time
    const nearCompletionOrders = orders.filter(order => {
      const elapsedMinutes = Math.floor((now - new Date(order.createdAt).getTime()) / (1000 * 60))
      const estimatedTime = order.estimatedTime || 15
      return elapsedMinutes >= estimatedTime * 0.8 && order.status === 2 // Still preparing
    })

    if (nearCompletionOrders.length > 0) {
      await audioService.play('notification', { priority: 'low' })
    }
  }

  // Configuration management
  const updateConfig = (newConfig: Partial<AudioNotificationConfig>) => {
    config.value = { ...config.value, ...newConfig }
    localStorage.setItem('kitchen-audio-notifications', JSON.stringify(config.value))
    
    // Update audio service settings
    audioService.updateSettings({
      enabled: config.value.enabled,
      masterVolume: config.value.volume
    })
  }

  const loadConfig = () => {
    const saved = localStorage.getItem('kitchen-audio-notifications')
    if (saved) {
      config.value = { ...config.value, ...JSON.parse(saved) }
    }
  }

  const resetConfig = () => {
    config.value = {
      newOrderSound: true,
      urgentOrderSound: true,
      orderReadySound: true,
      orderCompleteSound: true,
      warningSound: true,
      successSound: true,
      errorSound: true,
      volume: 0.7,
      enabled: true
    }
    updateConfig(config.value)
  }

  // Enable/disable methods
  const enable = () => {
    isEnabled.value = true
    audioService.enable()
  }

  const disable = () => {
    isEnabled.value = false
    audioService.disable()
  }

  const toggle = () => {
    if (isEnabled.value) {
      disable()
    } else {
      enable()
    }
  }

  // Volume control
  const setVolume = (volume: number) => {
    config.value.volume = Math.max(0, Math.min(1, volume))
    audioService.setMasterVolume(config.value.volume)
    updateConfig({ volume: config.value.volume })
  }

  // Testing methods
  const testNotifications = async () => {
    if (!isEnabled.value) return

    const tests = [
      { name: '新訂單', fn: () => playNewOrderSound() },
      { name: '緊急訂單', fn: () => playNewOrderSound(true) },
      { name: '訂單準備完成', fn: () => playOrderReadySound() },
      { name: '訂單完成', fn: () => playOrderCompleteSound() },
      { name: '成功操作', fn: () => playSuccessSound() }
    ]

    for (const test of tests) {
      console.log(`Testing: ${test.name}`)
      await test.fn()
      await new Promise(resolve => setTimeout(resolve, 1000)) // Wait between tests
    }
  }

  // Time-based monitoring
  let timeCheckInterval: NodeJS.Timeout | null = null

  const startTimeMonitoring = (orders: KitchenOrder[]) => {
    if (timeCheckInterval) return

    timeCheckInterval = setInterval(() => {
      checkOrderTimes(orders)
    }, 60000) // Check every minute
  }

  const stopTimeMonitoring = () => {
    if (timeCheckInterval) {
      clearInterval(timeCheckInterval)
      timeCheckInterval = null
    }
  }

  // Computed
  const isAudioEnabled = computed(() => isEnabled.value && config.value.enabled)
  const currentVolume = computed(() => config.value.volume)
  
  // Lifecycle
  onMounted(() => {
    loadConfig()
  })

  onUnmounted(() => {
    stopTimeMonitoring()
  })

  return {
    // State
    isEnabled: isAudioEnabled,
    config,
    currentVolume,

    // Methods
    playNewOrderSound,
    playOrderReadySound,
    playOrderCompleteSound,
    playWarningSound,
    playSuccessSound,
    playErrorSound,

    // Event Handlers
    handleSSEEvent,
    handleOrderStartCooking,
    handleOrderMarkReady,
    handleOrderComplete,
    handleBatchOperation,

    // Configuration
    updateConfig,
    resetConfig,
    
    // Control
    enable,
    disable,
    toggle,
    setVolume,

    // Testing
    testNotifications,

    // Monitoring
    startTimeMonitoring,
    stopTimeMonitoring,
    checkOrderTimes
  }
}