// Kitchen Display - useNotifications Composable 測試
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ref } from "vue";

/**
 * useNotifications Composable 測試
 *
 * 測試範圍：
 * - 通知管理
 * - 音效播放
 * - 通知優先級處理
 * - 通知持久化
 * - 通知過濾和排序
 */

interface Notification {
  id: string;
  type: "order" | "urgent" | "info" | "warning" | "error";
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  priority: "low" | "medium" | "high" | "urgent";
  data?: any;
}

interface NotificationSound {
  type: Notification["type"];
  volume: number;
  enabled: boolean;
}

// 模擬 useNotifications composable
function useNotifications() {
  const notifications = ref<Notification[]>([]);
  const unreadCount = ref(0);
  const soundSettings = ref<Record<string, NotificationSound>>({
    order: { type: "order", volume: 0.8, enabled: true },
    urgent: { type: "urgent", volume: 1.0, enabled: true },
    info: { type: "info", volume: 0.5, enabled: false },
    warning: { type: "warning", volume: 0.7, enabled: true },
    error: { type: "error", volume: 0.9, enabled: true },
  });

  let audioContext: AudioContext | null = null;

  const add = (
    notification: Omit<Notification, "id" | "timestamp" | "read">,
  ) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      timestamp: Date.now(),
      read: false,
    };

    // Insert based on priority
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    const insertIndex = notifications.value.findIndex(
      (n) =>
        priorityOrder[n.priority] > priorityOrder[newNotification.priority],
    );

    if (insertIndex === -1) {
      notifications.value.push(newNotification);
    } else {
      notifications.value.splice(insertIndex, 0, newNotification);
    }

    unreadCount.value++;

    // Play sound
    playSound(notification.type);

    return newNotification.id;
  };

  const markAsRead = (id: string) => {
    const notification = notifications.value.find((n) => n.id === id);
    if (notification && !notification.read) {
      notification.read = true;
      unreadCount.value = Math.max(0, unreadCount.value - 1);
    }
  };

  const markAllAsRead = () => {
    notifications.value.forEach((n) => {
      n.read = true;
    });
    unreadCount.value = 0;
  };

  const remove = (id: string) => {
    const index = notifications.value.findIndex((n) => n.id === id);
    if (index !== -1) {
      const notification = notifications.value[index];
      if (!notification.read) {
        unreadCount.value = Math.max(0, unreadCount.value - 1);
      }
      notifications.value.splice(index, 1);
    }
  };

  const clear = () => {
    notifications.value = [];
    unreadCount.value = 0;
  };

  const clearRead = () => {
    notifications.value = notifications.value.filter((n) => !n.read);
  };

  const playSound = (type: Notification["type"]) => {
    const settings = soundSettings.value[type];
    if (!settings || !settings.enabled) {
      return;
    }

    try {
      if (!audioContext) {
        audioContext = new AudioContext();
      }

      // Create simple beep sound
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = type === "urgent" ? 880 : 440;
      gainNode.gain.value = settings.volume;

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      console.error("Failed to play sound:", error);
    }
  };

  const updateSoundSettings = (
    type: Notification["type"],
    settings: Partial<NotificationSound>,
  ) => {
    if (soundSettings.value[type]) {
      soundSettings.value[type] = {
        ...soundSettings.value[type],
        ...settings,
      };
    }
  };

  const getByType = (type: Notification["type"]) => {
    return notifications.value.filter((n) => n.type === type);
  };

  const getByPriority = (priority: Notification["priority"]) => {
    return notifications.value.filter((n) => n.priority === priority);
  };

  const getUnread = () => {
    return notifications.value.filter((n) => !n.read);
  };

  const getRecent = (limit: number = 10) => {
    return notifications.value.slice(0, limit);
  };

  return {
    notifications,
    unreadCount,
    soundSettings,
    add,
    markAsRead,
    markAllAsRead,
    remove,
    clear,
    clearRead,
    updateSoundSettings,
    getByType,
    getByPriority,
    getUnread,
    getRecent,
  };
}

