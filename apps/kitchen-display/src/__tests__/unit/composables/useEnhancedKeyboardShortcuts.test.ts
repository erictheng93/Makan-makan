/**
 * useEnhancedKeyboardShortcuts Composable 測試
 *
 * 測試範圍：
 * - 增強型快捷鍵執行和視覺回饋
 * - 快捷鍵執行統計
 * - 自訂快捷鍵管理
 * - 錄製模式
 * - 各種訂單操作快捷鍵
 * - 篩選和導航快捷鍵
 * - 系統快捷鍵
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ref, computed, nextTick } from "vue";

// Mock vue-toastification
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
};

vi.mock("vue-toastification", () => ({
  useToast: () => mockToast,
}));

// Mock audio service
const mockAudioService = {
  playSound: vi.fn(),
  toggleEnabled: vi.fn(),
  settings: { enabled: true },
};

// Mock order management store
const mockOrderStore = {
  selectedOrders: new Set<number>(),
  focusedOrder: null as any,
  selectNextOrder: vi.fn(),
  selectPreviousOrder: vi.fn(),
  selectFirstOrder: vi.fn(),
  selectLastOrder: vi.fn(),
  selectAllVisibleOrders: vi.fn(),
  updateOrderPriorities: vi.fn().mockImplementation((orders) => orders),
  applyFilter: vi.fn(),
  batchOperation: vi.fn(),
  refreshOrders: vi.fn(),
};

// 類型定義
interface KeyboardShortcut {
  id: string;
  name: string;
  description: string;
  keys: string[];
  action: string;
  category: "orders" | "navigation" | "system" | "filters" | "audio";
  enabled: boolean;
  global?: boolean;
  context?: string;
  customizable?: boolean;
  visual?: {
    icon?: string;
    color?: string;
    animation?: string;
  };
}

interface ShortcutExecution {
  shortcutId: string;
  timestamp: number;
  success: boolean;
  context?: string;
  executionTime: number;
}

interface ShortcutStats {
  totalExecutions: number;
  successRate: number;
  averageExecutionTime: number;
  mostUsed: { shortcutId: string; count: number }[];
  recentExecutions: ShortcutExecution[];
}

// 模擬 useEnhancedKeyboardShortcuts composable
function createMockUseEnhancedKeyboardShortcuts(orders = ref<any[]>([])) {
  const enabled = ref(true);
  const showVisualFeedback = ref(true);
  const recordingMode = ref(false);
  const recordingKeys = ref<string[]>([]);
  const pressedKeys = ref(new Set<string>());
  const keySequence = ref<string[]>([]);
  const lastKeyTime = ref(0);
  const executionHistory = ref<ShortcutExecution[]>([]);

  const visualFeedback = ref<{
    show: boolean;
    message: string;
    type: "success" | "error" | "info";
    position: { x: number; y: number };
  }>({
    show: false,
    message: "",
    type: "info",
    position: { x: 0, y: 0 },
  });

  const shortcuts = ref<KeyboardShortcut[]>([
    {
      id: "complete_order",
      name: "標記完成",
      description: "將選中的訂單標記為完成",
      keys: ["Space"],
      action: "complete_selected_order",
      category: "orders",
      enabled: true,
      visual: { icon: "✅", color: "green", animation: "bounce" },
    },
    {
      id: "start_cooking",
      name: "開始製作",
      description: "開始製作選中的訂單",
      keys: ["Enter"],
      action: "start_cooking_selected",
      category: "orders",
      enabled: true,
      visual: { icon: "🍳", color: "orange", animation: "pulse" },
    },
    {
      id: "toggle_priority",
      name: "切換優先級",
      description: "切換訂單優先級",
      keys: ["p"],
      action: "toggle_order_priority",
      category: "orders",
      enabled: true,
      visual: { icon: "⚡", color: "red", animation: "shake" },
    },
    {
      id: "next_order",
      name: "下一個訂單",
      description: "選擇下一個訂單",
      keys: ["ArrowDown"],
      action: "select_next_order",
      category: "navigation",
      enabled: true,
      global: true,
    },
    {
      id: "prev_order",
      name: "上一個訂單",
      description: "選擇上一個訂單",
      keys: ["ArrowUp"],
      action: "select_prev_order",
      category: "navigation",
      enabled: true,
      global: true,
    },
    {
      id: "filter_pending",
      name: "篩選待處理",
      description: "顯示待處理訂單",
      keys: ["1"],
      action: "filter_pending",
      category: "filters",
      enabled: true,
      visual: { icon: "⏳", color: "yellow" },
    },
    {
      id: "filter_all",
      name: "顯示全部",
      description: "顯示所有訂單",
      keys: ["0"],
      action: "filter_all",
      category: "filters",
      enabled: true,
      visual: { icon: "📋", color: "blue" },
    },
    {
      id: "toggle_audio",
      name: "音效開關",
      description: "開啟或關閉音效",
      keys: ["m"],
      action: "toggle_audio",
      category: "audio",
      enabled: true,
      global: true,
      visual: { icon: "🔊", color: "purple" },
    },
    {
      id: "fullscreen",
      name: "全螢幕模式",
      description: "切換全螢幕顯示",
      keys: ["f"],
      action: "toggle_fullscreen",
      category: "system",
      enabled: true,
      global: true,
      visual: { icon: "🖥️", color: "gray" },
    },
    {
      id: "refresh",
      name: "重新整理",
      description: "重新載入資料",
      keys: ["F5"],
      action: "refresh_data",
      category: "system",
      enabled: true,
      global: true,
      visual: { icon: "🔄", color: "blue", animation: "spin" },
    },
    {
      id: "help",
      name: "顯示幫助",
      description: "顯示快捷鍵幫助",
      keys: ["?"],
      action: "show_help",
      category: "system",
      enabled: true,
      global: true,
    },
    {
      id: "select_all",
      name: "選擇全部",
      description: "選擇所有可見訂單",
      keys: ["Ctrl", "a"],
      action: "select_all_orders",
      category: "orders",
      enabled: true,
    },
    {
      id: "disabled_shortcut",
      name: "已停用",
      description: "測試用停用快捷鍵",
      keys: ["x"],
      action: "disabled_action",
      category: "system",
      enabled: false,
    },
  ]);

  // Computed properties
  const shortcutsByCategory = computed(() => {
    const categories: Record<string, KeyboardShortcut[]> = {};
    shortcuts.value.forEach((shortcut) => {
      if (!categories[shortcut.category]) {
        categories[shortcut.category] = [];
      }
      categories[shortcut.category].push(shortcut);
    });
    return categories;
  });

  const enabledShortcuts = computed(() =>
    shortcuts.value.filter((s) => s.enabled),
  );

  const stats = computed((): ShortcutStats => {
    const total = executionHistory.value.length;
    const successful = executionHistory.value.filter((e) => e.success).length;

    const usageCounts: Record<string, number> = {};
    executionHistory.value.forEach((execution) => {
      usageCounts[execution.shortcutId] =
        (usageCounts[execution.shortcutId] || 0) + 1;
    });

    const mostUsed = Object.entries(usageCounts)
      .map(([shortcutId, count]) => ({ shortcutId, count: Number(count) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const avgTime =
      total > 0
        ? executionHistory.value.reduce((sum, e) => sum + e.executionTime, 0) /
          total
        : 0;

    return {
      totalExecutions: total,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      averageExecutionTime: avgTime,
      mostUsed,
      recentExecutions: executionHistory.value.slice(-10),
    };
  });

  // Utility functions
  const normalizeKey = (key: string): string => {
    if (key === " ") return "Space";
    if (key === "Control") return "Ctrl";
    if (key === "Meta") return "Cmd";
    return key;
  };

  const findMatchingShortcut = (
    pressedKeysArray: string[],
  ): KeyboardShortcut | null => {
    return (
      enabledShortcuts.value.find((shortcut) => {
        if (shortcut.keys.length !== pressedKeysArray.length) return false;
        return shortcut.keys.every((key) => pressedKeysArray.includes(key));
      }) || null
    );
  };

  const isInputElement = (target: EventTarget | null): boolean => {
    if (!target) return false;
    const element = target as HTMLElement;
    const tagName = element.tagName?.toLowerCase();
    return (
      tagName === "input" ||
      tagName === "textarea" ||
      tagName === "select" ||
      element.contentEditable === "true"
    );
  };

  const isGlobalShortcut = (keys: string[]): boolean => {
    return enabledShortcuts.value.some(
      (shortcut) =>
        shortcut.global &&
        shortcut.keys.some((shortcutKey) => keys.includes(shortcutKey)),
    );
  };

  // Action implementations
  const completeSelectedOrder = async (): Promise<boolean> => {
    const selectedOrders = Array.from(mockOrderStore.selectedOrders);
    if (selectedOrders.length === 0) {
      mockToast.warning("請先選擇一個訂單");
      return false;
    }
    mockToast.success(`已完成 ${selectedOrders.length} 個訂單`);
    return true;
  };

  const startCookingSelected = async (): Promise<boolean> => {
    const selectedOrders = Array.from(mockOrderStore.selectedOrders);
    if (selectedOrders.length === 0) {
      mockToast.warning("請先選擇一個訂單");
      return false;
    }
    mockToast.success(`開始製作 ${selectedOrders.length} 個訂單`);
    return true;
  };

  const toggleOrderPriority = async (): Promise<boolean> => {
    const selectedOrderIds = Array.from(mockOrderStore.selectedOrders);
    if (selectedOrderIds.length === 0) {
      mockToast.warning("請先選擇一個訂單");
      return false;
    }
    mockToast.success("訂單優先級已更新");
    return true;
  };

  const selectNextOrder = (): boolean => {
    mockOrderStore.selectNextOrder();
    return true;
  };

  const selectPreviousOrder = (): boolean => {
    mockOrderStore.selectPreviousOrder();
    return true;
  };

  const selectFirstOrder = (): boolean => {
    mockOrderStore.selectFirstOrder();
    return true;
  };

  const selectLastOrder = (): boolean => {
    mockOrderStore.selectLastOrder();
    return true;
  };

  const applyFilter = async (filter: string): Promise<boolean> => {
    await mockOrderStore.applyFilter(filter, {});
    mockToast.success(`已應用 ${filter} 篩選`);
    return true;
  };

  const toggleAudio = (): boolean => {
    mockAudioService.toggleEnabled();
    const status = mockAudioService.settings.enabled ? "已啟用" : "已停用";
    mockToast.info(`音效 ${status}`);
    return true;
  };

  const toggleFullscreen = (): boolean => {
    mockToast.info("切換全螢幕模式");
    return true;
  };

  const refreshData = async (): Promise<boolean> => {
    await mockOrderStore.refreshOrders();
    mockToast.success("資料已更新");
    return true;
  };

  const showHelp = (): boolean => {
    mockToast.info("快捷鍵幫助已開啟");
    return true;
  };

  const selectAllOrders = (): boolean => {
    mockOrderStore.selectAllVisibleOrders();
    mockToast.info("已選擇所有可見訂單");
    return true;
  };

  const batchStartCooking = async (): Promise<boolean> => {
    const selectedOrders = Array.from(mockOrderStore.selectedOrders);
    if (selectedOrders.length === 0) {
      mockToast.warning("請先選擇訂單");
      return false;
    }
    await mockOrderStore.batchOperation("start_cooking", selectedOrders);
    mockToast.success(`已開始製作 ${selectedOrders.length} 個訂單`);
    return true;
  };

  const showQuickSearch = (): boolean => {
    mockToast.info("搜尋功能開啟");
    return true;
  };

  // Execute shortcut
  const executeShortcut = async (
    shortcut: KeyboardShortcut,
  ): Promise<boolean> => {
    try {
      switch (shortcut.action) {
        case "complete_selected_order":
          return await completeSelectedOrder();
        case "start_cooking_selected":
          return await startCookingSelected();
        case "toggle_order_priority":
          return await toggleOrderPriority();
        case "select_next_order":
          return selectNextOrder();
        case "select_prev_order":
          return selectPreviousOrder();
        case "select_first_order":
          return selectFirstOrder();
        case "select_last_order":
          return selectLastOrder();
        case "filter_pending":
          return await applyFilter("pending");
        case "filter_cooking":
          return await applyFilter("cooking");
        case "filter_ready":
          return await applyFilter("ready");
        case "filter_all":
          return await applyFilter("all");
        case "toggle_audio":
          return toggleAudio();
        case "toggle_fullscreen":
          return toggleFullscreen();
        case "refresh_data":
          return await refreshData();
        case "show_help":
          return showHelp();
        case "select_all_orders":
          return selectAllOrders();
        case "batch_start_cooking":
          return await batchStartCooking();
        case "quick_search":
          return showQuickSearch();
        default:
          console.warn(`Unknown shortcut action: ${shortcut.action}`);
          return false;
      }
    } catch (error) {
      console.error(`Error executing shortcut ${shortcut.id}:`, error);
      mockToast.error(`執行快捷鍵失敗: ${shortcut.name}`);
      return false;
    }
  };

  // Record execution
  const recordExecution = (
    shortcutId: string,
    success: boolean,
    executionTime: number,
  ) => {
    const execution: ShortcutExecution = {
      shortcutId,
      timestamp: Date.now(),
      success,
      executionTime,
    };

    executionHistory.value.unshift(execution);

    if (executionHistory.value.length > 100) {
      executionHistory.value = executionHistory.value.slice(0, 100);
    }
  };

  // Simulate key press and execution
  const simulateKeyPress = async (
    keys: string[],
  ): Promise<{
    action: string | null;
    success: boolean;
  }> => {
    if (!enabled.value) return { action: null, success: false };

    const normalizedKeys = keys.map(normalizeKey);
    pressedKeys.value = new Set(normalizedKeys);

    const shortcut = findMatchingShortcut(normalizedKeys);

    if (shortcut) {
      const startTime = performance.now();
      const success = await executeShortcut(shortcut);
      const executionTime = performance.now() - startTime;

      recordExecution(shortcut.id, success, executionTime);

      if (success) {
        mockAudioService.playSound("tick", { volume: 0.3 });
      } else {
        mockAudioService.playSound("error", { volume: 0.4 });
      }

      return { action: shortcut.action, success };
    }

    return { action: null, success: false };
  };

  // Show visual feedback
  const showVisualShortcutFeedback = (
    shortcut: KeyboardShortcut,
    success: boolean,
  ) => {
    visualFeedback.value = {
      show: true,
      message: success ? shortcut.name : `${shortcut.name} 失敗`,
      type: success ? "success" : "error",
      position: {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      },
    };

    setTimeout(() => {
      visualFeedback.value.show = false;
    }, 1500);
  };

  // Custom shortcut management
  const addCustomShortcut = (
    shortcut: Omit<KeyboardShortcut, "id">,
  ): string => {
    const id = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newShortcut: KeyboardShortcut = {
      id,
      customizable: true,
      ...shortcut,
    };

    shortcuts.value.push(newShortcut);
    return id;
  };

  const updateShortcut = (
    id: string,
    updates: Partial<KeyboardShortcut>,
  ): boolean => {
    const index = shortcuts.value.findIndex((s) => s.id === id);
    if (index === -1) return false;

    shortcuts.value[index] = { ...shortcuts.value[index], ...updates };
    return true;
  };

  const removeShortcut = (id: string): boolean => {
    const index = shortcuts.value.findIndex(
      (s) => s.id === id && s.customizable,
    );
    if (index === -1) return false;

    shortcuts.value.splice(index, 1);
    return true;
  };

  // Recording mode
  const startRecording = () => {
    recordingMode.value = true;
    recordingKeys.value = [];
    mockToast.info("開始錄製快捷鍵，按下想要的組合鍵...");
  };

  const stopRecording = (): string[] => {
    recordingMode.value = false;
    const keys = [...recordingKeys.value];
    recordingKeys.value = [];
    mockToast.success(`錄製完成: ${keys.join(" + ")}`);
    return keys;
  };

  const recordKey = (key: string) => {
    if (recordingMode.value && !recordingKeys.value.includes(key)) {
      recordingKeys.value.push(key);
    }
  };

  return {
    // State
    enabled,
    showVisualFeedback,
    recordingMode,
    recordingKeys,
    shortcuts,
    shortcutsByCategory,
    enabledShortcuts,
    stats,
    visualFeedback,
    executionHistory,
    pressedKeys,

    // Methods
    executeShortcut,
    simulateKeyPress,
    addCustomShortcut,
    updateShortcut,
    removeShortcut,
    startRecording,
    stopRecording,
    recordKey,
    showVisualShortcutFeedback,
    recordExecution,

    // Utility
    normalizeKey,
    findMatchingShortcut,
    isInputElement,
    isGlobalShortcut,
  };
}

describe("useEnhancedKeyboardShortcuts", () => {
  let enhancedShortcuts: ReturnType<
    typeof createMockUseEnhancedKeyboardShortcuts
  >;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockOrderStore.selectedOrders = new Set<number>();
    mockOrderStore.focusedOrder = null;
    enhancedShortcuts = createMockUseEnhancedKeyboardShortcuts();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("初始狀態", () => {
    it("應該初始化為啟用狀態", () => {
      expect(enhancedShortcuts.enabled.value).toBe(true);
    });

    it("應該初始化視覺回饋為啟用", () => {
      expect(enhancedShortcuts.showVisualFeedback.value).toBe(true);
    });

    it("應該初始化錄製模式為停用", () => {
      expect(enhancedShortcuts.recordingMode.value).toBe(false);
    });

    it("應該有預設快捷鍵列表", () => {
      expect(enhancedShortcuts.shortcuts.value.length).toBeGreaterThan(0);
    });

    it("應該初始化空的執行歷史", () => {
      expect(enhancedShortcuts.executionHistory.value.length).toBe(0);
    });

    it("應該初始化統計為零", () => {
      const stats = enhancedShortcuts.stats.value;
      expect(stats.totalExecutions).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.averageExecutionTime).toBe(0);
    });
  });

  describe("快捷鍵執行", () => {
    it("應該執行導航快捷鍵", async () => {
      const result = await enhancedShortcuts.simulateKeyPress(["ArrowDown"]);

      expect(result.action).toBe("select_next_order");
      expect(result.success).toBe(true);
      expect(mockOrderStore.selectNextOrder).toHaveBeenCalled();
    });

    it("應該執行篩選快捷鍵", async () => {
      const result = await enhancedShortcuts.simulateKeyPress(["1"]);

      expect(result.action).toBe("filter_pending");
      expect(result.success).toBe(true);
      expect(mockOrderStore.applyFilter).toHaveBeenCalledWith("pending", {});
    });

    it("應該執行音效切換快捷鍵", async () => {
      const result = await enhancedShortcuts.simulateKeyPress(["m"]);

      expect(result.action).toBe("toggle_audio");
      expect(result.success).toBe(true);
      expect(mockAudioService.toggleEnabled).toHaveBeenCalled();
    });

    it("應該執行重新整理快捷鍵", async () => {
      const result = await enhancedShortcuts.simulateKeyPress(["F5"]);

      expect(result.action).toBe("refresh_data");
      expect(result.success).toBe(true);
      expect(mockOrderStore.refreshOrders).toHaveBeenCalled();
    });

    it("應該忽略停用的快捷鍵", async () => {
      const result = await enhancedShortcuts.simulateKeyPress(["x"]);

      expect(result.action).toBeNull();
      expect(result.success).toBe(false);
    });

    it("應該在全局停用時不執行", async () => {
      enhancedShortcuts.enabled.value = false;

      const result = await enhancedShortcuts.simulateKeyPress(["ArrowDown"]);

      expect(result.action).toBeNull();
      expect(result.success).toBe(false);
    });
  });

  describe("訂單操作快捷鍵", () => {
    describe("無選中訂單時", () => {
      it("完成訂單應該顯示警告", async () => {
        const result = await enhancedShortcuts.simulateKeyPress(["Space"]);

        expect(result.success).toBe(false);
        expect(mockToast.warning).toHaveBeenCalledWith("請先選擇一個訂單");
      });

      it("開始製作應該顯示警告", async () => {
        const result = await enhancedShortcuts.simulateKeyPress(["Enter"]);

        expect(result.success).toBe(false);
        expect(mockToast.warning).toHaveBeenCalledWith("請先選擇一個訂單");
      });

      it("切換優先級應該顯示警告", async () => {
        const result = await enhancedShortcuts.simulateKeyPress(["p"]);

        expect(result.success).toBe(false);
        expect(mockToast.warning).toHaveBeenCalledWith("請先選擇一個訂單");
      });
    });

    describe("有選中訂單時", () => {
      beforeEach(() => {
        mockOrderStore.selectedOrders = new Set([1, 2, 3]);
      });

      it("完成訂單應該成功", async () => {
        const result = await enhancedShortcuts.simulateKeyPress(["Space"]);

        expect(result.success).toBe(true);
        expect(mockToast.success).toHaveBeenCalledWith("已完成 3 個訂單");
      });

      it("開始製作應該成功", async () => {
        const result = await enhancedShortcuts.simulateKeyPress(["Enter"]);

        expect(result.success).toBe(true);
        expect(mockToast.success).toHaveBeenCalledWith("開始製作 3 個訂單");
      });

      it("切換優先級應該成功", async () => {
        const result = await enhancedShortcuts.simulateKeyPress(["p"]);

        expect(result.success).toBe(true);
        expect(mockToast.success).toHaveBeenCalledWith("訂單優先級已更新");
      });
    });
  });

  describe("組合鍵", () => {
    it("應該正確處理 Ctrl+A 組合鍵", async () => {
      const result = await enhancedShortcuts.simulateKeyPress(["Ctrl", "a"]);

      expect(result.action).toBe("select_all_orders");
      expect(result.success).toBe(true);
      expect(mockOrderStore.selectAllVisibleOrders).toHaveBeenCalled();
    });

    it("應該忽略不完整的組合鍵", async () => {
      const result = await enhancedShortcuts.simulateKeyPress(["Ctrl"]);

      expect(result.action).toBeNull();
    });
  });

  describe("執行統計", () => {
    it("應該記錄成功執行", async () => {
      await enhancedShortcuts.simulateKeyPress(["ArrowDown"]);

      expect(enhancedShortcuts.executionHistory.value.length).toBe(1);
      expect(enhancedShortcuts.executionHistory.value[0].success).toBe(true);
    });

    it("應該記錄失敗執行", async () => {
      mockOrderStore.selectedOrders = new Set();
      await enhancedShortcuts.simulateKeyPress(["Space"]);

      expect(enhancedShortcuts.executionHistory.value.length).toBe(1);
      expect(enhancedShortcuts.executionHistory.value[0].success).toBe(false);
    });

    it("應該計算正確的統計數據", async () => {
      // 執行一些成功的操作
      await enhancedShortcuts.simulateKeyPress(["ArrowDown"]);
      await enhancedShortcuts.simulateKeyPress(["ArrowUp"]);
      await enhancedShortcuts.simulateKeyPress(["1"]);

      // 執行一個失敗的操作
      mockOrderStore.selectedOrders = new Set();
      await enhancedShortcuts.simulateKeyPress(["Space"]);

      const stats = enhancedShortcuts.stats.value;
      expect(stats.totalExecutions).toBe(4);
      expect(stats.successRate).toBe(75); // 3/4 = 75%
    });

    it("應該追蹤最常使用的快捷鍵", async () => {
      await enhancedShortcuts.simulateKeyPress(["ArrowDown"]);
      await enhancedShortcuts.simulateKeyPress(["ArrowDown"]);
      await enhancedShortcuts.simulateKeyPress(["ArrowDown"]);
      await enhancedShortcuts.simulateKeyPress(["ArrowUp"]);

      const stats = enhancedShortcuts.stats.value;
      expect(stats.mostUsed[0].shortcutId).toBe("next_order");
      expect(stats.mostUsed[0].count).toBe(3);
    });

    it("應該限制執行歷史為 100 筆", () => {
      for (let i = 0; i < 150; i++) {
        enhancedShortcuts.recordExecution(`shortcut_${i}`, true, 10);
      }

      expect(enhancedShortcuts.executionHistory.value.length).toBe(100);
    });
  });

  describe("音效回饋", () => {
    it("應該在成功時播放 tick 音效", async () => {
      await enhancedShortcuts.simulateKeyPress(["ArrowDown"]);

      expect(mockAudioService.playSound).toHaveBeenCalledWith("tick", {
        volume: 0.3,
      });
    });

    it("應該在失敗時播放 error 音效", async () => {
      mockOrderStore.selectedOrders = new Set();
      await enhancedShortcuts.simulateKeyPress(["Space"]);

      expect(mockAudioService.playSound).toHaveBeenCalledWith("error", {
        volume: 0.4,
      });
    });
  });

  describe("視覺回饋", () => {
    it("應該顯示成功回饋", () => {
      const shortcut = enhancedShortcuts.shortcuts.value[0];
      enhancedShortcuts.showVisualShortcutFeedback(shortcut, true);

      expect(enhancedShortcuts.visualFeedback.value.show).toBe(true);
      expect(enhancedShortcuts.visualFeedback.value.type).toBe("success");
      expect(enhancedShortcuts.visualFeedback.value.message).toBe(
        shortcut.name,
      );
    });

    it("應該顯示失敗回饋", () => {
      const shortcut = enhancedShortcuts.shortcuts.value[0];
      enhancedShortcuts.showVisualShortcutFeedback(shortcut, false);

      expect(enhancedShortcuts.visualFeedback.value.show).toBe(true);
      expect(enhancedShortcuts.visualFeedback.value.type).toBe("error");
      expect(enhancedShortcuts.visualFeedback.value.message).toContain("失敗");
    });

    it("應該在 1.5 秒後隱藏回饋", () => {
      const shortcut = enhancedShortcuts.shortcuts.value[0];
      enhancedShortcuts.showVisualShortcutFeedback(shortcut, true);

      expect(enhancedShortcuts.visualFeedback.value.show).toBe(true);

      vi.advanceTimersByTime(1500);

      expect(enhancedShortcuts.visualFeedback.value.show).toBe(false);
    });
  });

  describe("自訂快捷鍵管理", () => {
    it("應該成功新增自訂快捷鍵", () => {
      const initialLength = enhancedShortcuts.shortcuts.value.length;

      const id = enhancedShortcuts.addCustomShortcut({
        name: "自訂快捷鍵",
        description: "測試",
        keys: ["y"],
        action: "custom_action",
        category: "system",
        enabled: true,
      });

      expect(enhancedShortcuts.shortcuts.value.length).toBe(initialLength + 1);
      expect(id).toContain("custom_");
    });

    it("應該成功更新快捷鍵", () => {
      const result = enhancedShortcuts.updateShortcut("complete_order", {
        name: "更新後的名稱",
      });

      expect(result).toBe(true);
      const shortcut = enhancedShortcuts.shortcuts.value.find(
        (s) => s.id === "complete_order",
      );
      expect(shortcut?.name).toBe("更新後的名稱");
    });

    it("更新不存在的快捷鍵應該返回 false", () => {
      const result = enhancedShortcuts.updateShortcut("non_existent", {
        name: "新名稱",
      });

      expect(result).toBe(false);
    });

    it("應該只能刪除可自訂的快捷鍵", () => {
      const id = enhancedShortcuts.addCustomShortcut({
        name: "自訂",
        description: "測試",
        keys: ["y"],
        action: "test",
        category: "system",
        enabled: true,
      });

      const result = enhancedShortcuts.removeShortcut(id);
      expect(result).toBe(true);

      // 嘗試刪除內建快捷鍵
      const builtInResult = enhancedShortcuts.removeShortcut("complete_order");
      expect(builtInResult).toBe(false);
    });
  });

  describe("錄製模式", () => {
    it("應該成功開始錄製", () => {
      enhancedShortcuts.startRecording();

      expect(enhancedShortcuts.recordingMode.value).toBe(true);
      expect(enhancedShortcuts.recordingKeys.value.length).toBe(0);
      expect(mockToast.info).toHaveBeenCalledWith(
        "開始錄製快捷鍵，按下想要的組合鍵...",
      );
    });

    it("應該錄製按下的按鍵", () => {
      enhancedShortcuts.startRecording();
      enhancedShortcuts.recordKey("Ctrl");
      enhancedShortcuts.recordKey("Shift");
      enhancedShortcuts.recordKey("s");

      expect(enhancedShortcuts.recordingKeys.value).toEqual([
        "Ctrl",
        "Shift",
        "s",
      ]);
    });

    it("應該忽略重複的按鍵", () => {
      enhancedShortcuts.startRecording();
      enhancedShortcuts.recordKey("Ctrl");
      enhancedShortcuts.recordKey("Ctrl");
      enhancedShortcuts.recordKey("Ctrl");

      expect(enhancedShortcuts.recordingKeys.value).toEqual(["Ctrl"]);
    });

    it("應該在非錄製模式時不錄製", () => {
      enhancedShortcuts.recordKey("a");

      expect(enhancedShortcuts.recordingKeys.value.length).toBe(0);
    });

    it("應該成功停止錄製並返回按鍵", () => {
      enhancedShortcuts.startRecording();
      enhancedShortcuts.recordKey("Ctrl");
      enhancedShortcuts.recordKey("s");

      const keys = enhancedShortcuts.stopRecording();

      expect(keys).toEqual(["Ctrl", "s"]);
      expect(enhancedShortcuts.recordingMode.value).toBe(false);
      expect(enhancedShortcuts.recordingKeys.value.length).toBe(0);
      expect(mockToast.success).toHaveBeenCalledWith("錄製完成: Ctrl + s");
    });
  });

  describe("工具函數", () => {
    it("應該正確正規化按鍵", () => {
      expect(enhancedShortcuts.normalizeKey(" ")).toBe("Space");
      expect(enhancedShortcuts.normalizeKey("Control")).toBe("Ctrl");
      expect(enhancedShortcuts.normalizeKey("Meta")).toBe("Cmd");
      expect(enhancedShortcuts.normalizeKey("a")).toBe("a");
    });

    it("應該正確找到匹配的快捷鍵", () => {
      const shortcut = enhancedShortcuts.findMatchingShortcut(["ArrowDown"]);
      expect(shortcut?.id).toBe("next_order");
    });

    it("應該返回 null 如果沒有匹配", () => {
      const shortcut = enhancedShortcuts.findMatchingShortcut(["z", "y", "x"]);
      expect(shortcut).toBeNull();
    });

    it("應該正確識別輸入元素", () => {
      const input = document.createElement("input");
      const textarea = document.createElement("textarea");
      const div = document.createElement("div");
      const editableDiv = document.createElement("div");
      editableDiv.contentEditable = "true";

      expect(enhancedShortcuts.isInputElement(input)).toBe(true);
      expect(enhancedShortcuts.isInputElement(textarea)).toBe(true);
      expect(enhancedShortcuts.isInputElement(div)).toBe(false);
      expect(enhancedShortcuts.isInputElement(editableDiv)).toBe(true);
      expect(enhancedShortcuts.isInputElement(null)).toBe(false);
    });

    it("應該正確識別全局快捷鍵", () => {
      expect(enhancedShortcuts.isGlobalShortcut(["ArrowDown"])).toBe(true);
      expect(enhancedShortcuts.isGlobalShortcut(["m"])).toBe(true);
      expect(enhancedShortcuts.isGlobalShortcut(["Space"])).toBe(false);
    });
  });

  describe("分類", () => {
    it("應該正確分組快捷鍵", () => {
      const categories = enhancedShortcuts.shortcutsByCategory.value;

      expect(categories.orders).toBeDefined();
      expect(categories.navigation).toBeDefined();
      expect(categories.filters).toBeDefined();
      expect(categories.system).toBeDefined();
      expect(categories.audio).toBeDefined();
    });

    it("應該正確過濾已啟用的快捷鍵", () => {
      const enabled = enhancedShortcuts.enabledShortcuts.value;

      enabled.forEach((shortcut) => {
        expect(shortcut.enabled).toBe(true);
      });

      expect(enabled.find((s) => s.id === "disabled_shortcut")).toBeUndefined();
    });
  });

  describe("邊界情況", () => {
    it("應該處理空的按鍵陣列", async () => {
      const result = await enhancedShortcuts.simulateKeyPress([]);

      expect(result.action).toBeNull();
      expect(result.success).toBe(false);
    });

    it("應該處理未知的動作", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      enhancedShortcuts.addCustomShortcut({
        name: "未知動作",
        description: "測試",
        keys: ["u"],
        action: "unknown_action",
        category: "system",
        enabled: true,
      });

      await enhancedShortcuts.simulateKeyPress(["u"]);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Unknown shortcut action: unknown_action",
      );
      consoleSpy.mockRestore();
    });
  });
});
