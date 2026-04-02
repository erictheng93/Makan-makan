/**
 * MenuView Component Tests
 * Tests for the menu management view including stats, category management,
 * menu item display, search/filter, CRUD operations, and error/loading states.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { mount, flushPromises, VueWrapper } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { ref, computed, nextTick } from "vue";
import MenuView from "../MenuView.vue";

// ── Mock data ────────────────────────────────────────────────────────────────

const mockCategories = [
  {
    id: 1,
    name: "主食",
    nameEn: "Main Course",
    description: "Main dishes",
    sortOrder: 0,
    isActive: true,
  },
  {
    id: 2,
    name: "飲品",
    nameEn: "Drinks",
    description: "Beverages",
    sortOrder: 1,
    isActive: true,
  },
  {
    id: 3,
    name: "甜點",
    nameEn: "Desserts",
    description: "Sweet treats",
    sortOrder: 2,
    isActive: true,
  },
];

const mockMenuItems = [
  {
    id: 1,
    categoryId: 1,
    name: "椰漿飯",
    nameEn: "Nasi Lemak",
    description: "Coconut rice with sambal",
    price: 12.5,
    imageUrl: "https://example.com/nasi.jpg",
    isFeatured: true,
    isAvailable: true,
    sortOrder: 0,
    orderCount: 150,
    rating: 4.8,
  },
  {
    id: 2,
    categoryId: 1,
    name: "炒粿條",
    nameEn: "Char Kway Teow",
    description: "Stir-fried flat noodles",
    price: 10.0,
    imageUrl: "https://example.com/ckt.jpg",
    isFeatured: false,
    isAvailable: true,
    sortOrder: 1,
    orderCount: 80,
    rating: 4.5,
  },
  {
    id: 3,
    categoryId: 2,
    name: "拉茶",
    nameEn: "Teh Tarik",
    description: "Pulled milk tea",
    price: 5.0,
    imageUrl: null,
    isFeatured: false,
    isAvailable: false,
    sortOrder: 0,
    orderCount: 200,
    rating: 4.9,
  },
  {
    id: 4,
    categoryId: 3,
    name: "摩摩喳喳",
    nameEn: "Bubur Cha Cha",
    description: "Sweet potato dessert",
    price: 6.0,
    imageUrl: "https://example.com/bubur.jpg",
    isFeatured: true,
    isAvailable: true,
    sortOrder: 0,
    orderCount: 50,
  },
];

// ── Composable mock state ────────────────────────────────────────────────────

const mockCategoriesRef = ref([...mockCategories]);
const mockMenuItemsRef = ref([...mockMenuItems]);
const mockIsLoading = ref(false);
const mockSelectedCategoryId = ref<number | null>(null);

const mockFetchMenu = vi.fn().mockResolvedValue(undefined);
const mockSaveCategory = vi.fn().mockResolvedValue(undefined);
const mockDeleteCategory = vi.fn().mockResolvedValue(undefined);
const mockReorderCategories = vi.fn().mockResolvedValue(undefined);
const mockSaveMenuItem = vi.fn().mockResolvedValue(undefined);
const mockDeleteMenuItem = vi.fn().mockResolvedValue(undefined);
const mockToggleMenuItemStatus = vi.fn().mockResolvedValue(undefined);

const mockGetCategoryName = vi.fn((categoryId: number) => {
  const cat = mockCategoriesRef.value.find((c) => c.id === categoryId);
  return cat?.name ?? "menu.unknownCategory";
});

vi.mock("@/composables/useMenuManagement", () => ({
  useMenuManagement: () => ({
    categories: mockCategoriesRef,
    menuItems: mockMenuItemsRef,
    isLoading: mockIsLoading,
    selectedCategoryId: mockSelectedCategoryId,
    filteredItemsByCategory: computed(() => {
      if (mockSelectedCategoryId.value === null) return mockMenuItemsRef.value;
      return mockMenuItemsRef.value.filter(
        (item) => item.categoryId === mockSelectedCategoryId.value,
      );
    }),
    getCategoryName: mockGetCategoryName,
    fetchMenu: mockFetchMenu,
    saveCategory: mockSaveCategory,
    deleteCategory: mockDeleteCategory,
    reorderCategories: mockReorderCategories,
    saveMenuItem: mockSaveMenuItem,
    deleteMenuItem: mockDeleteMenuItem,
    toggleMenuItemStatus: mockToggleMenuItemStatus,
  }),
}));

// Mock i18n
vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) return `${key}`;
      return key;
    },
  }),
}));

// Mock vue-router
const mockRouteQuery = ref<Record<string, string>>({});
vi.mock("vue-router", () => ({
  useRoute: () => ({
    get query() {
      return mockRouteQuery.value;
    },
  }),
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock vue-toastification
const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("vue-toastification", () => ({
  useToast: () => ({ success: mockToastSuccess, error: mockToastError }),
}));

// Mock auth store
vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    user: { id: 1, username: "admin", role: 0 },
    restaurantId: "r1",
    isAuthenticated: true,
  }),
}));

// Mock heroicons
vi.mock("@heroicons/vue/24/outline", () => {
  const stub = { template: "<span />" };
  return {
    PlusIcon: stub,
    MagnifyingGlassIcon: stub,
    CakeIcon: stub,
    ExclamationTriangleIcon: stub,
    PencilIcon: stub,
    TrashIcon: stub,
    EyeIcon: stub,
    EyeSlashIcon: stub,
    Squares2X2Icon: stub,
    ShoppingBagIcon: stub,
    StarIcon: stub,
    Bars3Icon: stub,
  };
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function mountView() {
  return mount(MenuView, {
    global: {
      stubs: {
        CategoryPanel: {
          name: "CategoryPanel",
          template: `<div data-testid="category-panel">
            <div v-for="c in categories" :key="c.id" :data-testid="'cat-' + c.id" @click="$emit('select', c.id)">{{ c.name }}</div>
            <button data-testid="add-category-btn" @click="$emit('add-category')">Add</button>
            <button v-for="c in categories" :key="'edit-'+c.id" :data-testid="'edit-cat-'+c.id" @click="$emit('edit-category', c)">Edit</button>
            <button v-for="c in categories" :key="'del-'+c.id" :data-testid="'del-cat-'+c.id" @click="$emit('delete-category', c)">Delete</button>
          </div>`,
          props: ["categories", "menuItems", "selectedCategoryId"],
          emits: [
            "select",
            "add-category",
            "edit-category",
            "delete-category",
            "reorder",
          ],
        },
        CategoryEditForm: {
          name: "CategoryEditForm",
          template:
            "<div data-testid=\"category-edit-form\"><button data-testid=\"save-category-btn\" @click=\"$emit('save', { name: 'New Cat', nameEn: '', description: '', sortOrder: 0 })\">Save</button><button data-testid=\"cancel-category-btn\" @click=\"$emit('cancel')\">Cancel</button></div>",
          props: ["editingCategory"],
          emits: ["save", "cancel"],
        },
        MenuItemCard: {
          name: "MenuItemCard",
          template: `<div data-testid="menu-item-card">
            <span>{{ item.name }}</span>
            <span>{{ item.price }}</span>
            <button data-testid="edit-item-btn" @click="$emit('edit', item)">Edit</button>
            <button data-testid="toggle-status-btn" @click="$emit('toggle-status', item)">Toggle</button>
            <button data-testid="delete-item-btn" @click="$emit('delete', item)">Delete</button>
          </div>`,
          props: ["item", "categoryName", "highlighted"],
          emits: ["edit", "toggle-status", "delete"],
        },
        VirtualMenuGrid: {
          name: "VirtualMenuGrid",
          template: `<div data-testid="virtual-menu-grid"><template v-for="item in menuItems" :key="item.id"><slot :menuItem="item" /></template></div>`,
          props: [
            "menuItems",
            "itemHeight",
            "containerHeight",
            "columnsCount",
            "bufferSize",
          ],
          methods: {
            scrollToMenuItem: vi.fn(),
          },
        },
      },
    },
  });
}

function resetMockState() {
  mockCategoriesRef.value = JSON.parse(JSON.stringify(mockCategories));
  mockMenuItemsRef.value = JSON.parse(JSON.stringify(mockMenuItems));
  mockIsLoading.value = false;
  mockSelectedCategoryId.value = null;
  mockRouteQuery.value = {};
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("MenuView Component", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    resetMockState();
  });

  // ── 1. Mounting & Layout ──────────────────────────────────────────────────

  describe("Mounting & Layout", () => {
    it("should render menu management heading", async () => {
      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain("menu.title");
    });

    it("should display stats chips with categories count", async () => {
      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain("menu.stats.categories");
      expect(wrapper.text()).toContain(String(mockCategories.length));
    });

    it("should display stats chips with items count", async () => {
      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain("menu.stats.items");
      expect(wrapper.text()).toContain(String(mockMenuItems.length));
    });

    it("should display stats chips with available count", async () => {
      const wrapper = mountView();
      await flushPromises();

      const availableCount = mockMenuItems.filter((i) => i.isAvailable).length;
      expect(wrapper.text()).toContain("menu.stats.available");
      expect(wrapper.text()).toContain(String(availableCount));
    });

    it("should render category sidebar", async () => {
      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.find('[data-testid="category-panel"]').exists()).toBe(
        true,
      );
    });

    it("should show add item button", async () => {
      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain("menu.addItem");
    });
  });

  // ── 2. Category Management ────────────────────────────────────────────────

  describe("Category Management", () => {
    it("should pass categories to category panel", async () => {
      const wrapper = mountView();
      await flushPromises();

      const panel = wrapper.findComponent({ name: "CategoryPanel" });
      expect(panel.props("categories")).toEqual(mockCategoriesRef.value);
    });

    it("should pass selected category id to panel", async () => {
      const wrapper = mountView();
      await flushPromises();

      const panel = wrapper.findComponent({ name: "CategoryPanel" });
      expect(panel.props("selectedCategoryId")).toBeNull();
    });

    it("should update selected category when category clicked", async () => {
      const wrapper = mountView();
      await flushPromises();

      const catButton = wrapper.find('[data-testid="cat-1"]');
      await catButton.trigger("click");
      await nextTick();

      const panel = wrapper.findComponent({ name: "CategoryPanel" });
      expect(panel.props("selectedCategoryId")).toBe(1);
    });

    it("should filter items when category selected", async () => {
      const wrapper = mountView();
      await flushPromises();

      // Select category 2 (drinks) - should show only drink items
      const catButton = wrapper.find('[data-testid="cat-2"]');
      await catButton.trigger("click");
      await nextTick();

      const grid = wrapper.find('[data-testid="virtual-menu-grid"]');
      expect(grid.text()).toContain("拉茶");
      expect(grid.text()).not.toContain("椰漿飯");
    });

    it("should show all items when no category selected", async () => {
      const wrapper = mountView();
      await flushPromises();

      const grid = wrapper.find('[data-testid="virtual-menu-grid"]');
      expect(grid.text()).toContain("椰漿飯");
      expect(grid.text()).toContain("拉茶");
      expect(grid.text()).toContain("摩摩喳喳");
    });

    it("should open category form on add-category event", async () => {
      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.find('[data-testid="category-edit-form"]').exists()).toBe(
        false,
      );

      const addBtn = wrapper.find('[data-testid="add-category-btn"]');
      await addBtn.trigger("click");
      await nextTick();

      expect(wrapper.find('[data-testid="category-edit-form"]').exists()).toBe(
        true,
      );
    });

    it("should open category form on edit-category event", async () => {
      const wrapper = mountView();
      await flushPromises();

      const editBtn = wrapper.find('[data-testid="edit-cat-1"]');
      await editBtn.trigger("click");
      await nextTick();

      expect(wrapper.find('[data-testid="category-edit-form"]').exists()).toBe(
        true,
      );
    });

    it("should call saveCategory on category form save", async () => {
      const wrapper = mountView();
      await flushPromises();

      // Open form
      const addBtn = wrapper.find('[data-testid="add-category-btn"]');
      await addBtn.trigger("click");
      await nextTick();

      // Save
      const saveBtn = wrapper.find('[data-testid="save-category-btn"]');
      await saveBtn.trigger("click");
      await flushPromises();

      expect(mockSaveCategory).toHaveBeenCalledWith(
        { name: "New Cat", nameEn: "", description: "", sortOrder: 0 },
        undefined,
      );
    });

    it("should show delete confirm dialog on delete-category event", async () => {
      const wrapper = mountView();
      await flushPromises();

      const delBtn = wrapper.find('[data-testid="del-cat-1"]');
      await delBtn.trigger("click");
      await nextTick();

      // Delete confirm modal should appear
      expect(wrapper.text()).toContain("common.delete");
    });
  });

  // ── 3. Menu Item Display ──────────────────────────────────────────────────

  describe("Menu Item Display", () => {
    it("should render item cards via virtual grid", async () => {
      const wrapper = mountView();
      await flushPromises();

      const cards = wrapper.findAllComponents({ name: "MenuItemCard" });
      expect(cards.length).toBe(mockMenuItems.length);
    });

    it("should pass item data to cards", async () => {
      const wrapper = mountView();
      await flushPromises();

      const cards = wrapper.findAllComponents({ name: "MenuItemCard" });
      expect(cards[0].props("item")).toMatchObject({
        id: 1,
        name: "椰漿飯",
        price: 12.5,
      });
    });

    it("should pass category name to cards", async () => {
      const wrapper = mountView();
      await flushPromises();

      expect(mockGetCategoryName).toHaveBeenCalled();
    });

    it("should render virtual menu grid when items exist", async () => {
      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.find('[data-testid="virtual-menu-grid"]').exists()).toBe(
        true,
      );
    });

    it("should pass correct item count in header", async () => {
      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain("menu.itemsHeader.itemCount");
    });
  });

  // ── 4. Search & Filter ────────────────────────────────────────────────────

  describe("Search & Filter", () => {
    it("should filter items by search text", async () => {
      const wrapper = mountView();
      await flushPromises();

      const searchInput = wrapper.find('input[type="text"]');
      await searchInput.setValue("椰漿飯");
      await nextTick();

      const grid = wrapper.find('[data-testid="virtual-menu-grid"]');
      expect(grid.text()).toContain("椰漿飯");
      expect(grid.text()).not.toContain("拉茶");
    });

    it("should filter items by english name", async () => {
      const wrapper = mountView();
      await flushPromises();

      const searchInput = wrapper.find('input[type="text"]');
      await searchInput.setValue("Nasi");
      await nextTick();

      const cards = wrapper.findAllComponents({ name: "MenuItemCard" });
      expect(cards.length).toBe(1);
      expect(cards[0].props("item").nameEn).toBe("Nasi Lemak");
    });

    it("should show status filter pills", async () => {
      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain("menu.itemsHeader.filterAll");
      expect(wrapper.text()).toContain("menu.itemsHeader.filterAvailable");
      expect(wrapper.text()).toContain("menu.itemsHeader.filterUnavailable");
    });

    it("should filter by available status", async () => {
      const wrapper = mountView();
      await flushPromises();

      // Click the "available" filter pill (second button in the filter group)
      const filterButtons = wrapper.findAll(
        ".bg-\\[\\#F2F2F7\\].rounded-full.p-0\\.5 button",
      );
      // available is the second pill
      await filterButtons[1].trigger("click");
      await nextTick();

      const cards = wrapper.findAllComponents({ name: "MenuItemCard" });
      // 3 available items: items 1, 2, 4
      expect(cards.length).toBe(3);
    });

    it("should filter by unavailable status", async () => {
      const wrapper = mountView();
      await flushPromises();

      const filterButtons = wrapper.findAll(
        ".bg-\\[\\#F2F2F7\\].rounded-full.p-0\\.5 button",
      );
      // unavailable is the third pill
      await filterButtons[2].trigger("click");
      await nextTick();

      const cards = wrapper.findAllComponents({ name: "MenuItemCard" });
      // 1 unavailable item: item 3 (拉茶)
      expect(cards.length).toBe(1);
    });
  });

  // ── 5. CRUD Operations ────────────────────────────────────────────────────

  describe("CRUD Operations", () => {
    it("should open add item modal on add button click", async () => {
      const wrapper = mountView();
      await flushPromises();

      // Find the add item button by text content
      const addButtons = wrapper.findAll("button");
      const addBtn = addButtons.find((b) => b.text().includes("menu.addItem"));
      expect(addBtn).toBeDefined();
      await addBtn!.trigger("click");
      await nextTick();

      // Modal should appear with add title
      expect(wrapper.text()).toContain("menu.form.itemName");
    });

    it("should open edit form when item card emits edit", async () => {
      const wrapper = mountView();
      await flushPromises();

      const cards = wrapper.findAllComponents({ name: "MenuItemCard" });
      const editBtn = cards[0].find('[data-testid="edit-item-btn"]');
      await editBtn.trigger("click");
      await nextTick();

      // Modal should appear with form fields pre-populated
      expect(wrapper.text()).toContain("menu.form.itemName");
      // Should contain edit title
      expect(wrapper.text()).toContain("menu.editItem");
    });

    it("should call saveMenuItem on item form submit (create)", async () => {
      const wrapper = mountView();
      await flushPromises();

      // Open add modal
      const addButtons = wrapper.findAll("button");
      const addBtn = addButtons.find((b) => b.text().includes("menu.addItem"));
      await addBtn!.trigger("click");
      await nextTick();

      // Fill form
      const inputs = wrapper.findAll('input[type="text"]');
      // First text input in modal is item name (after search input)
      const nameInput = inputs[1];
      await nameInput.setValue("Test Item");

      const priceInput = wrapper.find('input[type="number"]');
      await priceInput.setValue(15);

      // Select category
      const selects = wrapper.findAll("select");
      await selects[0].setValue(1);

      // Submit form
      const form = wrapper.find("form");
      await form.trigger("submit");
      await flushPromises();

      expect(mockSaveMenuItem).toHaveBeenCalledOnce();
    });

    it("should call saveMenuItem with editing id on update", async () => {
      const wrapper = mountView();
      await flushPromises();

      // Open edit modal
      const cards = wrapper.findAllComponents({ name: "MenuItemCard" });
      const editBtn = cards[0].find('[data-testid="edit-item-btn"]');
      await editBtn.trigger("click");
      await nextTick();

      // Submit form
      const form = wrapper.find("form");
      await form.trigger("submit");
      await flushPromises();

      // Should pass the editing item's id
      expect(mockSaveMenuItem).toHaveBeenCalledWith(
        expect.objectContaining({ name: "椰漿飯" }),
        1,
      );
    });

    it("should show delete confirm when item card emits delete", async () => {
      const wrapper = mountView();
      await flushPromises();

      const cards = wrapper.findAllComponents({ name: "MenuItemCard" });
      const delBtn = cards[0].find('[data-testid="delete-item-btn"]');
      await delBtn.trigger("click");
      await nextTick();

      // Delete confirm dialog should appear
      expect(wrapper.text()).toContain("common.delete");
      expect(wrapper.text()).toContain("common.cancel");
    });

    it("should call deleteMenuItem on confirm delete", async () => {
      const wrapper = mountView();
      await flushPromises();

      // Trigger delete on first item
      const cards = wrapper.findAllComponents({ name: "MenuItemCard" });
      const delBtn = cards[0].find('[data-testid="delete-item-btn"]');
      await delBtn.trigger("click");
      await nextTick();

      // Click confirm delete button (the red one)
      const confirmButtons = wrapper.findAll("button");
      const confirmBtn = confirmButtons.find((b) =>
        b.text().includes("common.delete"),
      );
      // There are two "common.delete" buttons in the confirm dialog;
      // We need the one that is NOT the cancel
      const allDeleteBtns = confirmButtons.filter(
        (b) =>
          b.text().trim() === "common.delete" &&
          !b.text().includes("common.cancel"),
      );
      await allDeleteBtns[allDeleteBtns.length - 1].trigger("click");
      await flushPromises();

      expect(mockDeleteMenuItem).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, name: "椰漿飯" }),
      );
    });

    it("should call toggleMenuItemStatus on toggle event", async () => {
      const wrapper = mountView();
      await flushPromises();

      const cards = wrapper.findAllComponents({ name: "MenuItemCard" });
      const toggleBtn = cards[0].find('[data-testid="toggle-status-btn"]');
      await toggleBtn.trigger("click");
      await flushPromises();

      expect(mockToggleMenuItemStatus).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1 }),
      );
    });

    it("should close menu item modal on cancel", async () => {
      const wrapper = mountView();
      await flushPromises();

      // Open modal
      const addButtons = wrapper.findAll("button");
      const addBtn = addButtons.find((b) => b.text().includes("menu.addItem"));
      await addBtn!.trigger("click");
      await nextTick();

      expect(wrapper.text()).toContain("menu.form.itemName");

      // Click cancel
      const cancelBtns = wrapper.findAll("button");
      const cancelBtn = cancelBtns.find((b) =>
        b.text().includes("common.cancel"),
      );
      await cancelBtn!.trigger("click");
      await nextTick();

      // form field should no longer be visible
      expect(wrapper.find("form").exists()).toBe(false);
    });
  });

  // ── 6. Error & Loading States ─────────────────────────────────────────────

  describe("Error & Loading States", () => {
    it("should show loading state during fetch", async () => {
      mockIsLoading.value = true;
      mockMenuItemsRef.value = [];
      const wrapper = mountView();
      await nextTick();

      // Loading spinner should be present
      expect(wrapper.find(".animate-spin").exists()).toBe(true);
    });

    it("should show empty state when no items", async () => {
      mockMenuItemsRef.value = [];
      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.text()).toContain("menu.empty.title");
      expect(wrapper.text()).toContain("menu.empty.subtitle");
    });

    it("should show add button in empty state", async () => {
      mockMenuItemsRef.value = [];
      const wrapper = mountView();
      await flushPromises();

      // Empty state has its own add button
      const emptyStateText = wrapper.text();
      expect(emptyStateText).toContain("menu.addItem");
    });

    it("should not show virtual grid when no items", async () => {
      mockMenuItemsRef.value = [];
      const wrapper = mountView();
      await flushPromises();

      expect(wrapper.find('[data-testid="virtual-menu-grid"]').exists()).toBe(
        false,
      );
    });
  });

  // ── 7. Mock Verification ──────────────────────────────────────────────────

  describe("Mock Verification", () => {
    it("should call fetchMenu on mount", async () => {
      mountView();
      await flushPromises();

      expect(mockFetchMenu).toHaveBeenCalledOnce();
    });

    it("should call saveCategory with correct params for new category", async () => {
      const wrapper = mountView();
      await flushPromises();

      // Open add category form
      const addBtn = wrapper.find('[data-testid="add-category-btn"]');
      await addBtn.trigger("click");
      await nextTick();

      // Save
      const saveBtn = wrapper.find('[data-testid="save-category-btn"]');
      await saveBtn.trigger("click");
      await flushPromises();

      expect(mockSaveCategory).toHaveBeenCalledTimes(1);
      expect(mockSaveCategory).toHaveBeenCalledWith(
        expect.objectContaining({ name: "New Cat" }),
        undefined,
      );
    });

    it("should call deleteCategory via confirm dialog", async () => {
      const wrapper = mountView();
      await flushPromises();

      // Trigger delete on first category
      const delBtn = wrapper.find('[data-testid="del-cat-1"]');
      await delBtn.trigger("click");
      await nextTick();

      // Confirm delete
      const confirmButtons = wrapper.findAll("button");
      const allDeleteBtns = confirmButtons.filter(
        (b) =>
          b.text().trim() === "common.delete" &&
          !b.text().includes("common.cancel"),
      );
      await allDeleteBtns[allDeleteBtns.length - 1].trigger("click");
      await flushPromises();

      expect(mockDeleteCategory).toHaveBeenCalledWith(1);
    });
  });

  // ── 8. Category form cancellation ─────────────────────────────────────────

  describe("Category Form", () => {
    it("should close category form on cancel", async () => {
      const wrapper = mountView();
      await flushPromises();

      // Open form
      const addBtn = wrapper.find('[data-testid="add-category-btn"]');
      await addBtn.trigger("click");
      await nextTick();

      expect(wrapper.find('[data-testid="category-edit-form"]').exists()).toBe(
        true,
      );

      // Cancel
      const cancelBtn = wrapper.find('[data-testid="cancel-category-btn"]');
      await cancelBtn.trigger("click");
      await nextTick();

      expect(wrapper.find('[data-testid="category-edit-form"]').exists()).toBe(
        false,
      );
    });

    it("should close category form after successful save", async () => {
      const wrapper = mountView();
      await flushPromises();

      // Open form
      const addBtn = wrapper.find('[data-testid="add-category-btn"]');
      await addBtn.trigger("click");
      await nextTick();

      // Save
      const saveBtn = wrapper.find('[data-testid="save-category-btn"]');
      await saveBtn.trigger("click");
      await flushPromises();

      expect(wrapper.find('[data-testid="category-edit-form"]').exists()).toBe(
        false,
      );
    });
  });

  // ── 9. Delete confirm modal ───────────────────────────────────────────────

  describe("Delete Confirm Modal", () => {
    it("should cancel delete on cancel click", async () => {
      const wrapper = mountView();
      await flushPromises();

      // Trigger delete
      const delBtn = wrapper.find('[data-testid="del-cat-1"]');
      await delBtn.trigger("click");
      await nextTick();

      // Cancel
      const cancelBtns = wrapper.findAll("button");
      const cancelBtn = cancelBtns.find((b) =>
        b.text().includes("common.cancel"),
      );
      await cancelBtn!.trigger("click");
      await nextTick();

      expect(mockDeleteCategory).not.toHaveBeenCalled();
    });

    it("should dismiss delete modal on backdrop click", async () => {
      const wrapper = mountView();
      await flushPromises();

      // Trigger delete
      const delBtn = wrapper.find('[data-testid="del-cat-1"]');
      await delBtn.trigger("click");
      await nextTick();

      // Click backdrop
      const backdrop = wrapper.find(".bg-black\\/30");
      await backdrop.trigger("click");
      await nextTick();

      expect(mockDeleteCategory).not.toHaveBeenCalled();
      // Modal should be gone — delete title no longer in a modal context
    });
  });

  // ── 10. Menu item form pre-population ─────────────────────────────────────

  describe("Menu Item Form Pre-population", () => {
    it("should pre-populate form fields when editing an item", async () => {
      const wrapper = mountView();
      await flushPromises();

      // Click edit on first item
      const cards = wrapper.findAllComponents({ name: "MenuItemCard" });
      const editBtn = cards[0].find('[data-testid="edit-item-btn"]');
      await editBtn.trigger("click");
      await nextTick();

      // Check form inputs are pre-populated
      const textInputs = wrapper.findAll('.fixed input[type="text"]');
      // First text input is item name
      expect((textInputs[0].element as HTMLInputElement).value).toBe("椰漿飯");
    });

    it("should show update button when editing", async () => {
      const wrapper = mountView();
      await flushPromises();

      const cards = wrapper.findAllComponents({ name: "MenuItemCard" });
      const editBtn = cards[0].find('[data-testid="edit-item-btn"]');
      await editBtn.trigger("click");
      await nextTick();

      expect(wrapper.text()).toContain("menu.form.update");
    });

    it("should show add button when creating", async () => {
      const wrapper = mountView();
      await flushPromises();

      const addButtons = wrapper.findAll("button");
      const addBtn = addButtons.find((b) => b.text().includes("menu.addItem"));
      await addBtn!.trigger("click");
      await nextTick();

      expect(wrapper.text()).toContain("menu.form.add");
    });
  });
});
