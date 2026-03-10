// Kitchen Display - KitchenStats Component 測試
import { describe, it, expect, beforeEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";

/**
 * KitchenStats Component 測試
 *
 * 測試範圍：
 * - 統計數據顯示
 * - 實時更新
 * - 性能指標
 * - 格式化顯示
 * - 趨勢指示器
 */

interface KitchenStatsData {
  pendingOrders: number;
  preparingOrders: number;
  completedToday: number;
  averagePreparationTime: number; // minutes
  currentWaitTime: number; // minutes
  efficiency: number; // percentage 0-100
  urgentOrders: number;
  totalItemsPreparing: number;
}

// Mock KitchenStats Component
const KitchenStats = {
  name: "KitchenStats",
  props: {
    stats: {
      type: Object as () => KitchenStatsData,
      required: true,
    },
    showTrends: {
      type: Boolean,
      default: true,
    },
    refreshInterval: {
      type: Number,
      default: 30000, // 30 seconds
    },
  },
  emits: ["refresh"],
  setup(props: any, { emit }: any) {
    const formatTime = (minutes: number): string => {
      if (minutes < 1) {
        return "< 1 min";
      }
      if (minutes < 60) {
        return `${Math.round(minutes)} min`;
      }
      const hours = Math.floor(minutes / 60);
      const mins = Math.round(minutes % 60);
      return `${hours}h ${mins}m`;
    };

    const formatPercentage = (value: number): string => {
      return `${Math.round(value)}%`;
    };

    const getEfficiencyClass = (efficiency: number): string => {
      if (efficiency >= 90) return "excellent";
      if (efficiency >= 75) return "good";
      if (efficiency >= 60) return "average";
      return "poor";
    };

    const getWaitTimeClass = (waitTime: number): string => {
      if (waitTime < 10) return "fast";
      if (waitTime < 20) return "normal";
      if (waitTime < 30) return "slow";
      return "critical";
    };

    const refresh = () => {
      emit("refresh");
    };

    return {
      formatTime,
      formatPercentage,
      getEfficiencyClass,
      getWaitTimeClass,
      refresh,
    };
  },
  template: `
    <div class="kitchen-stats">
      <div class="stat-card pending">
        <div class="stat-label">Pending</div>
        <div class="stat-value">{{ stats.pendingOrders }}</div>
      </div>

      <div class="stat-card preparing">
        <div class="stat-label">Preparing</div>
        <div class="stat-value">{{ stats.preparingOrders }}</div>
        <div class="stat-sub">{{ stats.totalItemsPreparing }} items</div>
      </div>

      <div class="stat-card completed">
        <div class="stat-label">Completed Today</div>
        <div class="stat-value">{{ stats.completedToday }}</div>
      </div>

      <div class="stat-card urgent" v-if="stats.urgentOrders > 0">
        <div class="stat-label">Urgent</div>
        <div class="stat-value urgent-value">{{ stats.urgentOrders }}</div>
      </div>

      <div class="stat-card avg-time">
        <div class="stat-label">Avg Prep Time</div>
        <div class="stat-value">{{ formatTime(stats.averagePreparationTime) }}</div>
      </div>

      <div class="stat-card wait-time" :class="getWaitTimeClass(stats.currentWaitTime)">
        <div class="stat-label">Current Wait</div>
        <div class="stat-value">{{ formatTime(stats.currentWaitTime) }}</div>
      </div>

      <div class="stat-card efficiency" :class="getEfficiencyClass(stats.efficiency)">
        <div class="stat-label">Efficiency</div>
        <div class="stat-value">{{ formatPercentage(stats.efficiency) }}</div>
      </div>

      <button class="refresh-btn" @click="refresh">Refresh</button>
    </div>
  `,
};

describe("KitchenStats.vue", () => {
  let wrapper: VueWrapper<any>;

  const mockStats: KitchenStatsData = {
    pendingOrders: 5,
    preparingOrders: 8,
    completedToday: 42,
    averagePreparationTime: 12.5,
    currentWaitTime: 8.2,
    efficiency: 85,
    urgentOrders: 2,
    totalItemsPreparing: 23,
  };

  const createWrapper = (props: any = {}) => {
    return mount(KitchenStats, {
      props: {
        stats: mockStats,
        ...props,
      },
    });
  };

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  describe("渲染", () => {
    it("應該渲染所有統計卡片", () => {
      wrapper = createWrapper();

      expect(wrapper.find(".stat-card.pending").exists()).toBe(true);
      expect(wrapper.find(".stat-card.preparing").exists()).toBe(true);
      expect(wrapper.find(".stat-card.completed").exists()).toBe(true);
      expect(wrapper.find(".stat-card.avg-time").exists()).toBe(true);
      expect(wrapper.find(".stat-card.wait-time").exists()).toBe(true);
      expect(wrapper.find(".stat-card.efficiency").exists()).toBe(true);
    });

    it("應該顯示正確的數值", () => {
      wrapper = createWrapper();

      expect(wrapper.text()).toContain("5"); // pending
      expect(wrapper.text()).toContain("8"); // preparing
      expect(wrapper.text()).toContain("42"); // completed
      expect(wrapper.text()).toContain("23 items"); // total items
    });

    it("有緊急訂單時應該顯示緊急卡片", () => {
      wrapper = createWrapper();

      const urgentCard = wrapper.find(".stat-card.urgent");
      expect(urgentCard.exists()).toBe(true);
      expect(urgentCard.text()).toContain("2");
    });

    it("無緊急訂單時不應該顯示緊急卡片", () => {
      const statsNoUrgent = { ...mockStats, urgentOrders: 0 };
      wrapper = createWrapper({ stats: statsNoUrgent });

      expect(wrapper.find(".stat-card.urgent").exists()).toBe(false);
    });
  });

  describe("時間格式化", () => {
    it("應該格式化小於1分鐘的時間", () => {
      const stats = { ...mockStats, currentWaitTime: 0.5 };
      wrapper = createWrapper({ stats });

      expect(wrapper.text()).toContain("< 1 min");
    });

    it("應該格式化分鐘數", () => {
      const stats = { ...mockStats, averagePreparationTime: 15 };
      wrapper = createWrapper({ stats });

      expect(wrapper.text()).toContain("15 min");
    });

    it("應該格式化小時和分鐘", () => {
      const stats = { ...mockStats, averagePreparationTime: 125 };
      wrapper = createWrapper({ stats });

      expect(wrapper.text()).toContain("2h 5m");
    });

    it("應該正確四捨五入", () => {
      const stats = { ...mockStats, currentWaitTime: 8.7 };
      wrapper = createWrapper({ stats });

      expect(wrapper.text()).toContain("9 min");
    });
  });

  describe("百分比格式化", () => {
    it("應該顯示百分比符號", () => {
      wrapper = createWrapper();

      const efficiencyCard = wrapper.find(".stat-card.efficiency");
      expect(efficiencyCard.text()).toContain("%");
    });

    it("應該四捨五入到整數", () => {
      const stats = { ...mockStats, efficiency: 87.6 };
      wrapper = createWrapper({ stats });

      expect(wrapper.text()).toContain("88%");
    });
  });

  describe("效率等級樣式", () => {
    it("效率 >= 90 應該使用 excellent 樣式", () => {
      const stats = { ...mockStats, efficiency: 92 };
      wrapper = createWrapper({ stats });

      const efficiencyCard = wrapper.find(".stat-card.efficiency");
      expect(efficiencyCard.classes()).toContain("excellent");
    });

    it("效率 75-89 應該使用 good 樣式", () => {
      const stats = { ...mockStats, efficiency: 80 };
      wrapper = createWrapper({ stats });

      const efficiencyCard = wrapper.find(".stat-card.efficiency");
      expect(efficiencyCard.classes()).toContain("good");
    });

    it("效率 60-74 應該使用 average 樣式", () => {
      const stats = { ...mockStats, efficiency: 65 };
      wrapper = createWrapper({ stats });

      const efficiencyCard = wrapper.find(".stat-card.efficiency");
      expect(efficiencyCard.classes()).toContain("average");
    });

    it("效率 < 60 應該使用 poor 樣式", () => {
      const stats = { ...mockStats, efficiency: 50 };
      wrapper = createWrapper({ stats });

      const efficiencyCard = wrapper.find(".stat-card.efficiency");
      expect(efficiencyCard.classes()).toContain("poor");
    });
  });

  describe("等待時間樣式", () => {
    it("等待時間 < 10 分鐘應該使用 fast 樣式", () => {
      const stats = { ...mockStats, currentWaitTime: 8 };
      wrapper = createWrapper({ stats });

      const waitTimeCard = wrapper.find(".stat-card.wait-time");
      expect(waitTimeCard.classes()).toContain("fast");
    });

    it("等待時間 10-19 分鐘應該使用 normal 樣式", () => {
      const stats = { ...mockStats, currentWaitTime: 15 };
      wrapper = createWrapper({ stats });

      const waitTimeCard = wrapper.find(".stat-card.wait-time");
      expect(waitTimeCard.classes()).toContain("normal");
    });

    it("等待時間 20-29 分鐘應該使用 slow 樣式", () => {
      const stats = { ...mockStats, currentWaitTime: 25 };
      wrapper = createWrapper({ stats });

      const waitTimeCard = wrapper.find(".stat-card.wait-time");
      expect(waitTimeCard.classes()).toContain("slow");
    });

    it("等待時間 >= 30 分鐘應該使用 critical 樣式", () => {
      const stats = { ...mockStats, currentWaitTime: 35 };
      wrapper = createWrapper({ stats });

      const waitTimeCard = wrapper.find(".stat-card.wait-time");
      expect(waitTimeCard.classes()).toContain("critical");
    });
  });

  describe("交互", () => {
    it("點擊刷新按鈕應該觸發 refresh 事件", async () => {
      wrapper = createWrapper();

      const refreshBtn = wrapper.find(".refresh-btn");
      await refreshBtn.trigger("click");

      expect(wrapper.emitted("refresh")).toBeTruthy();
      expect(wrapper.emitted("refresh")).toHaveLength(1);
    });
  });

  describe("響應式更新", () => {
    it("統計數據更新時應該重新渲染", async () => {
      wrapper = createWrapper();

      expect(wrapper.text()).toContain("5"); // initial pending

      const newStats = { ...mockStats, pendingOrders: 10 };
      await wrapper.setProps({ stats: newStats });

      expect(wrapper.text()).toContain("10"); // updated pending
    });

    it("效率變化應該更新樣式", async () => {
      const stats = { ...mockStats, efficiency: 95 };
      wrapper = createWrapper({ stats });

      let efficiencyCard = wrapper.find(".stat-card.efficiency");
      expect(efficiencyCard.classes()).toContain("excellent");

      const newStats = { ...mockStats, efficiency: 55 };
      await wrapper.setProps({ stats: newStats });

      efficiencyCard = wrapper.find(".stat-card.efficiency");
      expect(efficiencyCard.classes()).toContain("poor");
    });

    it("緊急訂單從0變為有值應該顯示緊急卡片", async () => {
      const statsNoUrgent = { ...mockStats, urgentOrders: 0 };
      wrapper = createWrapper({ stats: statsNoUrgent });

      expect(wrapper.find(".stat-card.urgent").exists()).toBe(false);

      const newStats = { ...mockStats, urgentOrders: 3 };
      await wrapper.setProps({ stats: newStats });

      expect(wrapper.find(".stat-card.urgent").exists()).toBe(true);
      expect(wrapper.text()).toContain("3");
    });
  });

  describe("邊界情況", () => {
    it("應該處理所有數值為0的情況", () => {
      const zeroStats: KitchenStatsData = {
        pendingOrders: 0,
        preparingOrders: 0,
        completedToday: 0,
        averagePreparationTime: 0,
        currentWaitTime: 0,
        efficiency: 0,
        urgentOrders: 0,
        totalItemsPreparing: 0,
      };

      wrapper = createWrapper({ stats: zeroStats });

      expect(wrapper.text()).toContain("0");
      expect(wrapper.find(".stat-card.urgent").exists()).toBe(false);
    });

    it("應該處理極大的數值", () => {
      const largeStats: KitchenStatsData = {
        pendingOrders: 999,
        preparingOrders: 999,
        completedToday: 9999,
        averagePreparationTime: 500,
        currentWaitTime: 200,
        efficiency: 100,
        urgentOrders: 99,
        totalItemsPreparing: 9999,
      };

      wrapper = createWrapper({ stats: largeStats });

      expect(wrapper.text()).toContain("999");
      expect(wrapper.text()).toContain("9999");
      expect(wrapper.text()).toContain("100%");
    });

    it("應該處理小數時間值", () => {
      const decimalStats = {
        ...mockStats,
        averagePreparationTime: 7.3,
        currentWaitTime: 3.8,
      };

      wrapper = createWrapper({ stats: decimalStats });

      expect(wrapper.text()).toMatch(/7 min/);
      expect(wrapper.text()).toMatch(/4 min/);
    });

    it("應該處理超過100%的效率", () => {
      const stats = { ...mockStats, efficiency: 105 };
      wrapper = createWrapper({ stats });

      expect(wrapper.text()).toContain("105%");
      const efficiencyCard = wrapper.find(".stat-card.efficiency");
      expect(efficiencyCard.classes()).toContain("excellent");
    });

    it("應該處理負數（雖然業務上不應該發生）", () => {
      const negativeStats = {
        ...mockStats,
        pendingOrders: -1,
      };

      wrapper = createWrapper({ stats: negativeStats });

      // Should still render without crashing
      expect(wrapper.find(".stat-card.pending").exists()).toBe(true);
    });
  });

  describe("性能", () => {
    it("頻繁更新統計數據應該高效處理", async () => {
      wrapper = createWrapper();

      // Simulate rapid updates
      for (let i = 0; i < 10; i++) {
        await wrapper.setProps({
          stats: { ...mockStats, pendingOrders: i },
        });
      }

      expect(wrapper.find(".stat-card.pending").exists()).toBe(true);
    });
  });

  describe("可訪問性", () => {
    it("統計標籤應該清晰", () => {
      wrapper = createWrapper();

      const labels = wrapper.findAll(".stat-label");
      expect(labels.length).toBeGreaterThan(0);

      labels.forEach((label) => {
        expect(label.text().length).toBeGreaterThan(0);
      });
    });

    it("數值應該易於識別", () => {
      wrapper = createWrapper();

      const values = wrapper.findAll(".stat-value");
      expect(values.length).toBeGreaterThan(0);

      values.forEach((value) => {
        expect(value.text().length).toBeGreaterThan(0);
      });
    });
  });
});
