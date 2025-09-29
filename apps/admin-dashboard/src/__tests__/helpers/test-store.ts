import { createPinia, setActivePinia } from 'pinia'
import { defineStore } from 'pinia'

interface QueueItem {
  id: string
  queueNumber: number
  customerName: string
  partySize: number
  status: string
  joinedAt?: Date
}

// Mock stores for testing
export const useTestQueueStore = defineStore('queue', {
  state: () => ({
    currentQueue: [] as QueueItem[],
    called: [] as QueueItem[],
    seated: [] as QueueItem[]
  }),

  getters: {},

  actions: {
    addCustomer(customer: QueueItem) {
      this.currentQueue.push(customer)
    },
    setCurrentQueue(queue: QueueItem[]) {
      this.currentQueue = queue
    },
    reset() {
      this.currentQueue = []
      this.called = []
      this.seated = []
    }
  }
})

export const useTestApiStore = defineStore('api', {
  state: () => ({
    error: null as any,
    isLoading: false
  }),

  getters: {
    getIsLoading: (state) => state.isLoading
  },

  actions: {
    setError(error: any) {
      this.error = error
    },
    setLoading(loading: boolean) {
      this.isLoading = loading
    }
  }
})

export const useTestRealtimeStore = defineStore('realtime', {
  state: () => ({
    connectionStatus: 'connected' as string
  }),

  actions: {
    setConnectionStatus(status: string) {
      this.connectionStatus = status
    }
  }
})

export const useTestSettingsStore = defineStore('settings', {
  state: () => ({
    language: 'en' as string,
    theme: 'light' as string
  }),

  getters: {
    getLanguage: (state) => state.language,
    getTheme: (state) => state.theme
  },

  actions: {
    setLanguage(language: string) {
      this.language = language
    },
    setTheme(theme: string) {
      this.theme = theme
    }
  }
})

export function createTestStore() {
  const pinia = createPinia()
  setActivePinia(pinia)

  // Create a wrapper that mimics the old Vuex-style API for compatibility
  const mockStore = {
    reset() {
      const queueStore = useTestQueueStore()
      queueStore.reset()
    },

    getters: {
      'api/isLoading': () => {
        const apiStore = useTestApiStore()
        return apiStore.isLoading
      },
      'settings/language': () => {
        const settingsStore = useTestSettingsStore()
        return settingsStore.language
      },
      'settings/theme': () => {
        const settingsStore = useTestSettingsStore()
        return settingsStore.theme
      }
    },

    commit(mutation: string, payload?: any) {
      const [namespace, action] = mutation.split('/')

      if (namespace === 'api' && action === 'setError') {
        const apiStore = useTestApiStore()
        apiStore.setError(payload)
      } else if (namespace === 'realtime' && action === 'setConnectionStatus') {
        const realtimeStore = useTestRealtimeStore()
        realtimeStore.setConnectionStatus(payload)
      } else if (namespace === 'queue' && action === 'setCurrentQueue') {
        const queueStore = useTestQueueStore()
        queueStore.setCurrentQueue(payload)
      }
    },

    dispatch(action: string, payload?: any) {
      const [namespace, actionName] = action.split('/')

      if (namespace === 'queue' && actionName === 'addCustomer') {
        const queueStore = useTestQueueStore()
        queueStore.addCustomer(payload)
      }
    }
  }

  return { ...pinia, ...mockStore }
}