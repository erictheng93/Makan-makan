import { createPinia, setActivePinia } from "pinia";
import { defineStore } from "pinia";

interface QueueItem {
  id: string;
  queueNumber: number;
  customerName: string;
  partySize: number;
  status: string;
  joinedAt?: Date;
}

// Mock stores for testing
export const useTestQueueStore = defineStore("queue", {
  state: () => ({
    currentQueue: [] as QueueItem[],
    called: [] as QueueItem[],
    seated: [] as QueueItem[],
  }),

  getters: {},

  actions: {
    addCustomer(customer: QueueItem) {
      this.currentQueue.push(customer);
    },
    setCurrentQueue(queue: QueueItem[]) {
      this.currentQueue = queue;
    },
    reset() {
      this.currentQueue = [];
      this.called = [];
      this.seated = [];
    },
  },
});

export const useTestApiStore = defineStore("api", {
  state: () => ({
    error: null as never,
    isLoading: false,
  }),

  getters: {
    getIsLoading: (state) => state.isLoading,
  },

  actions: {
    setError(error: any) {
      this.error = error;
    },
    setLoading(loading: boolean) {
      this.isLoading = loading;
    },
  },
});

export const useTestRealtimeStore = defineStore("realtime", {
  state: () => ({
    connectionStatus: "connected" as string,
  }),

  actions: {
    setConnectionStatus(status: string) {
      this.connectionStatus = status;
    },
  },
});

export const useTestSettingsStore = defineStore("settings", {
  state: () => ({
    language: "en" as string,
    theme: "light" as string,
  }),

  getters: {
    getLanguage: (state) => state.language,
    getTheme: (state) => state.theme,
  },

  actions: {
    setLanguage(language: string) {
      this.language = language;
    },
    setTheme(theme: string) {
      this.theme = theme;
    },
  },
});

export function createTestStore() {
  const pinia = createPinia();
  setActivePinia(pinia);

  // Initialize stores
  const queueStore = useTestQueueStore();
  const apiStore = useTestApiStore();
  const realtimeStore = useTestRealtimeStore();
  const settingsStore = useTestSettingsStore();

  // Create a wrapper that mimics the old Vuex-style API for compatibility
  // Use a Proxy to make getters return values directly instead of functions
  const gettersProxy = new Proxy({} as Record<string, any>, {
    get(_target, prop: string) {
      switch (prop) {
        case "api/isLoading":
          return apiStore.isLoading;
        case "settings/language":
          return settingsStore.language;
        case "settings/theme":
          return settingsStore.theme;
        default:
          return undefined;
      }
    },
  });

  const mockStore = {
    reset() {
      queueStore.reset();
    },

    getters: gettersProxy,

    commit(mutation: string, payload?: any) {
      const [namespace, action] = mutation.split("/");

      if (namespace === "api" && action === "setError") {
        apiStore.setError(payload);
      } else if (namespace === "realtime" && action === "setConnectionStatus") {
        realtimeStore.setConnectionStatus(payload);
      } else if (namespace === "queue" && action === "setCurrentQueue") {
        queueStore.setCurrentQueue(payload);
      }
    },

    dispatch(action: string, payload?: any) {
      const [namespace, actionName] = action.split("/");

      if (namespace === "queue" && actionName === "addCustomer") {
        queueStore.addCustomer(payload);
      }
    },
  };

  return { ...pinia, ...mockStore };
}
