// @vitest-environment jsdom

import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TableSetupTab from "./TableSetupTab.vue";
import { api } from "@/services/api";

// restaurants.id is a TEXT UUID v7 — the whole point of this suite is that it
// must reach the API as a string, never coerced through Number().
const RESTAURANT_ID = "019469a0-0099-7000-8000-000000000099";

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

const confirmMock = vi.hoisted(() => vi.fn());

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ restaurantId: RESTAURANT_ID }),
}));

vi.mock("@/i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock("vue-toastification", () => ({
  useToast: () => toastMock,
}));

vi.mock("@/composables/useConfirmModal", () => ({
  useConfirmModal: () => ({ confirm: confirmMock }),
}));

vi.mock("@/services/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
  unwrapApiList: (data: unknown) => (Array.isArray(data) ? data : []),
}));

function buildTable(overrides: Record<string, unknown> = {}) {
  return {
    id: 11,
    number: "A1",
    name: "Window",
    capacity: 4,
    location: "1F",
    isActive: true,
    isOccupied: false,
    qrCode: "https://app.test/order?t=table",
    ...overrides,
  };
}

async function mountTab(tables: Record<string, unknown>[] = []) {
  vi.mocked(api.get).mockResolvedValue({
    data: { success: true, data: tables },
  } as never);

  const wrapper = mount(TableSetupTab, {
    global: { stubs: { QRModeSelector: true, QRCodeRenderer: true } },
  });
  await flushPromises();
  return wrapper;
}

describe("TableSetupTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirmMock.mockResolvedValue(true);
  });

  it("sends restaurantId as a string when creating a table", async () => {
    const wrapper = await mountTab();
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } } as never);

    const vm = wrapper.vm as unknown as {
      tableForm: { tableNumber: string; capacity: number };
      saveTable: () => Promise<void>;
    };
    vm.tableForm.tableNumber = "A1";
    vm.tableForm.capacity = 4;
    await vm.saveTable();
    await flushPromises();

    expect(api.post).toHaveBeenCalledWith(
      "/tables",
      expect.objectContaining({ restaurantId: RESTAURANT_ID, number: "A1" }),
    );
    // Regression guard: Number(uuid) is NaN, which JSON-serialises to null and
    // the API rejects with VALIDATION_ERROR.
    const payload = vi.mocked(api.post).mock.calls[0][1] as {
      restaurantId: unknown;
    };
    expect(typeof payload.restaurantId).toBe("string");
    expect(toastMock.success).toHaveBeenCalled();
  });

  it("sends seat mode configuration when creating a table", async () => {
    const wrapper = await mountTab();
    vi.mocked(api.post).mockResolvedValue({
      data: {
        success: true,
        data: { ...buildTable(), qrMode: "seat", seatCount: 4 },
      },
    } as never);

    const vm = wrapper.vm as unknown as {
      tableForm: {
        tableNumber: string;
        capacity: number;
        qrMode: "table" | "seat";
        seatConfig: {
          count: number;
          numberingStyle: "numeric" | "alphabetic";
        };
      };
      saveTable: () => Promise<void>;
    };
    vm.tableForm.tableNumber = "A1";
    vm.tableForm.capacity = 4;
    vm.tableForm.qrMode = "seat";
    vm.tableForm.seatConfig = {
      count: 4,
      numberingStyle: "alphabetic",
    };

    await vm.saveTable();
    await flushPromises();

    expect(api.post).toHaveBeenCalledWith(
      "/tables",
      expect.objectContaining({
        qrMode: "seat",
        seatCount: 4,
        seatNumberingStyle: "alphabetic",
      }),
    );
    expect(api.post).not.toHaveBeenCalledWith(
      "/seats/batch-create",
      expect.anything(),
    );
  });

  it("maps persisted seat settings back into the edit form", async () => {
    const wrapper = await mountTab([
      buildTable({
        qrMode: "seat",
        seatCount: 3,
        seatNumberingStyle: "alphabetic",
      }),
    ]);

    const vm = wrapper.vm as unknown as {
      tables: Array<Record<string, unknown>>;
      tableForm: {
        qrMode: "table" | "seat";
        seatConfig: { count: number; numberingStyle: string };
      };
      editTable: (table: Record<string, unknown>) => void;
    };
    vm.editTable(vm.tables[0]);

    expect(vm.tableForm.qrMode).toBe("seat");
    expect(vm.tableForm.seatConfig).toEqual({
      count: 3,
      numberingStyle: "alphabetic",
    });
  });

  it("sends restaurantId as a string when bulk-generating QR codes", async () => {
    const wrapper = await mountTab([buildTable()]);
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } } as never);

    await (
      wrapper.vm as unknown as { generateAllQRCodes: () => Promise<void> }
    ).generateAllQRCodes();
    await flushPromises();

    expect(api.post).toHaveBeenCalledWith("/tables/bulk-qr", {
      restaurantId: RESTAURANT_ID,
      tableIds: [11],
    });
  });

  it("omits orderId when manually marking an available table occupied", async () => {
    const wrapper = await mountTab([buildTable()]);
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } } as never);

    await (
      wrapper.vm as unknown as {
        changeTableStatus: (t: unknown) => Promise<void>;
      }
    ).changeTableStatus({ id: 11, status: "available" });
    await flushPromises();

    // orderId: 0 fails occupyTableSchema (positive number | non-empty string)
    expect(api.post).toHaveBeenCalledWith("/tables/11/occupy", {
      occupiedBy: "manual",
    });
    const payload = vi.mocked(api.post).mock.calls[0][1] as Record<
      string,
      unknown
    >;
    expect(payload).not.toHaveProperty("orderId");
  });

  it("surfaces a toast instead of failing silently when saving fails", async () => {
    const wrapper = await mountTab();
    vi.mocked(api.post).mockRejectedValue(new Error("400"));

    const vm = wrapper.vm as unknown as {
      tableForm: { tableNumber: string };
      saveTable: () => Promise<void>;
    };
    vm.tableForm.tableNumber = "A1";
    await vm.saveTable();
    await flushPromises();

    expect(toastMock.error).toHaveBeenCalledWith("tables.alert.saveFailed");
  });

  it("surfaces a toast when a status change fails", async () => {
    const wrapper = await mountTab([buildTable()]);
    vi.mocked(api.post).mockRejectedValue(new Error("400"));

    await (
      wrapper.vm as unknown as {
        changeTableStatus: (t: unknown) => Promise<void>;
      }
    ).changeTableStatus({ id: 11, status: "available" });
    await flushPromises();

    expect(toastMock.error).toHaveBeenCalledWith(
      "tables.alert.statusChangeFailed",
    );
  });
});
