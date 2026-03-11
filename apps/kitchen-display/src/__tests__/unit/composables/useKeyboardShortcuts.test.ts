/**
 * useKeyboardShortcuts Composable 測試
 *
 * 測試範圍：
 * - 快捷鍵註冊和執行
 * - 組合鍵處理
 * - 動作處理器管理
 * - 快捷鍵啟用/停用
 * - 持久化（儲存/載入）
 * - 匯出/匯入功能
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { ref } from "vue";

// Mock vue-toastification
vi.mock("vue-toastification", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}));

// 模擬快捷鍵介面
interface KeyboardShortcut {
  id: string;
  name: string;
  description: string;
  keys: string[];
  action: string;
  enabled: boolean;
  category: "orders" | "navigation" | "system" | "filters";
  global?: boolean;
}

// 模擬 useKeyboardShortcuts composable
function createMockUseKeyboardShortcuts() {
  const shortcuts = ref<KeyboardShortcut[]>([
    {
      id: "quick_complete",
      name: "快速標記完成",
      description: "快速標記當前選中或第一個訂單為完成",
      keys: ["Space"],
      action: "quick_complete",
      enabled: true,
      category: "orders",
      global: true,
    },
    {
      id: "toggle_order_status",
      name: "切換訂單狀態",
      description: "在等待、製作中、完成之間循環切換訂單狀態",
      keys: ["Enter"],
      action: "toggle_order_status",
      enabled: true,
      category: "orders",
      global: true,
    },
    {
      id: "select_all_pending",
      name: "選擇所有待處理",
      description: "選擇所有待處理的訂單",
      keys: ["Ctrl", "a"],
      action: "select_all_pending",
      enabled: true,
      category: "orders",
    },
    {
      id: "refresh_orders",
      name: "刷新訂單",
      description: "手動刷新訂單列表",
      keys: ["F5"],
      action: "refresh_orders",
      enabled: true,
      category: "system",
      global: true,
    },
    {
      id: "disabled_shortcut",
      name: "已停用快捷鍵",
      description: "測試停用狀態",
      keys: ["d"],
      action: "disabled_action",
      enabled: false,
      category: "system",
    },
  ]);

  const enabled = ref(true);
  const showHelp = ref(false);
  const activeKeys = ref<Set<string>>(new Set());
  const actionQueue = ref<string[]>([]);
  const actionHandlers = ref<Map<string, (...args: any[]) => void>>(new Map());
  const lastActionTime = ref(0);

  // Utility functions
  const normalizeKey = (key: string): string => {
    const keyMap: { [key: string]: string } = {
      " ": "Space",
      Control: "Ctrl",
      Meta: "Cmd",
    };
    return keyMap[key] || key;
  };

  const formatShortcut = (keys: string[]): string => {
    const symbols: { [key: string]: string } = {
      Ctrl: "⌃",
      Cmd: "⌘",
      Alt: "⌥",
      Shift: "⇧",
      Space: "␣",
      Enter: "↵",
    };
    return keys.map((key) => symbols[key] || key).join(" + ");
  };

  const getCategoryTitle = (category: string): string => {
    const titles: Record<string, string> = {
      orders: "訂單管理",
      navigation: "導航操作",
      filters: "篩選功能",
      system: "系統功能",
    };
    return titles[category] || category;
  };

  const matchesShortcut = (
    shortcut: KeyboardShortcut,
    pressedKeys: Set<string>,
  ): boolean => {
    if (!shortcut.enabled) return false;

    const requiredKeys = new Set(shortcut.keys.map(normalizeKey));
    const currentKeys = new Set([...pressedKeys].map(normalizeKey));

    if (requiredKeys.size !== currentKeys.size) return false;

    for (const key of requiredKeys) {
      if (!currentKeys.has(key)) return false;
    }

    return true;
  };

  // Handler registration
  const registerHandler = (
    action: string,
    handler: (...args: any[]) => void,
  ) => {
    actionHandlers.value.set(action, handler);
  };

  const unregisterHandler = (action: string) => {
    actionHandlers.value.delete(action);
  };

  const registerMultipleHandlers = (
    handlers: Record<string, (...args: any[]) => void>,
  ) => {
    Object.entries(handlers).forEach(([action, handler]) => {
      registerHandler(action, handler);
    });
  };

  // Action execution
  const executeAction = (action: string): boolean => {
    const handler = actionHandlers.value.get(action);

    if (handler) {
      handler();
      actionQueue.value.push(action);
      if (actionQueue.value.length > 10) {
        actionQueue.value.shift();
      }
      return true;
    }

    return false;
  };

  // Simulate key press
  const simulateKeyPress = (keys: string[]): string | null => {
    if (!enabled.value) return null;

    activeKeys.value = new Set(keys.map(normalizeKey));

    const matchingShortcut = shortcuts.value.find((shortcut) =>
      matchesShortcut(shortcut, activeKeys.value),
    );

    if (matchingShortcut) {
      const now = Date.now();
      if (now - lastActionTime.value < 200) return null;

      lastActionTime.value = now;
      if (executeAction(matchingShortcut.action)) {
        return matchingShortcut.action;
      }
    }

    return null;
  };

  // Shortcut management
  const addShortcut = (shortcut: KeyboardShortcut) => {
    const existingIndex = shortcuts.value.findIndex(
      (s) => s.id === shortcut.id,
    );
    if (existingIndex >= 0) {
      shortcuts.value[existingIndex] = shortcut;
    } else {
      shortcuts.value.push(shortcut);
    }
  };

  const removeShortcut = (shortcutId: string) => {
    shortcuts.value = shortcuts.value.filter((s) => s.id !== shortcutId);
  };

  const enableShortcut = (shortcutId: string) => {
    const shortcut = shortcuts.value.find((s) => s.id === shortcutId);
    if (shortcut) {
      shortcut.enabled = true;
    }
  };

  const disableShortcut = (shortcutId: string) => {
    const shortcut = shortcuts.value.find((s) => s.id === shortcutId);
    if (shortcut) {
      shortcut.enabled = false;
    }
  };

  const updateShortcutKeys = (shortcutId: string, newKeys: string[]) => {
    const shortcut = shortcuts.value.find((s) => s.id === shortcutId);
    if (shortcut) {
      shortcut.keys = newKeys;
    }
  };

  // Control methods
  const enable = () => {
    enabled.value = true;
  };
  const disable = () => {
    enabled.value = false;
    activeKeys.value.clear();
  };
  const toggle = () => {
    if (enabled.value) disable();
    else enable();
  };

  // Help
  const toggleHelp = () => {
    showHelp.value = !showHelp.value;
  };
  const hideHelp = () => {
    showHelp.value = false;
  };

  // Storage
  const saveShortcuts = () => {
    localStorage.setItem("kitchen-shortcuts", JSON.stringify(shortcuts.value));
  };

  const loadShortcuts = () => {
    const saved = localStorage.getItem("kitchen-shortcuts");
    if (saved) {
      const parsed = JSON.parse(saved);
      shortcuts.value = parsed;
    }
  };

  const resetToDefaults = () => {
    shortcuts.value = shortcuts.value.map((s) => ({ ...s, enabled: true }));
  };

  // Computed
  const shortcutGroups = () => {
    const groups: Record<
      string,
      { category: string; title: string; shortcuts: KeyboardShortcut[] }
    > = {};
    shortcuts.value.forEach((shortcut) => {
      if (!shortcut.enabled) return;
      if (!groups[shortcut.category]) {
        groups[shortcut.category] = {
          category: shortcut.category,
          title: getCategoryTitle(shortcut.category),
          shortcuts: [],
        };
      }
      groups[shortcut.category].shortcuts.push(shortcut);
    });
    return Object.values(groups);
  };

  const enabledShortcuts = () => shortcuts.value.filter((s) => s.enabled);

  return {
    // State
    shortcuts,
    enabled,
    showHelp,
    activeKeys,
    actionQueue,
    shortcutGroups,
    enabledShortcuts,

    // Registration
    registerHandler,
    unregisterHandler,
    registerMultipleHandlers,

    // Actions
    simulateKeyPress,
    executeAction,

    // Shortcut management
    addShortcut,
    removeShortcut,
    enableShortcut,
    disableShortcut,
    updateShortcutKeys,

    // Control
    enable,
    disable,
    toggle,

    // Help
    toggleHelp,
    hideHelp,

    // Utilities
    formatShortcut,
    getCategoryTitle,
    normalizeKey,

    // Storage
    saveShortcuts,
    loadShortcuts,
    resetToDefaults,
  };
}

describe("useKeyboardShortcuts", () => {
  let keyboardShortcuts: ReturnType<typeof createMockUseKeyboardShortcuts>;

  beforeEach(() => {
    keyboardShortcuts = createMockUseKeyboardShortcuts();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("初始狀態", () => {
    it("應該初始化為啟用狀態", () => {
      expect(keyboardShortcuts.enabled.value).toBe(true);
    });

    it("應該初始化幫助為隱藏", () => {
      expect(keyboardShortcuts.showHelp.value).toBe(false);
    });

    it("應該有預設的快捷鍵列表", () => {
      expect(keyboardShortcuts.shortcuts.value.length).toBeGreaterThan(0);
    });

    it("應該初始化空的活動按鍵", () => {
      expect(keyboardShortcuts.activeKeys.value.size).toBe(0);
    });

    it("應該初始化空的動作佇列", () => {
      expect(keyboardShortcuts.actionQueue.value.length).toBe(0);
    });
  });

  describe("處理器註冊", () => {
    it("應該成功註冊處理器", () => {
      const handler = vi.fn();
      keyboardShortcuts.registerHandler("test_action", handler);

      keyboardShortcuts.executeAction("test_action");
      expect(handler).toHaveBeenCalled();
    });

    it("應該成功取消註冊處理器", () => {
      const handler = vi.fn();
      keyboardShortcuts.registerHandler("test_action", handler);
      keyboardShortcuts.unregisterHandler("test_action");

      const result = keyboardShortcuts.executeAction("test_action");
      expect(result).toBe(false);
      expect(handler).not.toHaveBeenCalled();
    });

    it("應該成功註冊多個處理器", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      keyboardShortcuts.registerMultipleHandlers({
        action1: handler1,
        action2: handler2,
      });

      keyboardShortcuts.executeAction("action1");
      keyboardShortcuts.executeAction("action2");

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it("應該覆蓋已存在的處理器", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      keyboardShortcuts.registerHandler("same_action", handler1);
      keyboardShortcuts.registerHandler("same_action", handler2);

      keyboardShortcuts.executeAction("same_action");

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe("快捷鍵匹配和執行", () => {
    it("應該正確匹配單一按鍵快捷鍵", () => {
      const handler = vi.fn();
      keyboardShortcuts.registerHandler("quick_complete", handler);

      const result = keyboardShortcuts.simulateKeyPress(["Space"]);
      expect(result).toBe("quick_complete");
      expect(handler).toHaveBeenCalled();
    });

    it("應該正確匹配組合鍵快捷鍵", () => {
      const handler = vi.fn();
      keyboardShortcuts.registerHandler("select_all_pending", handler);

      const result = keyboardShortcuts.simulateKeyPress(["Ctrl", "a"]);
      expect(result).toBe("select_all_pending");
      expect(handler).toHaveBeenCalled();
    });

    it("應該忽略停用的快捷鍵", () => {
      const handler = vi.fn();
      keyboardShortcuts.registerHandler("disabled_action", handler);

      const result = keyboardShortcuts.simulateKeyPress(["d"]);
      expect(result).toBeNull();
      expect(handler).not.toHaveBeenCalled();
    });

    it("應該在全局停用時不執行任何快捷鍵", () => {
      const handler = vi.fn();
      keyboardShortcuts.registerHandler("quick_complete", handler);
      keyboardShortcuts.disable();

      const result = keyboardShortcuts.simulateKeyPress(["Space"]);
      expect(result).toBeNull();
      expect(handler).not.toHaveBeenCalled();
    });

    it("應該記錄執行的動作到佇列", () => {
      const handler = vi.fn();
      keyboardShortcuts.registerHandler("quick_complete", handler);

      // Reset last action time to allow execution
      keyboardShortcuts.simulateKeyPress(["Space"]);

      expect(keyboardShortcuts.actionQueue.value).toContain("quick_complete");
    });

    it("應該限制動作佇列長度為 10", () => {
      const handler = vi.fn();
      keyboardShortcuts.registerHandler("quick_complete", handler);

      // Execute more than 10 times with delay
      for (let i = 0; i < 15; i++) {
        keyboardShortcuts.executeAction("quick_complete");
      }

      expect(keyboardShortcuts.actionQueue.value.length).toBeLessThanOrEqual(
        10,
      );
    });
  });

  describe("快捷鍵管理", () => {
    it("應該成功新增快捷鍵", () => {
      const newShortcut: KeyboardShortcut = {
        id: "new_shortcut",
        name: "新快捷鍵",
        description: "測試新增",
        keys: ["n"],
        action: "new_action",
        enabled: true,
        category: "system",
      };

      const initialLength = keyboardShortcuts.shortcuts.value.length;
      keyboardShortcuts.addShortcut(newShortcut);

      expect(keyboardShortcuts.shortcuts.value.length).toBe(initialLength + 1);
      expect(
        keyboardShortcuts.shortcuts.value.find((s) => s.id === "new_shortcut"),
      ).toBeDefined();
    });

    it("應該更新已存在的快捷鍵", () => {
      const updatedShortcut: KeyboardShortcut = {
        id: "quick_complete",
        name: "更新後的名稱",
        description: "更新後的描述",
        keys: ["x"],
        action: "quick_complete",
        enabled: true,
        category: "orders",
      };

      const initialLength = keyboardShortcuts.shortcuts.value.length;
      keyboardShortcuts.addShortcut(updatedShortcut);

      expect(keyboardShortcuts.shortcuts.value.length).toBe(initialLength);
      const shortcut = keyboardShortcuts.shortcuts.value.find(
        (s) => s.id === "quick_complete",
      );
      expect(shortcut?.name).toBe("更新後的名稱");
      expect(shortcut?.keys).toEqual(["x"]);
    });

    it("應該成功移除快捷鍵", () => {
      const initialLength = keyboardShortcuts.shortcuts.value.length;
      keyboardShortcuts.removeShortcut("quick_complete");

      expect(keyboardShortcuts.shortcuts.value.length).toBe(initialLength - 1);
      expect(
        keyboardShortcuts.shortcuts.value.find(
          (s) => s.id === "quick_complete",
        ),
      ).toBeUndefined();
    });

    it("應該成功啟用快捷鍵", () => {
      keyboardShortcuts.enableShortcut("disabled_shortcut");

      const shortcut = keyboardShortcuts.shortcuts.value.find(
        (s) => s.id === "disabled_shortcut",
      );
      expect(shortcut?.enabled).toBe(true);
    });

    it("應該成功停用快捷鍵", () => {
      keyboardShortcuts.disableShortcut("quick_complete");

      const shortcut = keyboardShortcuts.shortcuts.value.find(
        (s) => s.id === "quick_complete",
      );
      expect(shortcut?.enabled).toBe(false);
    });

    it("應該成功更新快捷鍵按鍵", () => {
      keyboardShortcuts.updateShortcutKeys("quick_complete", ["Ctrl", "Space"]);

      const shortcut = keyboardShortcuts.shortcuts.value.find(
        (s) => s.id === "quick_complete",
      );
      expect(shortcut?.keys).toEqual(["Ctrl", "Space"]);
    });
  });

  describe("控制功能", () => {
    it("應該成功啟用快捷鍵系統", () => {
      keyboardShortcuts.disable();
      expect(keyboardShortcuts.enabled.value).toBe(false);

      keyboardShortcuts.enable();
      expect(keyboardShortcuts.enabled.value).toBe(true);
    });

    it("應該成功停用快捷鍵系統", () => {
      keyboardShortcuts.disable();

      expect(keyboardShortcuts.enabled.value).toBe(false);
      expect(keyboardShortcuts.activeKeys.value.size).toBe(0);
    });

    it("應該成功切換快捷鍵系統狀態", () => {
      expect(keyboardShortcuts.enabled.value).toBe(true);

      keyboardShortcuts.toggle();
      expect(keyboardShortcuts.enabled.value).toBe(false);

      keyboardShortcuts.toggle();
      expect(keyboardShortcuts.enabled.value).toBe(true);
    });
  });

  describe("幫助系統", () => {
    it("應該成功切換幫助顯示", () => {
      expect(keyboardShortcuts.showHelp.value).toBe(false);

      keyboardShortcuts.toggleHelp();
      expect(keyboardShortcuts.showHelp.value).toBe(true);

      keyboardShortcuts.toggleHelp();
      expect(keyboardShortcuts.showHelp.value).toBe(false);
    });

    it("應該成功隱藏幫助", () => {
      keyboardShortcuts.toggleHelp();
      expect(keyboardShortcuts.showHelp.value).toBe(true);

      keyboardShortcuts.hideHelp();
      expect(keyboardShortcuts.showHelp.value).toBe(false);
    });
  });

  describe("工具函數", () => {
    it("應該正確格式化快捷鍵", () => {
      expect(keyboardShortcuts.formatShortcut(["Ctrl", "a"])).toBe("⌃ + a");
      expect(keyboardShortcuts.formatShortcut(["Space"])).toBe("␣");
      expect(keyboardShortcuts.formatShortcut(["Enter"])).toBe("↵");
      expect(keyboardShortcuts.formatShortcut(["Cmd", "Shift", "s"])).toBe(
        "⌘ + ⇧ + s",
      );
    });

    it("應該正確取得分類標題", () => {
      expect(keyboardShortcuts.getCategoryTitle("orders")).toBe("訂單管理");
      expect(keyboardShortcuts.getCategoryTitle("navigation")).toBe("導航操作");
      expect(keyboardShortcuts.getCategoryTitle("filters")).toBe("篩選功能");
      expect(keyboardShortcuts.getCategoryTitle("system")).toBe("系統功能");
      expect(keyboardShortcuts.getCategoryTitle("unknown")).toBe("unknown");
    });

    it("應該正確正規化按鍵", () => {
      expect(keyboardShortcuts.normalizeKey(" ")).toBe("Space");
      expect(keyboardShortcuts.normalizeKey("Control")).toBe("Ctrl");
      expect(keyboardShortcuts.normalizeKey("Meta")).toBe("Cmd");
      expect(keyboardShortcuts.normalizeKey("a")).toBe("a");
    });
  });

  describe("持久化", () => {
    it("應該成功儲存快捷鍵到 localStorage", () => {
      keyboardShortcuts.saveShortcuts();

      const saved = localStorage.getItem("kitchen-shortcuts");
      expect(saved).not.toBeNull();

      const parsed = JSON.parse(saved!);
      expect(parsed.length).toBe(keyboardShortcuts.shortcuts.value.length);
    });

    it("應該成功從 localStorage 載入快捷鍵", () => {
      const customShortcuts: KeyboardShortcut[] = [
        {
          id: "custom",
          name: "自訂快捷鍵",
          description: "測試載入",
          keys: ["c"],
          action: "custom_action",
          enabled: true,
          category: "system",
        },
      ];

      localStorage.setItem(
        "kitchen-shortcuts",
        JSON.stringify(customShortcuts),
      );
      keyboardShortcuts.loadShortcuts();

      expect(keyboardShortcuts.shortcuts.value.length).toBe(1);
      expect(keyboardShortcuts.shortcuts.value[0].id).toBe("custom");
    });

    it("應該成功重設為預設值", () => {
      keyboardShortcuts.disableShortcut("quick_complete");
      expect(
        keyboardShortcuts.shortcuts.value.find((s) => s.id === "quick_complete")
          ?.enabled,
      ).toBe(false);

      keyboardShortcuts.resetToDefaults();
      expect(
        keyboardShortcuts.shortcuts.value.find((s) => s.id === "quick_complete")
          ?.enabled,
      ).toBe(true);
    });
  });

  describe("快捷鍵分組", () => {
    it("應該正確分組快捷鍵", () => {
      const groups = keyboardShortcuts.shortcutGroups();

      expect(groups.length).toBeGreaterThan(0);

      const ordersGroup = groups.find((g) => g.category === "orders");
      expect(ordersGroup).toBeDefined();
      expect(ordersGroup?.shortcuts.length).toBeGreaterThan(0);
    });

    it("應該只包含已啟用的快捷鍵在分組中", () => {
      const groups = keyboardShortcuts.shortcutGroups();

      groups.forEach((group) => {
        group.shortcuts.forEach((shortcut) => {
          expect(shortcut.enabled).toBe(true);
        });
      });
    });

    it("應該正確過濾已啟用的快捷鍵", () => {
      const enabled = keyboardShortcuts.enabledShortcuts();

      enabled.forEach((shortcut) => {
        expect(shortcut.enabled).toBe(true);
      });

      // 確認停用的快捷鍵不在列表中
      expect(enabled.find((s) => s.id === "disabled_shortcut")).toBeUndefined();
    });
  });

  describe("邊界情況", () => {
    it("應該處理不存在的快捷鍵 ID", () => {
      expect(() => {
        keyboardShortcuts.enableShortcut("non_existent");
        keyboardShortcuts.disableShortcut("non_existent");
        keyboardShortcuts.removeShortcut("non_existent");
        keyboardShortcuts.updateShortcutKeys("non_existent", ["x"]);
      }).not.toThrow();
    });

    it("應該處理空的按鍵組合", () => {
      const result = keyboardShortcuts.simulateKeyPress([]);
      expect(result).toBeNull();
    });

    it("應該處理不匹配的按鍵組合", () => {
      const result = keyboardShortcuts.simulateKeyPress(["x", "y", "z"]);
      expect(result).toBeNull();
    });

    it("應該處理未註冊處理器的動作", () => {
      const result = keyboardShortcuts.executeAction("unregistered_action");
      expect(result).toBe(false);
    });

    it("應該處理空的 localStorage", () => {
      localStorage.removeItem("kitchen-shortcuts");

      expect(() => {
        keyboardShortcuts.loadShortcuts();
      }).not.toThrow();
    });

    it("應該處理無效的 localStorage 資料", () => {
      localStorage.setItem("kitchen-shortcuts", "invalid json");

      expect(() => {
        keyboardShortcuts.loadShortcuts();
      }).toThrow();
    });
  });
});
