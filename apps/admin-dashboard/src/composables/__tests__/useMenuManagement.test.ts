/**
 * useMenuManagement Composable Tests
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { ref } from "vue";

// ── Hoisted mock data ──────────────────────────────────────────────────────

const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}));

const mockApiGet = vi.hoisted(() => vi.fn());
const mockApiPost = vi.hoisted(() => vi.fn());
const mockApiPut = vi.hoisted(() => vi.fn());
const mockApiPatch = vi.hoisted(() => vi.fn());
const mockApiDelete = vi.hoisted(() => vi.fn());

// ── Module mocks (must be before any imports from the module under test) ──

vi.mock("@/services/api", () => ({
  api: {
    get: mockApiGet,
    post: mockApiPost,
    put: mockApiPut,
    patch: mockApiPatch,
    delete: mockApiDelete,
  },
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    restaurantId: "test-restaurant-id",
    user: { id: 1, role: 0 },
  }),
}));

vi.mock("vue-toastification", () => ({
  useToast: () => mockToast,
}));

vi.mock("@/i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

// ── Import after mocks ─────────────────────────────────────────────────────

import { useMenuManagement } from "../useMenuManagement";

// ── Helpers ────────────────────────────────────────────────────────────────

const sampleCategories = [
  { id: 1, name: "Mains", nameEn: "Mains", sortOrder: 0, itemCount: 2 },
  { id: 2, name: "Desserts", nameEn: "Desserts", sortOrder: 1, itemCount: 1 },
];

const sampleItems = [
  {
    id: 10,
    categoryId: 1,
    name: "Nasi Lemak",
    nameEn: "Nasi Lemak",
    price: 12,
    isFeatured: 1,
    isAvailable: 1,
    sortOrder: 0,
  },
  {
    id: 11,
    categoryId: 1,
    name: "Roti Canai",
    nameEn: "",
    price: 5,
    isFeatured: 0,
    isAvailable: 0,
    sortOrder: 1,
  },
  {
    id: 12,
    categoryId: 2,
    name: "Cendol",
    nameEn: "",
    price: 8,
    isFeatured: 0,
    isAvailable: 1,
    sortOrder: 0,
  },
];

const makeSuccessResponse = (data: unknown) => ({
  data: { success: true, data },
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe("useMenuManagement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton state between tests
    const { categories, menuItems, isLoading, selectedCategoryId } =
      useMenuManagement();
    categories.value = [];
    menuItems.value = [];
    isLoading.value = false;
    selectedCategoryId.value = null;
  });

  // ── fetchMenu ────────────────────────────────────────────────────────────

  describe("fetchMenu", () => {
    test("calls API with correct URL", async () => {
      mockApiGet.mockResolvedValue(
        makeSuccessResponse({ categories: [], menuItems: [] }),
      );

      const { fetchMenu } = useMenuManagement();
      await fetchMenu();

      expect(mockApiGet).toHaveBeenCalledWith("/menu/test-restaurant-id");
    });

    test("populates categories and menuItems on success", async () => {
      mockApiGet.mockResolvedValue(
        makeSuccessResponse({
          categories: sampleCategories,
          menuItems: sampleItems,
        }),
      );

      const { fetchMenu, categories, menuItems } = useMenuManagement();
      await fetchMenu();

      expect(categories.value).toHaveLength(2);
      expect(categories.value[0].name).toBe("Mains");
      expect(menuItems.value).toHaveLength(3);
    });

    test("coerces isFeatured and isAvailable to booleans", async () => {
      mockApiGet.mockResolvedValue(
        makeSuccessResponse({
          categories: [],
          menuItems: sampleItems,
        }),
      );

      const { fetchMenu, menuItems } = useMenuManagement();
      await fetchMenu();

      expect(menuItems.value[0].isFeatured).toBe(true);
      expect(menuItems.value[1].isAvailable).toBe(false);
    });

    test("shows error toast when API call fails", async () => {
      mockApiGet.mockRejectedValue(new Error("network error"));

      const { fetchMenu } = useMenuManagement();
      await fetchMenu();

      expect(mockToast.error).toHaveBeenCalledWith("menu.errors.fetchFailed");
    });

    test("sets isLoading to false after fetch completes", async () => {
      mockApiGet.mockResolvedValue(
        makeSuccessResponse({ categories: [], menuItems: [] }),
      );

      const { fetchMenu, isLoading } = useMenuManagement();
      await fetchMenu();

      expect(isLoading.value).toBe(false);
    });
  });

  // ── saveCategory (create) ────────────────────────────────────────────────

  describe("saveCategory (create)", () => {
    test("calls POST when no editingId is provided", async () => {
      mockApiPost.mockResolvedValue({});
      mockApiGet.mockResolvedValue(
        makeSuccessResponse({ categories: [], menuItems: [] }),
      );

      const { saveCategory } = useMenuManagement();
      await saveCategory({ name: "Drinks", sortOrder: 2 });

      expect(mockApiPost).toHaveBeenCalledWith(
        "/menu/test-restaurant-id/categories",
        { name: "Drinks", sortOrder: 2 },
      );
    });

    test("shows success toast on create", async () => {
      mockApiPost.mockResolvedValue({});
      mockApiGet.mockResolvedValue(
        makeSuccessResponse({ categories: [], menuItems: [] }),
      );

      const { saveCategory } = useMenuManagement();
      await saveCategory({ name: "Drinks", sortOrder: 2 });

      expect(mockToast.success).toHaveBeenCalledWith(
        "menu.toast.categoryCreated",
      );
    });

    test("refetches menu after create", async () => {
      mockApiPost.mockResolvedValue({});
      mockApiGet.mockResolvedValue(
        makeSuccessResponse({ categories: [], menuItems: [] }),
      );

      const { saveCategory } = useMenuManagement();
      await saveCategory({ name: "Drinks", sortOrder: 2 });

      expect(mockApiGet).toHaveBeenCalledTimes(1);
    });
  });

  // ── saveCategory (update) ────────────────────────────────────────────────

  describe("saveCategory (update)", () => {
    test("calls PUT when editingId is provided", async () => {
      mockApiPut.mockResolvedValue({});
      mockApiGet.mockResolvedValue(
        makeSuccessResponse({ categories: [], menuItems: [] }),
      );

      const { saveCategory } = useMenuManagement();
      await saveCategory({ name: "Drinks Updated", sortOrder: 2 }, 5);

      expect(mockApiPut).toHaveBeenCalledWith("/menu/categories/5", {
        name: "Drinks Updated",
        sortOrder: 2,
      });
    });

    test("shows success toast on update", async () => {
      mockApiPut.mockResolvedValue({});
      mockApiGet.mockResolvedValue(
        makeSuccessResponse({ categories: [], menuItems: [] }),
      );

      const { saveCategory } = useMenuManagement();
      await saveCategory({ name: "Drinks Updated", sortOrder: 2 }, 5);

      expect(mockToast.success).toHaveBeenCalledWith(
        "menu.toast.categoryUpdated",
      );
    });
  });

  // ── deleteCategory ───────────────────────────────────────────────────────

  describe("deleteCategory", () => {
    test("calls DELETE with correct URL", async () => {
      mockApiDelete.mockResolvedValue({});
      mockApiGet.mockResolvedValue(
        makeSuccessResponse({ categories: [], menuItems: [] }),
      );

      const { deleteCategory } = useMenuManagement();
      await deleteCategory(3);

      expect(mockApiDelete).toHaveBeenCalledWith("/menu/categories/3");
    });

    test("shows success toast after delete", async () => {
      mockApiDelete.mockResolvedValue({});
      mockApiGet.mockResolvedValue(
        makeSuccessResponse({ categories: [], menuItems: [] }),
      );

      const { deleteCategory } = useMenuManagement();
      await deleteCategory(3);

      expect(mockToast.success).toHaveBeenCalledWith(
        "menu.toast.categoryDeleted",
      );
    });

    test("resets selectedCategoryId when the deleted category was selected", async () => {
      mockApiDelete.mockResolvedValue({});
      mockApiGet.mockResolvedValue(
        makeSuccessResponse({ categories: [], menuItems: [] }),
      );

      const { deleteCategory, selectedCategoryId } = useMenuManagement();
      selectedCategoryId.value = 3;

      await deleteCategory(3);

      expect(selectedCategoryId.value).toBeNull();
    });

    test("does not reset selectedCategoryId when a different category is deleted", async () => {
      mockApiDelete.mockResolvedValue({});
      mockApiGet.mockResolvedValue(
        makeSuccessResponse({ categories: [], menuItems: [] }),
      );

      const { deleteCategory, selectedCategoryId } = useMenuManagement();
      selectedCategoryId.value = 99;

      await deleteCategory(3);

      expect(selectedCategoryId.value).toBe(99);
    });
  });

  // ── reorderCategories ────────────────────────────────────────────────────

  describe("reorderCategories", () => {
    test("applies optimistic update immediately", async () => {
      // Never resolves during this check
      mockApiPatch.mockReturnValue(new Promise(() => {}));

      const { reorderCategories, categories } = useMenuManagement();
      const newOrder = [
        { id: 2, name: "Desserts", sortOrder: 1 },
        { id: 1, name: "Mains", sortOrder: 0 },
      ] as any[];

      // Start but don't await
      reorderCategories(newOrder);

      expect(categories.value[0].name).toBe("Desserts");
    });

    test("calls PATCH with correct payload", async () => {
      mockApiPatch.mockResolvedValue({});

      const { reorderCategories } = useMenuManagement();
      const newOrder = [
        { id: 2, name: "Desserts", sortOrder: 99 },
        { id: 1, name: "Mains", sortOrder: 99 },
      ] as any[];

      await reorderCategories(newOrder);

      expect(mockApiPatch).toHaveBeenCalledWith(
        "/menu/test-restaurant-id/categories/reorder",
        {
          categories: [
            { id: 2, sortOrder: 0 },
            { id: 1, sortOrder: 1 },
          ],
        },
      );
    });

    test("rolls back on API error", async () => {
      mockApiPatch.mockRejectedValue(new Error("server error"));
      mockApiGet.mockResolvedValue(
        makeSuccessResponse({
          categories: sampleCategories,
          menuItems: [],
        }),
      );

      const { reorderCategories } = useMenuManagement();
      const newOrder = [
        { id: 2, name: "Desserts", sortOrder: 1 },
        { id: 1, name: "Mains", sortOrder: 0 },
      ] as any[];

      await reorderCategories(newOrder);

      // After rollback, fetchMenu is called and categories are restored
      expect(mockApiGet).toHaveBeenCalled();
      expect(mockToast.error).toHaveBeenCalledWith("menu.errors.reorderFailed");
    });
  });

  // ── saveMenuItem (create) ────────────────────────────────────────────────

  describe("saveMenuItem (create)", () => {
    test("calls POST with correct payload", async () => {
      mockApiPost.mockResolvedValue({});
      mockApiGet.mockResolvedValue(
        makeSuccessResponse({ categories: [], menuItems: [] }),
      );

      const { saveMenuItem } = useMenuManagement();
      await saveMenuItem({
        name: "Laksa",
        price: 15,
        categoryId: 1,
        isFeatured: false,
        isAvailable: true,
        sortOrder: 0,
      });

      expect(mockApiPost).toHaveBeenCalledWith(
        "/menu/test-restaurant-id/items",
        expect.objectContaining({
          name: "Laksa",
          price: 15,
          categoryId: 1,
          isFeatured: false,
          isAvailable: true,
          imageUrl: null,
        }),
      );
    });

    test("shows success toast on create", async () => {
      mockApiPost.mockResolvedValue({});
      mockApiGet.mockResolvedValue(
        makeSuccessResponse({ categories: [], menuItems: [] }),
      );

      const { saveMenuItem } = useMenuManagement();
      await saveMenuItem({
        name: "Laksa",
        price: 15,
        categoryId: 1,
        isFeatured: false,
        isAvailable: true,
        sortOrder: 0,
      });

      expect(mockToast.success).toHaveBeenCalledWith("menu.toast.itemCreated");
    });
  });

  // ── deleteMenuItem ───────────────────────────────────────────────────────

  describe("deleteMenuItem", () => {
    test("calls DELETE with correct URL", async () => {
      mockApiDelete.mockResolvedValue({});
      mockApiGet.mockResolvedValue(
        makeSuccessResponse({ categories: [], menuItems: [] }),
      );

      const { deleteMenuItem } = useMenuManagement();
      const item = {
        id: 10,
        categoryId: 1,
        name: "Nasi Lemak",
        price: 12,
        isFeatured: false,
        isAvailable: true,
        sortOrder: 0,
      };

      await deleteMenuItem(item);

      expect(mockApiDelete).toHaveBeenCalledWith("/menu/items/10");
    });

    test("shows success toast after delete", async () => {
      mockApiDelete.mockResolvedValue({});
      mockApiGet.mockResolvedValue(
        makeSuccessResponse({ categories: [], menuItems: [] }),
      );

      const { deleteMenuItem } = useMenuManagement();
      await deleteMenuItem({
        id: 10,
        categoryId: 1,
        name: "Nasi Lemak",
        price: 12,
        isFeatured: false,
        isAvailable: true,
        sortOrder: 0,
      });

      expect(mockToast.success).toHaveBeenCalledWith("menu.toast.itemDeleted");
    });
  });

  // ── toggleMenuItemStatus ─────────────────────────────────────────────────

  describe("toggleMenuItemStatus", () => {
    test("calls PUT with toggled isAvailable (true → false)", async () => {
      mockApiPut.mockResolvedValue({});
      mockApiGet.mockResolvedValue(
        makeSuccessResponse({ categories: [], menuItems: [] }),
      );

      const { toggleMenuItemStatus } = useMenuManagement();
      const item = {
        id: 10,
        categoryId: 1,
        name: "Nasi Lemak",
        price: 12,
        isFeatured: false,
        isAvailable: true,
        sortOrder: 0,
      };

      await toggleMenuItemStatus(item);

      expect(mockApiPut).toHaveBeenCalledWith("/menu/items/10", {
        isAvailable: false,
      });
    });

    test("calls PUT with toggled isAvailable (false → true)", async () => {
      mockApiPut.mockResolvedValue({});
      mockApiGet.mockResolvedValue(
        makeSuccessResponse({ categories: [], menuItems: [] }),
      );

      const { toggleMenuItemStatus } = useMenuManagement();
      const item = {
        id: 11,
        categoryId: 1,
        name: "Roti Canai",
        price: 5,
        isFeatured: false,
        isAvailable: false,
        sortOrder: 1,
      };

      await toggleMenuItemStatus(item);

      expect(mockApiPut).toHaveBeenCalledWith("/menu/items/11", {
        isAvailable: true,
      });
    });
  });

  // ── filteredItemsByCategory ──────────────────────────────────────────────

  describe("filteredItemsByCategory", () => {
    beforeEach(async () => {
      mockApiGet.mockResolvedValue(
        makeSuccessResponse({
          categories: sampleCategories,
          menuItems: sampleItems,
        }),
      );
      const { fetchMenu } = useMenuManagement();
      await fetchMenu();
    });

    test("returns all items when selectedCategoryId is null", () => {
      const { filteredItemsByCategory, selectedCategoryId } =
        useMenuManagement();
      selectedCategoryId.value = null;

      expect(filteredItemsByCategory.value).toHaveLength(3);
    });

    test("filters items by selectedCategoryId", () => {
      const { filteredItemsByCategory, selectedCategoryId } =
        useMenuManagement();
      selectedCategoryId.value = 1;

      expect(filteredItemsByCategory.value).toHaveLength(2);
      expect(
        filteredItemsByCategory.value.every((i) => i.categoryId === 1),
      ).toBe(true);
    });

    test("returns empty array when no items match selectedCategoryId", () => {
      const { filteredItemsByCategory, selectedCategoryId } =
        useMenuManagement();
      selectedCategoryId.value = 999;

      expect(filteredItemsByCategory.value).toHaveLength(0);
    });
  });
});
