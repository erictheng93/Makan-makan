import { createPinia, setActivePinia } from "pinia";
import { defineStore } from "pinia";

// Mock stores for testing
export const useTestQueueStore = defineStore("queue", {
  state: () => ({
    currentQueue: [],
    called: [],
    seated: [],
  }),
  getters: {},
  actions: {
    addCustomer(customer) {
      this.currentQueue.push(customer);
    },
    setCurrentQueue(queue) {
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
    error: null,
    isLoading: false,
  }),
  getters: {
    getIsLoading: (state) => state.isLoading,
  },
  actions: {
    setError(error) {
      this.error = error;
    },
    setLoading(loading) {
      this.isLoading = loading;
    },
  },
});

export const useTestRealtimeStore = defineStore("realtime", {
  state: () => ({
    connectionStatus: "connected",
  }),
  actions: {
    setConnectionStatus(status) {
      this.connectionStatus = status;
    },
  },
});

export const useTestSettingsStore = defineStore("settings", {
  state: () => ({
    language: "en",
    theme: "light",
  }),
  getters: {
    getLanguage: (state) => state.language,
    getTheme: (state) => state.theme,
  },
  actions: {
    setLanguage(language) {
      this.language = language;
    },
    setTheme(theme) {
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
  const gettersProxy = new Proxy(
    {},
    {
      get(_target, prop) {
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
    },
  );

  const mockStore = {
    reset() {
      queueStore.reset();
    },

    getters: gettersProxy,

    commit(mutation, payload) {
      const [namespace, action] = mutation.split("/");

      if (namespace === "api" && action === "setError") {
        apiStore.setError(payload);
      } else if (namespace === "realtime" && action === "setConnectionStatus") {
        realtimeStore.setConnectionStatus(payload);
      } else if (namespace === "queue" && action === "setCurrentQueue") {
        queueStore.setCurrentQueue(payload);
      }
    },

    dispatch(action, payload) {
      const [namespace, actionName] = action.split("/");

      if (namespace === "queue" && actionName === "addCustomer") {
        queueStore.addCustomer(payload);
      }
    },
  };

  return { ...pinia, ...mockStore };
}
