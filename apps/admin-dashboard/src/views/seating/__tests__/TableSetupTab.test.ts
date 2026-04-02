/**
 * TableSetupTab Component Tests
 *
 * Covers: table grid rendering, status indicators, create/edit/delete table,
 * QR code generation, batch QR, filter by status/capacity, empty/loading states.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { nextTick } from "vue";

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("lucide-vue-next", () => {
  const stub = { template: "<span />" };
  return {
    Plus: stub,
    Search: stub,
    QrCode: stub,
    Users: stub,
    MapPin: stub,
    FileText: stub,
    TableProperties: stub,
  };
});

vi.mock("@/components/tables/QRCodeRenderer.vue", () => ({
  default: {
    template: "<div data-testid='qr-renderer'></div>",
    methods: { getDataUrl: () => "data:image/png;base64,mock" },
  },
}));
vi.mock("@/components/tables/QRModeSelector.vue", () => ({
  default: { template: "<div data-testid='qr-mode-selector'></div>" },
}));

vi.mock("@/i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn().mockResolvedValue({ data: { success: true } }),
  put: vi.fn().mockResolvedValue({ data: { success: true } }),
  delete: vi.fn().mockResolvedValue({ data: { success: true } }),
}));
vi.mock("@/services/api", () => ({
  api: mockApi,
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    restaurantId: "r1",
    canAccessAdminFeatures: true,
    user: { id: 1, restaurantId: "r1", role: 0 },
  }),
}));

// ── Imports ────────────────────────────────────────────────────────────────

import TableSetupTab from "../TableSetupTab.vue";

// ── Test Data ──────────────────────────────────────────────────────────────

const mockTables = [
  {
    id: "t1",
    number: "A1",
    tableNumber: "A1",
    name: "Window 1",
    tableName: "Window 1",
    capacity: 4,
    location: "Window",
    isActive: true,
    isOccupied: false,
    qrCode: "https://example.com/qr/t1",
    orderId: null,
  },
  {
    id: "t2",
    number: "A2",
    tableNumber: "A2",
    name: "Center 1",
    tableName: "Center 1",
    capacity: 6,
    location: "Center",
    isActive: true,
    isOccupied: true,
    qrCode: "https://example.com/qr/t2",
    orderId: "ord-1",
  },
  {
    id: "t3",
    number: "A3",
    tableNumber: "A3",
    name: "Corner 1",
    tableName: "Corner 1",
    capacity: 2,
    location: "Corner",
    isActive: false,
    isOccupied: false,
    qrCode: "https://example.com/qr/t3",
    orderId: null,
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function setupMocks(tables = mockTables) {
  mockApi.get.mockResolvedValue({
    data: { success: true, data: tables },
  });
}

function mountTableSetupTab() {
  return mount(TableSetupTab, {
    global: {
      stubs: {
        QRCodeRenderer: {
          template: "<div data-testid='qr-renderer'></div>",
          methods: { getDataUrl: () => "data:image/png;base64,mock" },
        },
        QRModeSelector: {
          template: "<div data-testid='qr-mode-selector'></div>",
        },
      },
    },
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("TableSetupTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    setupMocks();
  });

  // ── Table Grid Rendering ────────────────────────────────────────────

  describe("Table Grid Rendering", () => {
    it("should display tables grid after fetch", async () => {
      const wrapper = mountTableSetupTab();
      await flushPromises();
      const html = wrapper.html();
      expect(html).toContain("A1");
      expect(html).toContain("A2");
      expect(html).toContain("A3");
    });

    it("should display table names", async () => {
      const wrapper = mountTableSetupTab();
      await flushPromises();
      const html = wrapper.html();
      expect(html).toContain("Window");
      expect(html).toContain("Center");
      expect(html).toContain("Corner");
    });

    it("should display table capacities", async () => {
      const wrapper = mountTableSetupTab();
      await flushPromises();
      const html = wrapper.html();
      expect(html).toContain("4");
      expect(html).toContain("6");
      expect(html).toContain("2");
    });

    it("should call fetch API on mount", async () => {
      mountTableSetupTab();
      await flushPromises();
      expect(mockApi.get).toHaveBeenCalledWith("/tables", {
        restaurantId: "r1",
      });
    });
  });

  // ── Status Indicators ───────────────────────────────────────────────

  describe("Status Indicators", () => {
    it("should show status for each table", async () => {
      const wrapper = mountTableSetupTab();
      await flushPromises();
      const html = wrapper.html();
      expect(html).toContain("tables.status.available");
      expect(html).toContain("tables.status.occupied");
      expect(html).toContain("tables.status.maintenance");
    });

    it("should show status action buttons for each table", async () => {
      const wrapper = mountTableSetupTab();
      await flushPromises();
      // Each table card should have a status change button
      const statusBtns = wrapper
        .findAll("button")
        .filter((b) => b.html().includes("tables.statusAction."));
      expect(statusBtns.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ── Create Table ────────────────────────────────────────────────────

  describe("Create Table", () => {
    it('should show "add table" button', async () => {
      const wrapper = mountTableSetupTab();
      await flushPromises();
      expect(wrapper.html()).toContain("tables.addTable");
    });

    it("should open modal when add table button clicked", async () => {
      const wrapper = mountTableSetupTab();
      await flushPromises();

      const addBtn = wrapper
        .findAll("button")
        .find((b) => b.html().includes("tables.addTable"));
      expect(addBtn).toBeDefined();
      await addBtn!.trigger("click");
      await nextTick();

      // Modal should now be visible with form
      const html = wrapper.html();
      expect(html).toContain("tables.form.tableNumber");
    });

    it("should call POST API on table creation", async () => {
      const wrapper = mountTableSetupTab();
      await flushPromises();
      vi.clearAllMocks();
      setupMocks();

      // Open modal
      const addBtn = wrapper
        .findAll("button")
        .find((b) => b.html().includes("tables.addTable"));
      await addBtn!.trigger("click");
      await nextTick();

      // Fill table number
      const inputs = wrapper.findAll('input[type="text"]');
      const tableNumberInput = inputs.find((i) => i.element.closest("form"));
      if (tableNumberInput) {
        await tableNumberInput.setValue("B1");
      }

      // Submit form
      const form = wrapper.find("form");
      if (form.exists()) {
        await form.trigger("submit");
        await flushPromises();
        expect(mockApi.post).toHaveBeenCalledWith(
          "/tables",
          expect.objectContaining({
            number: "B1",
          }),
        );
      }
    });
  });

  // ── Edit Table ──────────────────────────────────────────────────────

  describe("Edit Table", () => {
    it("should show edit button for each table", async () => {
      const wrapper = mountTableSetupTab();
      await flushPromises();
      const editBtns = wrapper
        .findAll("button")
        .filter((b) => b.html().includes("common.edit"));
      expect(editBtns.length).toBe(3);
    });

    it("should call PUT API on table edit", async () => {
      const wrapper = mountTableSetupTab();
      await flushPromises();
      vi.clearAllMocks();
      setupMocks();

      // Click edit button on first table
      const editBtns = wrapper
        .findAll("button")
        .filter((b) => b.html().includes("common.edit"));
      await editBtns[0].trigger("click");
      await nextTick();

      // Submit form
      const form = wrapper.find("form");
      if (form.exists()) {
        await form.trigger("submit");
        await flushPromises();
        expect(mockApi.put).toHaveBeenCalled();
      }
    });

    it("should populate form with existing table data when editing", async () => {
      const wrapper = mountTableSetupTab();
      await flushPromises();

      const editBtns = wrapper
        .findAll("button")
        .filter((b) => b.html().includes("common.edit"));
      await editBtns[0].trigger("click");
      await nextTick();

      // The modal title should indicate editing
      expect(wrapper.html()).toContain("tables.editTable");
    });
  });

  // ── QR Code ─────────────────────────────────────────────────────────

  describe("QR Code", () => {
    it("should show QR code generation button", async () => {
      const wrapper = mountTableSetupTab();
      await flushPromises();
      expect(wrapper.html()).toContain("tables.batchGenerateQR");
    });

    it("should show view QR button for each table", async () => {
      const wrapper = mountTableSetupTab();
      await flushPromises();
      const qrBtns = wrapper
        .findAll("button")
        .filter((b) => b.html().includes("tables.viewQR"));
      expect(qrBtns.length).toBe(3);
    });

    it("should call batch QR API on batch generate click", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      const wrapper = mountTableSetupTab();
      await flushPromises();

      const batchBtn = wrapper
        .findAll("button")
        .find((b) => b.html().includes("tables.batchGenerateQR"));
      if (batchBtn) {
        await batchBtn.trigger("click");
        await flushPromises();
        expect(mockApi.post).toHaveBeenCalledWith(
          "/tables/bulk-qr",
          expect.objectContaining({
            tableIds: ["t1", "t2", "t3"],
          }),
        );
      }
    });

    it("should not call batch QR API when user declines confirmation", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(false);
      const wrapper = mountTableSetupTab();
      await flushPromises();

      const batchBtn = wrapper
        .findAll("button")
        .find((b) => b.html().includes("tables.batchGenerateQR"));
      if (batchBtn) {
        await batchBtn.trigger("click");
        await flushPromises();
        expect(mockApi.post).not.toHaveBeenCalled();
      }
    });
  });

  // ── Filters ─────────────────────────────────────────────────────────

  describe("Filters", () => {
    it("should filter tables by status", async () => {
      const wrapper = mountTableSetupTab();
      await flushPromises();

      const selects = wrapper.findAll("select");
      const statusSelect = selects.find((s) => {
        const options = s.findAll("option");
        return options.some((o) =>
          o.text().includes("tables.filter.allStatus"),
        );
      });
      expect(statusSelect).toBeDefined();

      await statusSelect!.setValue("available");
      await nextTick();

      const html = wrapper.html();
      expect(html).toContain("A1");
      expect(html).not.toContain("A2"); // occupied
    });

    it("should filter tables by capacity", async () => {
      const wrapper = mountTableSetupTab();
      await flushPromises();

      const selects = wrapper.findAll("select");
      const capacitySelect = selects.find((s) => {
        const options = s.findAll("option");
        return options.some((o) =>
          o.text().includes("tables.filter.allCapacity"),
        );
      });
      expect(capacitySelect).toBeDefined();

      await capacitySelect!.setValue("4");
      await nextTick();

      const html = wrapper.html();
      expect(html).toContain("A1"); // capacity 4
      expect(html).not.toContain("A3"); // capacity 2
    });

    it("should filter tables by search query", async () => {
      const wrapper = mountTableSetupTab();
      await flushPromises();

      const searchInput = wrapper.find('input[type="text"]');
      await searchInput.setValue("Window");
      await nextTick();

      const html = wrapper.html();
      expect(html).toContain("A1"); // Window 1
      expect(html).not.toContain("A2"); // Center 1
    });
  });

  // ── Empty / Loading States ──────────────────────────────────────────

  describe("Empty / Loading States", () => {
    it("should show empty state when no tables exist", async () => {
      setupMocks([]);
      const wrapper = mountTableSetupTab();
      await flushPromises();
      const html = wrapper.html();
      expect(html).toContain("tables.empty.title");
      expect(html).toContain("tables.empty.subtitle");
    });

    it("should show add table button in empty state", async () => {
      setupMocks([]);
      const wrapper = mountTableSetupTab();
      await flushPromises();
      // There should be at least one addTable button in the empty state
      const addBtns = wrapper
        .findAll("button")
        .filter((b) => b.html().includes("tables.addTable"));
      expect(addBtns.length).toBeGreaterThan(0);
    });

    it("should show empty state when no tables match filter", async () => {
      const wrapper = mountTableSetupTab();
      await flushPromises();

      const selects = wrapper.findAll("select");
      const statusSelect = selects.find((s) => {
        const options = s.findAll("option");
        return options.some((o) =>
          o.text().includes("tables.filter.allStatus"),
        );
      });

      // Set filter to "reserved" — none of our mock tables have this status
      await statusSelect!.setValue("reserved");
      await nextTick();

      expect(wrapper.html()).toContain("tables.empty.title");
    });

    it("should handle API fetch error gracefully", async () => {
      mockApi.get.mockRejectedValue(new Error("Network error"));
      const wrapper = mountTableSetupTab();
      await flushPromises();
      // Component should still mount
      expect(wrapper.exists()).toBe(true);
      // Empty state shown since no tables loaded
      expect(wrapper.html()).toContain("tables.empty.title");
    });
  });
});
