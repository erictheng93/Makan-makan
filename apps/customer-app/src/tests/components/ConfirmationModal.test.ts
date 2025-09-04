import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import ConfirmationModal from "@/components/ConfirmationModal.vue";

describe("ConfirmationModal.vue", () => {
  let wrapper: VueWrapper<any>;

  const defaultProps = {
    show: true,
    title: "確認操作",
    message: "您確定要執行此操作嗎？",
    confirmText: "確認",
    cancelText: "取消",
    loading: false,
  };

  beforeEach(() => {
    wrapper = mount(ConfirmationModal, {
      props: defaultProps,
    });
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  describe("基本渲染", () => {
    it("應該正確渲染標題", () => {
      expect(wrapper.text()).toContain("確認操作");
    });

    it("應該正確渲染訊息", () => {
      expect(wrapper.text()).toContain("您確定要執行此操作嗎？");
    });

    it("應該正確渲染確認按鈕文字", () => {
      const confirmBtn = wrapper.findAll("button")[0];
      expect(confirmBtn.text()).toContain("確認");
    });

    it("應該正確渲染取消按鈕文字", () => {
      const buttons = wrapper.findAll("button");
      const cancelBtn = buttons[1];
      expect(cancelBtn.text()).toContain("取消");
    });
  });

  describe("模態框控制", () => {
    it("當 show 為 true 時應該顯示模態框", () => {
      const modal = wrapper.find(".fixed.inset-0");
      expect(modal.exists()).toBe(true);
      expect(modal.isVisible()).toBe(true);
    });

    it("當 show 為 false 時應該隱藏模態框", async () => {
      await wrapper.setProps({ show: false });

      const modal = wrapper.find(".fixed.inset-0");
      expect(modal.exists()).toBe(false);
    });

    it("應該有模態框背景遮罩", () => {
      const backdrop = wrapper.find(".bg-black.bg-opacity-50");
      expect(backdrop.exists()).toBe(true);
    });
  });

  describe("按鈕樣式", () => {
    it("確認按鈕應該有正確的樣式", () => {
      const confirmBtn = wrapper.findAll("button")[0];
      expect(confirmBtn.classes()).toContain("bg-indigo-600");
      expect(confirmBtn.classes()).toContain("hover:bg-indigo-700");
      expect(confirmBtn.classes()).toContain("text-white");
    });

    it("取消按鈕應該有正確的樣式", () => {
      const buttons = wrapper.findAll("button");
      const cancelBtn = buttons[1];
      expect(cancelBtn.classes()).toContain("bg-white");
      expect(cancelBtn.classes()).toContain("border-gray-300");
      expect(cancelBtn.classes()).toContain("text-gray-700");
    });
  });

  describe("事件處理", () => {
    it("點擊確認按鈕應該觸發 confirm 事件", async () => {
      const confirmBtn = wrapper.findAll("button")[0];
      await confirmBtn.trigger("click");

      expect(wrapper.emitted("confirm")).toBeTruthy();
      expect(wrapper.emitted("confirm")).toHaveLength(1);
    });

    it("點擊取消按鈕應該觸發 cancel 事件", async () => {
      const buttons = wrapper.findAll("button");
      const cancelBtn = buttons[1];
      await cancelBtn.trigger("click");

      expect(wrapper.emitted("cancel")).toBeTruthy();
      expect(wrapper.emitted("cancel")).toHaveLength(1);
    });

    it("點擊背景遮罩應該觸發 cancel 事件", async () => {
      const backdrop = wrapper.find(".fixed.inset-0");
      await backdrop.trigger("click");

      expect(wrapper.emitted("cancel")).toBeTruthy();
    });
  });

  describe("載入狀態", () => {
    it("應該支援載入狀態", async () => {
      await wrapper.setProps({ loading: true });

      const confirmBtn = wrapper.findAll("button")[0];
      expect(confirmBtn.attributes("disabled")).toBeDefined();

      const spinner = wrapper.find(".animate-spin");
      expect(spinner.exists()).toBe(true);
    });

    it("載入時取消按鈕應該被禁用", async () => {
      await wrapper.setProps({ loading: true });

      const buttons = wrapper.findAll("button");
      const cancelBtn = buttons[1];
      expect(cancelBtn.attributes("disabled")).toBeDefined();
    });

    it("載入狀態時確認按鈕應該變灰", async () => {
      await wrapper.setProps({ loading: true });

      const confirmBtn = wrapper.findAll("button")[0];
      expect(confirmBtn.classes()).toContain("disabled:bg-gray-400");
    });
  });

  describe("圖標顯示", () => {
    it("應該顯示預設問號圖標", () => {
      const iconContainer = wrapper.find(".bg-blue-100.rounded-full");
      expect(iconContainer.exists()).toBe(true);

      const icon = wrapper.find("svg");
      expect(icon.exists()).toBe(true);
      expect(icon.classes()).toContain("text-blue-600");
    });
  });

  describe("響應式設計", () => {
    it("應該有響應式樣式", () => {
      const modal = wrapper.find(".bg-white.rounded-2xl");
      expect(modal.exists()).toBe(true);
      expect(modal.classes()).toContain("max-w-sm");
      expect(modal.classes()).toContain("w-full");
    });

    it("應該有適當的邊距", () => {
      const container = wrapper.find(".flex.items-center.justify-center.p-4");
      expect(container.exists()).toBe(true);
    });
  });

  describe("內容區域", () => {
    it("標題應該有正確的樣式", () => {
      const title = wrapper.find("h3");
      expect(title.classes()).toContain("text-lg");
      expect(title.classes()).toContain("font-semibold");
      expect(title.classes()).toContain("text-gray-900");
      expect(title.classes()).toContain("text-center");
    });

    it("訊息應該有正確的樣式", () => {
      const message = wrapper.find("p");
      expect(message.classes()).toContain("text-gray-600");
      expect(message.classes()).toContain("text-center");
    });
  });

  describe("按鈕區域", () => {
    it("按鈕應該有全寬樣式", () => {
      const buttons = wrapper.findAll("button");

      buttons.forEach((button) => {
        expect(button.classes()).toContain("w-full");
        expect(button.classes()).toContain("py-3");
        expect(button.classes()).toContain("px-4");
        expect(button.classes()).toContain("rounded-xl");
      });
    });

    it("確認按鈕應該在取消按鈕之前", () => {
      const buttons = wrapper.findAll("button");
      expect(buttons.length).toBe(2);

      // 確認按鈕是第一個
      expect(buttons[0].classes()).toContain("bg-indigo-600");
      // 取消按鈕是第二個
      expect(buttons[1].classes()).toContain("bg-white");
    });
  });

  describe("預設值測試", () => {
    it("應該支援預設確認文字", async () => {
      await wrapper.setProps({ confirmText: undefined });

      const confirmBtn = wrapper.findAll("button")[0];
      expect(confirmBtn.text()).toBeTruthy(); // 應該有文字內容
    });

    it("應該支援預設取消文字", async () => {
      await wrapper.setProps({ cancelText: undefined });

      const buttons = wrapper.findAll("button");
      const cancelBtn = buttons[1];
      expect(cancelBtn.text()).toBeTruthy(); // 應該有文字內容
    });
  });

  describe("邊界情況", () => {
    it("應該處理空的標題", async () => {
      await wrapper.setProps({ title: "" });

      const title = wrapper.find("h3");
      expect(title.exists()).toBe(true);
      expect(title.text()).toBe("");
    });

    it("應該處理空的訊息", async () => {
      await wrapper.setProps({ message: "" });

      const message = wrapper.find("p");
      expect(message.exists()).toBe(true);
      expect(message.text()).toBe("");
    });

    it("應該處理長文本", async () => {
      const longMessage = "這是一個非常長的確認訊息".repeat(10);
      await wrapper.setProps({ message: longMessage });

      const message = wrapper.find("p");
      expect(message.text()).toContain(longMessage);
    });
  });

  describe("動畫與過渡", () => {
    it("按鈕應該有過渡動畫", () => {
      const buttons = wrapper.findAll("button");

      buttons.forEach((button) => {
        expect(button.classes()).toContain("transition-colors");
      });
    });

    it("容器應該有陰影效果", () => {
      const modal = wrapper.find(".bg-white.rounded-2xl");
      expect(modal.classes()).toContain("shadow-xl");
    });
  });

  describe("可存取性", () => {
    it("按鈕應該是按鈕類型", () => {
      const buttons = wrapper.findAll("button");

      buttons.forEach((button) => {
        expect(button.element.tagName).toBe("BUTTON");
      });
    });

    it("模態框應該阻止背景點擊冒泡", async () => {
      const modal = wrapper.find(".bg-white.rounded-2xl");
      await modal.trigger("click");

      // 不應該觸發 cancel 事件
      expect(wrapper.emitted("cancel")).toBeFalsy();
    });
  });
});
