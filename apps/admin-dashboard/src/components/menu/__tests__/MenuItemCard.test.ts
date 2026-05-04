/**
 * MenuItemCard Component Tests
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { menuItemFactory, resetAllFactories } from "@makanmasak/testing-utils";

// ── Module mocks ───────────────────────────────────────────────────────────

vi.mock("@/i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock("@/composables/useCurrency", () => ({
  useCurrency: () => ({
    formatPrice: (price: number) => `RM ${price.toFixed(2)}`,
  }),
}));

vi.mock("@/components/OptimizedImage.vue", () => ({
  default: { template: '<img data-testid="optimized-image" />' },
}));

// Stub heroicons so they don't throw
vi.mock("@heroicons/vue/24/outline", () => ({
  PencilIcon: { template: '<svg data-testid="pencil-icon" />' },
  TrashIcon: { template: '<svg data-testid="trash-icon" />' },
  EyeIcon: { template: '<svg data-testid="eye-icon" />' },
  EyeSlashIcon: { template: '<svg data-testid="eye-slash-icon" />' },
}));

// ── Import after mocks ─────────────────────────────────────────────────────

import MenuItemCard from "../MenuItemCard.vue";

// ── Helpers ────────────────────────────────────────────────────────────────

const factoryItem = menuItemFactory.build({
  overrides: {
    id: 1,
    categoryId: 1,
    name: "Nasi Lemak",
    description: "Traditional Malaysian dish",
    price: 12.5,
    imageUrl: null,
    isFeatured: false,
    isAvailable: true,
    sortOrder: 0,
  },
});
const baseItem = {
  id: factoryItem.id,
  categoryId: factoryItem.categoryId,
  name: factoryItem.name,
  nameEn: "Nasi Lemak",
  description: factoryItem.description,
  price: factoryItem.price,
  imageUrl: factoryItem.imageUrl,
  isFeatured: factoryItem.isFeatured,
  isAvailable: factoryItem.isAvailable,
  sortOrder: factoryItem.sortOrder,
};

const mountCard = (itemOverrides = {}, categoryName?: string) => {
  return mount(MenuItemCard, {
    props: {
      item: { ...baseItem, ...itemOverrides },
      ...(categoryName !== undefined ? { categoryName } : {}),
    },
    global: {
      stubs: {
        transition: false,
      },
    },
  });
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe("MenuItemCard", () => {
  beforeEach(() => {
    resetAllFactories();
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    test("renders item name", () => {
      const wrapper = mountCard();
      expect(wrapper.text()).toContain("Nasi Lemak");
    });

    test("renders formatted price", () => {
      const wrapper = mountCard({ price: 12.5 });
      expect(wrapper.text()).toContain("RM 12.50");
    });

    test("renders category name when provided", () => {
      const wrapper = mountCard({}, "Mains");
      expect(wrapper.text()).toContain("Mains");
    });

    test("renders item description", () => {
      const wrapper = mountCard({ description: "A tasty dish" });
      expect(wrapper.text()).toContain("A tasty dish");
    });
  });

  describe("Featured badge", () => {
    test("shows 'Featured' badge when isFeatured is true", () => {
      const wrapper = mountCard({ isFeatured: true });
      expect(wrapper.text()).toContain("menu.featured");
    });

    test("does not show 'Featured' badge when isFeatured is false", () => {
      const wrapper = mountCard({ isFeatured: false });
      // The span is rendered as empty via v-else, so text should not include the key
      const featuredSpan = wrapper
        .findAll("span")
        .find((s) => s.text() === "menu.featured");
      expect(featuredSpan).toBeUndefined();
    });
  });

  describe("Availability badge", () => {
    test("shows 'Available' badge when isAvailable is true", () => {
      const wrapper = mountCard({ isAvailable: true });
      expect(wrapper.text()).toContain("menu.available");
    });

    test("shows 'Unavailable/soldOut' badge when isAvailable is false", () => {
      const wrapper = mountCard({ isAvailable: false });
      expect(wrapper.text()).toContain("menu.soldOut");
    });
  });

  describe("Emitted events", () => {
    test("emits 'edit' event with item on edit button click", async () => {
      const wrapper = mountCard();
      // Edit button is the first action button
      const buttons = wrapper.findAll("button");
      await buttons[0].trigger("click");

      expect(wrapper.emitted("edit")).toBeTruthy();
      expect(wrapper.emitted("edit")![0][0]).toMatchObject({ id: 1 });
    });

    test("emits 'toggle-status' event with item on toggle button click", async () => {
      const wrapper = mountCard();
      const buttons = wrapper.findAll("button");
      await buttons[1].trigger("click");

      expect(wrapper.emitted("toggle-status")).toBeTruthy();
      expect(wrapper.emitted("toggle-status")![0][0]).toMatchObject({ id: 1 });
    });

    test("emits 'delete' event with item on delete button click", async () => {
      const wrapper = mountCard();
      const buttons = wrapper.findAll("button");
      await buttons[2].trigger("click");

      expect(wrapper.emitted("delete")).toBeTruthy();
      expect(wrapper.emitted("delete")![0][0]).toMatchObject({ id: 1 });
    });
  });
});
