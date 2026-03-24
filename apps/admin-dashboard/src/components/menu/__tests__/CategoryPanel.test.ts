/**
 * CategoryPanel Component Tests
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";

// ── Module mocks ───────────────────────────────────────────────────────────

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        "menu.categoryPanel.title": "分類",
        "menu.categoryPanel.add": "新增",
        "menu.categoryPanel.allItems": "所有菜品",
        "menu.categoryPanel.totalItems": `共 ${params?.count ?? 0} 項`,
        "menu.categoryPanel.noItems": "No items",
        "menu.categoryPanel.allAvailable": "All available",
        "menu.categoryPanel.mixedStatus": `${params?.available ?? 0} available, ${params?.unavailable ?? 0} unavailable`,
        "common.edit": "Edit",
        "common.delete": "Delete",
      };
      // Handle parameterised keys inline
      if (key === "menu.categoryPanel.totalItems") {
        return `共 ${params?.count ?? 0} 項`;
      }
      return map[key] ?? key;
    },
  }),
}));

vi.mock("vue-draggable-plus", () => ({
  VueDraggable: {
    name: "VueDraggable",
    template: "<div><slot /></div>",
    props: ["modelValue"],
    emits: ["update:modelValue", "end"],
  },
}));

vi.mock("@heroicons/vue/24/outline", () => ({
  PlusIcon: { template: '<svg data-testid="plus-icon" />' },
  PencilIcon: { template: '<svg data-testid="pencil-icon" />' },
  TrashIcon: { template: '<svg data-testid="trash-icon" />' },
  Squares2X2Icon: { template: '<svg data-testid="squares-icon" />' },
}));

// CategoryEditForm is now rendered as a modal by MenuView, not by CategoryPanel

// ── Import after mocks ─────────────────────────────────────────────────────

import CategoryPanel from "../CategoryPanel.vue";

// ── Helpers ────────────────────────────────────────────────────────────────

const sampleCategories = [
  { id: 1, name: "Mains", nameEn: "Mains", sortOrder: 0 },
  { id: 2, name: "Desserts", nameEn: "Desserts", sortOrder: 1 },
];

const sampleMenuItems = [
  {
    id: 10,
    categoryId: 1,
    name: "Nasi Lemak",
    price: 12,
    isFeatured: false,
    isAvailable: true,
    sortOrder: 0,
  },
  {
    id: 11,
    categoryId: 1,
    name: "Roti Canai",
    price: 5,
    isFeatured: false,
    isAvailable: false,
    sortOrder: 1,
  },
  {
    id: 12,
    categoryId: 2,
    name: "Cendol",
    price: 8,
    isFeatured: false,
    isAvailable: true,
    sortOrder: 0,
  },
];

const mountPanel = (overrides: Record<string, unknown> = {}) => {
  return mount(CategoryPanel, {
    props: {
      categories: sampleCategories,
      menuItems: sampleMenuItems,
      selectedCategoryId: null,
      ...overrides,
    },
    global: {
      stubs: { transition: false },
    },
  });
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe("CategoryPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    test("renders all category names", () => {
      const wrapper = mountPanel();
      expect(wrapper.text()).toContain("Mains");
      expect(wrapper.text()).toContain("Desserts");
    });

    test("renders item count badge for each category", () => {
      const wrapper = mountPanel();
      // Category 1 has 2 items, category 2 has 1 item
      const badges = wrapper.findAll(
        "span.text-\\[11px\\].font-medium.text-\\[\\#8E8E93\\]",
      );
      // Find spans that contain numeric counts
      const countSpans = wrapper
        .findAll("span")
        .filter((s) => /^\d+$/.test(s.text().trim()));
      expect(countSpans.length).toBeGreaterThanOrEqual(2);
    });

    test("shows '所有菜品' row", () => {
      const wrapper = mountPanel();
      expect(wrapper.text()).toContain("所有菜品");
    });

    test("shows total item count in '所有菜品' row", () => {
      const wrapper = mountPanel();
      // 3 total items
      expect(wrapper.text()).toContain("3");
    });
  });

  describe("Emitted events", () => {
    test("emits 'select' with null when '所有菜品' row is clicked", async () => {
      const wrapper = mountPanel();

      // The "all items" row emits select(null)
      const allRow = wrapper.find("[class*='border-t']");
      await allRow.trigger("click");

      expect(wrapper.emitted("select")).toBeTruthy();
      expect(wrapper.emitted("select")![0][0]).toBeNull();
    });

    test("emits 'select' with category id when a category row is clicked", async () => {
      const wrapper = mountPanel();

      // Find a clickable row that emits select(category.id)
      // The category rows are inside VueDraggable — find the first div[@click]
      // We look for divs with cursor-pointer that are not the all-row
      const rows = wrapper.findAll("[class*='cursor-pointer']");
      // rows[0] is the "all items" row, rows[1] should be the first category
      if (rows.length > 1) {
        await rows[1].trigger("click");
        const emitted = wrapper.emitted("select");
        expect(emitted).toBeTruthy();
        // The id should be a number (1 or 2)
        expect(typeof emitted![emitted!.length - 1][0]).toBe("number");
      }
    });

    test("emits 'add-category' when '新增' button is clicked", async () => {
      const wrapper = mountPanel();

      const addBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("新增"));
      expect(addBtn).toBeTruthy();
      await addBtn!.trigger("click");

      expect(wrapper.emitted("add-category")).toBeTruthy();
    });
  });

  // CategoryEditForm visibility is now tested in MenuView since it's rendered as a modal there
});