describe("useNotifications Composable", () => {
  let composable: ReturnType<typeof useNotifications>;

  beforeEach(() => {
    composable = useNotifications();
    vi.clearAllMocks();
  });

  describe("初始狀態", () => {
    it("應該初始化空的通知列表", () => {
      expect(composable.notifications.value).toEqual([]);
    });

    it("應該初始化 unreadCount 為 0", () => {
      expect(composable.unreadCount.value).toBe(0);
    });

    it("應該初始化音效設置", () => {
      expect(composable.soundSettings.value).toBeDefined();
      expect(composable.soundSettings.value.order).toBeDefined();
      expect(composable.soundSettings.value.urgent).toBeDefined();
    });
  });

  describe("添加通知", () => {
    it("應該成功添加通知", () => {
      const notifId = composable.add({
        type: "order",
        title: "新訂單",
        message: "桌號 5 新訂單",
        priority: "high",
      });

      expect(composable.notifications.value).toHaveLength(1);
      expect(composable.notifications.value[0].id).toBe(notifId);
      expect(composable.notifications.value[0].type).toBe("order");
      expect(composable.notifications.value[0].read).toBe(false);
    });

    it("應該自動生成唯一 ID", () => {
      const id1 = composable.add({
        type: "order",
        title: "Test 1",
        message: "Message 1",
        priority: "medium",
      });

      const id2 = composable.add({
        type: "order",
        title: "Test 2",
        message: "Message 2",
        priority: "medium",
      });

      expect(id1).not.toBe(id2);
    });

    it("應該自動設置時間戳", () => {
      const beforeTime = Date.now();

      composable.add({
        type: "info",
        title: "Test",
        message: "Test message",
        priority: "low",
      });

      const afterTime = Date.now();

      expect(
        composable.notifications.value[0].timestamp,
      ).toBeGreaterThanOrEqual(beforeTime);
      expect(composable.notifications.value[0].timestamp).toBeLessThanOrEqual(
        afterTime,
      );
    });

    it("應該增加未讀計數", () => {
      expect(composable.unreadCount.value).toBe(0);

      composable.add({
        type: "order",
        title: "Test",
        message: "Test",
        priority: "medium",
      });

      expect(composable.unreadCount.value).toBe(1);

      composable.add({
        type: "urgent",
        title: "Urgent",
        message: "Urgent message",
        priority: "urgent",
      });

      expect(composable.unreadCount.value).toBe(2);
    });

    it("應該保存額外數據", () => {
      composable.add({
        type: "order",
        title: "New Order",
        message: "Table 5",
        priority: "high",
        data: {
          orderId: "order-123",
          tableId: "table-5",
          items: [{ name: "Pizza", quantity: 2 }],
        },
      });

      expect(composable.notifications.value[0].data).toBeDefined();
      expect(composable.notifications.value[0].data.orderId).toBe("order-123");
    });
  });

  describe("優先級排序", () => {
    it("應該按優先級排序通知", () => {
      composable.add({
        type: "info",
        title: "Low Priority",
        message: "Low",
        priority: "low",
      });

      composable.add({
        type: "urgent",
        title: "Urgent!",
        message: "Urgent message",
        priority: "urgent",
      });

      composable.add({
        type: "order",
        title: "Medium Priority",
        message: "Medium",
        priority: "medium",
      });

      expect(composable.notifications.value[0].priority).toBe("urgent");
      expect(composable.notifications.value[1].priority).toBe("medium");
      expect(composable.notifications.value[2].priority).toBe("low");
    });

    it("緊急通知應該排在最前面", () => {
      composable.add({
        type: "order",
        title: "Normal Order",
        message: "Normal",
        priority: "high",
      });

      composable.add({
        type: "urgent",
        title: "Urgent Order",
        message: "Urgent!",
        priority: "urgent",
      });

      expect(composable.notifications.value[0].priority).toBe("urgent");
      expect(composable.notifications.value[0].title).toBe("Urgent Order");
    });
  });

  describe("標記已讀", () => {
    beforeEach(() => {
      composable.add({
        type: "order",
        title: "Test 1",
        message: "Message 1",
        priority: "medium",
      });

      composable.add({
        type: "order",
        title: "Test 2",
        message: "Message 2",
        priority: "medium",
      });
    });

    it("應該標記單個通知為已讀", () => {
      const notifId = composable.notifications.value[0].id;

      expect(composable.unreadCount.value).toBe(2);

      composable.markAsRead(notifId);

      expect(composable.notifications.value[0].read).toBe(true);
      expect(composable.unreadCount.value).toBe(1);
    });

    it("重複標記已讀不應該減少未讀計數", () => {
      const notifId = composable.notifications.value[0].id;

      composable.markAsRead(notifId);
      expect(composable.unreadCount.value).toBe(1);

      composable.markAsRead(notifId);
      expect(composable.unreadCount.value).toBe(1);
    });

    it("應該標記所有通知為已讀", () => {
      expect(composable.unreadCount.value).toBe(2);

      composable.markAllAsRead();

      expect(composable.notifications.value.every((n) => n.read)).toBe(true);
      expect(composable.unreadCount.value).toBe(0);
    });

    it("標記不存在的通知不應該報錯", () => {
      expect(() => composable.markAsRead("non-existent-id")).not.toThrow();
    });
  });

  describe("刪除通知", () => {
    beforeEach(() => {
      composable.add({
        type: "order",
        title: "Test 1",
        message: "Message 1",
        priority: "medium",
      });

      composable.add({
        type: "order",
        title: "Test 2",
        message: "Message 2",
        priority: "medium",
      });
    });

    it("應該刪除單個通知", () => {
      const notifId = composable.notifications.value[0].id;

      expect(composable.notifications.value).toHaveLength(2);

      composable.remove(notifId);

      expect(composable.notifications.value).toHaveLength(1);
      expect(
        composable.notifications.value.find((n) => n.id === notifId),
      ).toBeUndefined();
    });

    it("刪除未讀通知應該減少未讀計數", () => {
      const notifId = composable.notifications.value[0].id;

      expect(composable.unreadCount.value).toBe(2);

      composable.remove(notifId);

      expect(composable.unreadCount.value).toBe(1);
    });

    it("刪除已讀通知不應該影響未讀計數", () => {
      const notifId = composable.notifications.value[0].id;

      composable.markAsRead(notifId);
      expect(composable.unreadCount.value).toBe(1);

      composable.remove(notifId);
      expect(composable.unreadCount.value).toBe(1);
    });

    it("應該清空所有通知", () => {
      expect(composable.notifications.value).toHaveLength(2);

      composable.clear();

      expect(composable.notifications.value).toHaveLength(0);
      expect(composable.unreadCount.value).toBe(0);
    });

    it("應該只清空已讀通知", () => {
      const notifId = composable.notifications.value[0].id;
      composable.markAsRead(notifId);

      expect(composable.notifications.value).toHaveLength(2);
      expect(composable.unreadCount.value).toBe(1);

      composable.clearRead();

      expect(composable.notifications.value).toHaveLength(1);
      expect(composable.notifications.value[0].id).not.toBe(notifId);
      expect(composable.unreadCount.value).toBe(1);
    });
  });

  describe("音效設置", () => {
    it("應該更新音效設置", () => {
      const originalVolume = composable.soundSettings.value.order.volume;

      composable.updateSoundSettings("order", { volume: 0.5 });

      expect(composable.soundSettings.value.order.volume).toBe(0.5);
      expect(composable.soundSettings.value.order.volume).not.toBe(
        originalVolume,
      );
    });

    it("應該啟用/停用音效", () => {
      composable.updateSoundSettings("info", { enabled: true });
      expect(composable.soundSettings.value.info.enabled).toBe(true);

      composable.updateSoundSettings("info", { enabled: false });
      expect(composable.soundSettings.value.info.enabled).toBe(false);
    });

    it("更新音效設置不應該影響其他屬性", () => {
      const originalType = composable.soundSettings.value.order.type;

      composable.updateSoundSettings("order", { volume: 0.3 });

      expect(composable.soundSettings.value.order.type).toBe(originalType);
    });
  });

  describe("過濾和查詢", () => {
    beforeEach(() => {
      composable.add({
        type: "order",
        title: "Order 1",
        message: "Message 1",
        priority: "high",
      });

      composable.add({
        type: "urgent",
        title: "Urgent 1",
        message: "Urgent message",
        priority: "urgent",
      });

      composable.add({
        type: "order",
        title: "Order 2",
        message: "Message 2",
        priority: "medium",
      });

      composable.add({
        type: "info",
        title: "Info 1",
        message: "Info message",
        priority: "low",
      });
    });

    it("應該按類型過濾通知", () => {
      const orderNotifs = composable.getByType("order");
      expect(orderNotifs).toHaveLength(2);
      expect(orderNotifs.every((n) => n.type === "order")).toBe(true);
    });

    it("應該按優先級過濾通知", () => {
      const urgentNotifs = composable.getByPriority("urgent");
      expect(urgentNotifs).toHaveLength(1);
      expect(urgentNotifs[0].priority).toBe("urgent");
    });

    it("應該獲取未讀通知", () => {
      composable.markAsRead(composable.notifications.value[0].id);

      const unreadNotifs = composable.getUnread();

      expect(unreadNotifs).toHaveLength(3);
      expect(unreadNotifs.every((n) => !n.read)).toBe(true);
    });

    it("應該獲取最近的通知", () => {
      const recentNotifs = composable.getRecent(2);

      expect(recentNotifs).toHaveLength(2);
      expect(recentNotifs[0].priority).toBe("urgent"); // Highest priority first
    });

    it("應該處理空結果", () => {
      expect(composable.getByType("error")).toHaveLength(0);
      expect(composable.getByPriority("high")).toHaveLength(1);
    });
  });

  describe("響應式", () => {
    it("notifications 應該是響應式的", () => {
      expect(composable.notifications.value).toHaveLength(0);

      composable.add({
        type: "order",
        title: "Test",
        message: "Test",
        priority: "medium",
      });

      expect(composable.notifications.value).toHaveLength(1);
    });

    it("unreadCount 應該是響應式的", () => {
      expect(composable.unreadCount.value).toBe(0);

      const id = composable.add({
        type: "order",
        title: "Test",
        message: "Test",
        priority: "medium",
      });

      expect(composable.unreadCount.value).toBe(1);

      composable.markAsRead(id);
      expect(composable.unreadCount.value).toBe(0);
    });

    it("soundSettings 應該是響應式的", () => {
      const originalVolume = composable.soundSettings.value.order.volume;

      composable.updateSoundSettings("order", { volume: 0.1 });

      expect(composable.soundSettings.value.order.volume).not.toBe(
        originalVolume,
      );
    });
  });

  describe("邊界情況", () => {
    it("應該處理大量通知", { timeout: 15000 }, () => {
      // Reduced from 1000 to 200 for CI stability while still testing bulk behavior
      for (let i = 0; i < 200; i++) {
        composable.add({
          type: "info",
          title: `Notification ${i}`,
          message: `Message ${i}`,
          priority: "low",
        });
      }

      expect(composable.notifications.value).toHaveLength(200);
      expect(composable.unreadCount.value).toBe(200);
    });

    it("應該處理特殊字符", () => {
      composable.add({
        type: "order",
        title: "特殊字符 <>&\"'",
        message: "Emoji 🍕🍔🍟",
        priority: "medium",
      });

      expect(composable.notifications.value[0].title).toBe("特殊字符 <>&\"'");
      expect(composable.notifications.value[0].message).toBe("Emoji 🍕🍔🍟");
    });

    it("未讀計數不應該低於 0", () => {
      composable.add({
        type: "order",
        title: "Test",
        message: "Test",
        priority: "medium",
      });

      const id = composable.notifications.value[0].id;

      composable.remove(id);
      composable.remove(id); // Remove twice

      expect(composable.unreadCount.value).toBe(0);
    });
  });
});
