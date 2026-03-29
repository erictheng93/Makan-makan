// Kitchen Display - OrderStatusBadge 組件測試範例
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";

/**
 * OrderStatusBadge 組件測試
 *
 * 組件功能：顯示訂單狀態的徽章
 * 測試範圍：
 * - 狀態顯示
 * - 樣式類別
 * - 國際化
 */

// 簡單的 OrderStatusBadge 組件實現（範例）
type StatusType = "pending" | "preparing" | "ready" | "completed";

interface OrderStatusBadgeComponent {
  name: string;
  props: {
    status: {
      type: StringConstructor;
      required: boolean;
      validator: (value: string) => boolean;
    };
  };
  computed: {
    statusClass: () => string;
    statusText: () => string;
  };
  template: string;
}

const OrderStatusBadge: OrderStatusBadgeComponent = {
  name: "OrderStatusBadge",
  props: {
    status: {
      type: String,
      required: true,
      validator: (value: string) =>
        ["pending", "preparing", "ready", "completed"].includes(value),
    },
  },
  computed: {
    statusClass(): string {
      return `status-${(this as unknown as { status: StatusType }).status}`;
    },
    statusText(): string {
      const textMap: Record<StatusType, string> = {
        pending: "待處理",
        preparing: "製作中",
        ready: "已完成",
        completed: "已送出",
      };
      const status = (this as unknown as { status: StatusType }).status;
      return textMap[status] || status;
    },
  },
  template: `
    <span
      :class="['status-badge', statusClass]"
      data-testid="status-badge"
    >
      {{ statusText }}
    </span>
  `,
};

describe("OrderStatusBadge.vue", () => {
  const createWrapper = (status: string) => {
    return mount(OrderStatusBadge, {
      props: { status },
    });
  };

  describe("狀態顯示", () => {
    it("應該顯示「待處理」狀態", () => {
      const wrapper = createWrapper("pending");

      expect(wrapper.text()).toBe("待處理");
    });

    it("應該顯示「製作中」狀態", () => {
      const wrapper = createWrapper("preparing");

      expect(wrapper.text()).toBe("製作中");
    });

    it("應該顯示「已完成」狀態", () => {
      const wrapper = createWrapper("ready");

      expect(wrapper.text()).toBe("已完成");
    });

    it("應該顯示「已送出」狀態", () => {
      const wrapper = createWrapper("completed");

      expect(wrapper.text()).toBe("已送出");
    });
  });

  describe("狀態計算", () => {
    it("pending 狀態應該計算正確的樣式類別", () => {
      const wrapper = createWrapper("pending");

      expect(wrapper.vm.statusClass).toBe("status-pending");
    });

    it("preparing 狀態應該計算正確的樣式類別", () => {
      const wrapper = createWrapper("preparing");

      expect(wrapper.vm.statusClass).toBe("status-preparing");
    });

    it("ready 狀態應該計算正確的樣式類別", () => {
      const wrapper = createWrapper("ready");

      expect(wrapper.vm.statusClass).toBe("status-ready");
    });

    it("所有狀態都應該渲染為徽章元素", () => {
      const statuses = ["pending", "preparing", "ready", "completed"];

      statuses.forEach((status) => {
        const wrapper = createWrapper(status);
        const badge = wrapper.find('[data-testid="status-badge"]');
        expect(badge.exists()).toBe(true);
        expect(badge.text().length).toBeGreaterThan(0);
      });
    });
  });

  describe("Props 驗證", () => {
    it("應該接受有效的 status prop", () => {
      const validStatuses = ["pending", "preparing", "ready", "completed"];

      validStatuses.forEach((status) => {
        expect(() => createWrapper(status)).not.toThrow();
      });
    });

    it("status prop 應該是必填的", () => {
      const validator = OrderStatusBadge.props.status.required;

      expect(validator).toBe(true);
    });

    it("應該驗證 status prop 的有效值", () => {
      const validator = OrderStatusBadge.props.status.validator;

      expect(validator("pending")).toBe(true);
      expect(validator("preparing")).toBe(true);
      expect(validator("ready")).toBe(true);
      expect(validator("completed")).toBe(true);
      expect(validator("invalid")).toBe(false);
    });
  });

  describe("快照測試", () => {
    it("pending 狀態快照應該匹配", () => {
      const wrapper = createWrapper("pending");

      expect(wrapper.html()).toMatchSnapshot();
    });

    it("preparing 狀態快照應該匹配", () => {
      const wrapper = createWrapper("preparing");

      expect(wrapper.html()).toMatchSnapshot();
    });

    it("ready 狀態快照應該匹配", () => {
      const wrapper = createWrapper("ready");

      expect(wrapper.html()).toMatchSnapshot();
    });
  });
});
