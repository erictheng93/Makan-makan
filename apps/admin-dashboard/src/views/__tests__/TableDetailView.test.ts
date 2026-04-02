/**
 * TableDetailView Component Tests
 * Tests for the table detail view including table info, QR code, seat management,
 * status display, mode switching, and API interactions.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { ref } from "vue";

// ── Hoisted mocks ───────────────────────────────────────────────────────────

const mockApiGet = vi.hoisted(() => vi.fn());
const mockApiPost = vi.hoisted(() => vi.fn());
const mockApiDelete = vi.hoisted(() => vi.fn());

// ── Module mocks ────────────────────────────────────────────────────────────

vi.mock("@/services/api", () => ({
  api: {
    get: mockApiGet,
    post: mockApiPost,
    delete: mockApiDelete,
  },
}));

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        "tableDetail.backToList": "返回列表",
        "tableDetail.editTable": "編輯桌台",
        "tableDetail.switchMode": "切換模式",
        "tableDetail.capacity": "容量",
        "tableDetail.location": "位置",
        "tableDetail.locationNotSet": "未設置",
        "tableDetail.seatCount": "座位數",
        "tableDetail.usageCount": "使用次數",
        "tableDetail.tableMode": "桌台模式",
        "tableDetail.seatMode": "座位模式",
        "tableDetail.qrCode.title": "QR碼",
        "tableDetail.qrCode.preview": "QR碼預覽",
        "tableDetail.qrCode.download": "下載",
        "tableDetail.qrCode.print": "列印",
        "tableDetail.qrCode.regenerate": "重新生成",
        "tableDetail.status.available": "可用",
        "tableDetail.status.occupied": "使用中",
        "tableDetail.status.reserved": "已預訂",
        "tableDetail.status.maintenance": "維護中",
        "tableDetail.modeSwitch.title": "切換模式",
        "tableDetail.modeSwitch.currentMode": "當前模式：",
        "tableDetail.modeSwitch.cancel": "取消",
        "tableDetail.modeSwitch.confirm": "確認",
        "tableDetail.confirm.regenerateConfirm": "確定重新生成？",
        "tableDetail.confirm.regenerateFailed": "重新生成失敗",
        "tableDetail.confirm.occupiedError": "使用中無法切換",
        "tableDetail.confirm.switchFailed": "切換失敗",
      };
      if (key === "tableDetail.tableNumber")
        return `桌台 ${params?.number ?? ""}`;
      if (key === "tableDetail.capacityValue")
        return `${params?.count ?? 0} 人`;
      if (key === "tableDetail.seatCountValue")
        return `${params?.count ?? 0} 個`;
      if (key === "tableDetail.usageCountValue")
        return `${params?.count ?? 0} 次`;
      if (key === "tableDetail.confirm.switchMode")
        return `確定切換到${params?.mode}？`;
      return map[key] ?? key;
    },
  }),
}));

const mockPush = vi.fn();
const mockRouteParams = ref<Record<string, string>>({ id: "42" });
vi.mock("vue-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => ({
    get params() {
      return mockRouteParams.value;
    },
  }),
}));

// Stub heroicons
vi.mock("@heroicons/vue/24/outline", () => {
  const stub = { template: "<span />" };
  return { ArrowLeftIcon: stub, XMarkIcon: stub };
});
vi.mock("@heroicons/vue/24/outline/QrCodeIcon", () => ({
  default: { template: "<span />" },
}));

// ── Import after mocks ──────────────────────────────────────────────────────

import TableDetailView from "../TableDetailView.vue";

// ── Helpers ─────────────────────────────────────────────────────────────────

const sampleTableResponse = {
  data: {
    success: true,
    data: {
      id: 42,
      number: "A1",
      name: "Window Table",
      capacity: 4,
      location: "窗邊",
      isActive: true,
      isOccupied: false,
      qrMode: "table",
      qrCode: "https://example.com/qr/42",
      totalUsage: 15,
    },
  },
};

const sampleSeatTableResponse = {
  data: {
    success: true,
    data: {
      id: 42,
      number: "B2",
      name: "Seat Table",
      capacity: 6,
      location: "大廳",
      isActive: true,
      isOccupied: false,
      qrMode: "seat",
      qrCode: "",
      totalUsage: 8,
    },
  },
};

const sampleSeatsResponse = {
  data: {
    success: true,
    data: [
      { id: 1, seatNumber: "B2-1", tableId: 42 },
      { id: 2, seatNumber: "B2-2", tableId: 42 },
      { id: 3, seatNumber: "B2-3", tableId: 42 },
    ],
  },
};

const mountView = (stubs: Record<string, any> = {}) => {
  return mount(TableDetailView, {
    global: {
      stubs: {
        SeatManagement: {
          name: "SeatManagement",
          template: '<div data-testid="seat-management">Seat Management</div>',
          props: ["tableId", "tableNumber", "seats", "gridColumns"],
          emits: ["update"],
        },
        QRModeSelector: {
          name: "QRModeSelector",
          template: '<div data-testid="qr-mode-selector">Mode Selector</div>',
          props: ["modelValue", "seatConfig"],
          emits: ["update:modelValue", "update:seatConfig"],
        },
        ...stubs,
      },
    },
  });
};

// ── Tests ───────────────────────────────────────────────────────────────────

describe("TableDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRouteParams.value = { id: "42" };
  });

  describe("Loading and API calls", () => {
    it("calls API with table ID from route params on mount", async () => {
      mockApiGet.mockResolvedValue(sampleTableResponse);
      mountView();
      await flushPromises();

      expect(mockApiGet).toHaveBeenCalledWith("/tables/42");
    });

    it("does not call API when route params has no id", async () => {
      mockRouteParams.value = {};
      mockApiGet.mockResolvedValue(sampleTableResponse);
      mountView();
      await flushPromises();

      expect(mockApiGet).not.toHaveBeenCalled();
    });
  });

  describe("Table info display", () => {
    it("renders table number", async () => {
      mockApiGet.mockResolvedValue(sampleTableResponse);
      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain("桌台 A1");
    });

    it("renders table capacity", async () => {
      mockApiGet.mockResolvedValue(sampleTableResponse);
      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain("4 人");
    });

    it("renders table location", async () => {
      mockApiGet.mockResolvedValue(sampleTableResponse);
      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain("窗邊");
    });

    it("shows '未設置' when location is empty", async () => {
      const noLocationResponse = {
        data: {
          success: true,
          data: { ...sampleTableResponse.data.data, location: "" },
        },
      };
      mockApiGet.mockResolvedValue(noLocationResponse);
      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain("未設置");
    });

    it("renders table status badge as available", async () => {
      mockApiGet.mockResolvedValue(sampleTableResponse);
      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain("可用");
    });

    it("renders occupied status when table is occupied", async () => {
      const occupiedResponse = {
        data: {
          success: true,
          data: { ...sampleTableResponse.data.data, isOccupied: true },
        },
      };
      mockApiGet.mockResolvedValue(occupiedResponse);
      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain("使用中");
    });

    it("renders maintenance status when table is inactive", async () => {
      const inactiveResponse = {
        data: {
          success: true,
          data: { ...sampleTableResponse.data.data, isActive: false },
        },
      };
      mockApiGet.mockResolvedValue(inactiveResponse);
      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain("維護中");
    });

    it("shows usage count", async () => {
      mockApiGet.mockResolvedValue(sampleTableResponse);
      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain("15 次");
    });

    it("shows QR mode badge (table mode)", async () => {
      mockApiGet.mockResolvedValue(sampleTableResponse);
      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain("桌台模式");
    });
  });

  describe("QR code section (table mode)", () => {
    it("renders QR code section in table mode", async () => {
      mockApiGet.mockResolvedValue(sampleTableResponse);
      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain("QR碼");
      expect(wrapper.text()).toContain("https://example.com/qr/42");
    });

    it("renders download, print, and regenerate buttons", async () => {
      mockApiGet.mockResolvedValue(sampleTableResponse);
      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain("下載");
      expect(wrapper.text()).toContain("列印");
      expect(wrapper.text()).toContain("重新生成");
    });

    it("calls API to regenerate QR code when regenerate is clicked", async () => {
      mockApiGet.mockResolvedValue(sampleTableResponse);
      mockApiPost.mockResolvedValue({
        data: { success: true, data: { qrCode: "https://example.com/qr/new" } },
      });
      // Mock confirm to return true
      vi.spyOn(window, "confirm").mockReturnValue(true);

      const wrapper = mountView();
      await flushPromises();

      const regenBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("重新生成"));
      expect(regenBtn).toBeTruthy();
      await regenBtn!.trigger("click");
      await flushPromises();

      expect(mockApiPost).toHaveBeenCalledWith("/tables/42/regenerate-qr", {});
    });
  });

  describe("Seat mode", () => {
    it("shows SeatManagement component in seat mode", async () => {
      mockApiGet
        .mockResolvedValueOnce(sampleSeatTableResponse)
        .mockResolvedValueOnce(sampleSeatsResponse);
      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.find('[data-testid="seat-management"]').exists()).toBe(
        true,
      );
    });

    it("loads seats when in seat mode", async () => {
      mockApiGet
        .mockResolvedValueOnce(sampleSeatTableResponse)
        .mockResolvedValueOnce(sampleSeatsResponse);
      mountView();
      await flushPromises();

      expect(mockApiGet).toHaveBeenCalledWith("/seats", { tableId: 42 });
    });

    it("shows seat mode badge", async () => {
      mockApiGet
        .mockResolvedValueOnce(sampleSeatTableResponse)
        .mockResolvedValueOnce(sampleSeatsResponse);
      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain("座位模式");
    });
  });

  describe("Navigation", () => {
    it("navigates back to /tables when back button is clicked", async () => {
      mockApiGet.mockResolvedValue(sampleTableResponse);
      const wrapper = mountView();
      await flushPromises();

      const backBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("返回列表"));
      expect(backBtn).toBeTruthy();
      await backBtn!.trigger("click");

      expect(mockPush).toHaveBeenCalledWith("/tables");
    });
  });

  describe("Edit and mode switch buttons", () => {
    it("renders edit table button", async () => {
      mockApiGet.mockResolvedValue(sampleTableResponse);
      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain("編輯桌台");
    });

    it("renders switch mode button", async () => {
      mockApiGet.mockResolvedValue(sampleTableResponse);
      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain("切換模式");
    });
  });
});
