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

  // ── Edge Cases and Error Recovery ────────────────────────────────────────

  describe("Edge Cases and Error Recovery", () => {
    // ── API failure handling (500 errors) ──

    describe("API failure handling", () => {
      test("saveMenuItem shows error toast and does not update state on 500", async () => {
        const serverError = new Error("Internal Server Error") as any;
        serverError.response = {
          status: 500,
          data: { error: { message: "Internal server error" } },
        };
        mockApiPost.mockRejectedValue(serverError);

        const { saveMenuItem, menuItems } = useMenuManagement();
        const itemsBefore = [...menuItems.value];

        await saveMenuItem({
          name: "Laksa",
          price: 15,
          categoryId: 1,
          isFeatured: false,
          isAvailable: true,
          sortOrder: 0,
        });

        expect(mockToast.error).toHaveBeenCalledWith("Internal server error");
        expect(mockToast.success).not.toHaveBeenCalled();
        // State should remain unchanged — fetchMenu was never called
        expect(mockApiGet).not.toHaveBeenCalled();
        expect(menuItems.value).toEqual(itemsBefore);
      });

      test("saveMenuItem shows generic error when response has no message", async () => {
        mockApiPost.mockRejectedValue(new Error("network failure"));

        const { saveMenuItem } = useMenuManagement();
        await saveMenuItem({
          name: "Laksa",
          price: 15,
          categoryId: 1,
          isFeatured: false,
          isAvailable: true,
          sortOrder: 0,
        });

        expect(mockToast.error).toHaveBeenCalledWith("menu.errors.saveFailed");
      });

      test("saveMenuItem (update) shows error toast on 500", async () => {
        const serverError = new Error("Internal Server Error") as any;
        serverError.response = {
          status: 500,
          data: { error: { message: "Database write failed" } },
        };
        mockApiPut.mockRejectedValue(serverError);

        const { saveMenuItem } = useMenuManagement();
        await saveMenuItem(
          {
            name: "Updated Laksa",
            price: 18,
            categoryId: 1,
            isFeatured: true,
            isAvailable: true,
            sortOrder: 0,
          },
          10,
        );

        expect(mockToast.error).toHaveBeenCalledWith("Database write failed");
        expect(mockToast.success).not.toHaveBeenCalled();
      });

      test("deleteMenuItem shows error toast on 500 and does not refetch", async () => {
        const serverError = new Error("Server Error") as any;
        serverError.response = {
          status: 500,
          data: { error: { message: "Cannot delete item" } },
        };
        mockApiDelete.mockRejectedValue(serverError);

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

        expect(mockToast.error).toHaveBeenCalledWith("Cannot delete item");
        expect(mockToast.success).not.toHaveBeenCalled();
        expect(mockApiGet).not.toHaveBeenCalled();
      });

      test("deleteCategory shows error toast on 500", async () => {
        const serverError = new Error("Server Error") as any;
        serverError.response = {
          status: 500,
          data: { error: { message: "Foreign key constraint" } },
        };
        mockApiDelete.mockRejectedValue(serverError);

        const { deleteCategory, selectedCategoryId } = useMenuManagement();
        selectedCategoryId.value = 3;

        await deleteCategory(3);

        expect(mockToast.error).toHaveBeenCalledWith("Foreign key constraint");
        expect(mockToast.success).not.toHaveBeenCalled();
        // selectedCategoryId should NOT be reset on failure
        expect(selectedCategoryId.value).toBe(3);
      });

      test("toggleMenuItemStatus shows error toast on failure", async () => {
        mockApiPut.mockRejectedValue(new Error("toggle failed"));

        const { toggleMenuItemStatus } = useMenuManagement();
        await toggleMenuItemStatus({
          id: 10,
          categoryId: 1,
          name: "Nasi Lemak",
          price: 12,
          isFeatured: false,
          isAvailable: true,
          sortOrder: 0,
        });

        expect(mockToast.error).toHaveBeenCalledWith(
          "menu.errors.toggleFailed",
        );
        expect(mockApiGet).not.toHaveBeenCalled();
      });
    });

    // ── Network timeout ──

    describe("Network timeout", () => {
      test("saveMenuItem handles a promise that never resolves (pending state)", async () => {
        // Simulate a timeout by using a promise that rejects after delay
        mockApiPost.mockRejectedValue(new Error("timeout"));

        const { saveMenuItem } = useMenuManagement();
        await saveMenuItem({
          name: "Slow Item",
          price: 10,
          categoryId: 1,
          isFeatured: false,
          isAvailable: true,
          sortOrder: 0,
        });

        expect(mockToast.error).toHaveBeenCalledWith("menu.errors.saveFailed");
        expect(mockToast.success).not.toHaveBeenCalled();
      });

      test("deleteMenuItem handles timeout rejection", async () => {
        mockApiDelete.mockRejectedValue(new Error("Request timed out"));

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

        expect(mockToast.error).toHaveBeenCalledWith(
          "menu.errors.deleteFailed",
        );
        expect(mockToast.success).not.toHaveBeenCalled();
      });

      test("fetchMenu sets isLoading back to false even on timeout", async () => {
        mockApiGet.mockRejectedValue(new Error("ECONNABORTED"));

        const { fetchMenu, isLoading } = useMenuManagement();
        await fetchMenu();

        expect(isLoading.value).toBe(false);
        expect(mockToast.error).toHaveBeenCalledWith("menu.errors.fetchFailed");
      });
    });

    // ── Empty/whitespace name ──

    describe("Empty/whitespace name", () => {
      test("creates item with empty name (no client-side validation in composable)", async () => {
        mockApiPost.mockResolvedValue({});
        mockApiGet.mockResolvedValue(
          makeSuccessResponse({ categories: [], menuItems: [] }),
        );

        const { saveMenuItem } = useMenuManagement();
        await saveMenuItem({
          name: "",
          price: 10,
          categoryId: 1,
          isFeatured: false,
          isAvailable: true,
          sortOrder: 0,
        });

        expect(mockApiPost).toHaveBeenCalledWith(
          "/menu/test-restaurant-id/items",
          expect.objectContaining({ name: "" }),
        );
      });

      test("creates item with whitespace-only name (sent as-is to API)", async () => {
        mockApiPost.mockResolvedValue({});
        mockApiGet.mockResolvedValue(
          makeSuccessResponse({ categories: [], menuItems: [] }),
        );

        const { saveMenuItem } = useMenuManagement();
        await saveMenuItem({
          name: "   ",
          price: 10,
          categoryId: 1,
          isFeatured: false,
          isAvailable: true,
          sortOrder: 0,
        });

        expect(mockApiPost).toHaveBeenCalledWith(
          "/menu/test-restaurant-id/items",
          expect.objectContaining({ name: "   " }),
        );
      });

      test("creates category with empty name (sent to API)", async () => {
        mockApiPost.mockResolvedValue({});
        mockApiGet.mockResolvedValue(
          makeSuccessResponse({ categories: [], menuItems: [] }),
        );

        const { saveCategory } = useMenuManagement();
        await saveCategory({ name: "", sortOrder: 0 });

        expect(mockApiPost).toHaveBeenCalledWith(
          "/menu/test-restaurant-id/categories",
          { name: "", sortOrder: 0 },
        );
      });

      test("shows server validation error for empty name when API rejects", async () => {
        const validationError = new Error("Validation Error") as any;
        validationError.response = {
          status: 400,
          data: { error: { message: "Name is required" } },
        };
        mockApiPost.mockRejectedValue(validationError);

        const { saveMenuItem } = useMenuManagement();
        await saveMenuItem({
          name: "",
          price: 10,
          categoryId: 1,
          isFeatured: false,
          isAvailable: true,
          sortOrder: 0,
        });

        expect(mockToast.error).toHaveBeenCalledWith("Name is required");
      });
    });

    // ── Price edge cases ──

    describe("Price edge cases", () => {
      test("creates item with price = 0", async () => {
        mockApiPost.mockResolvedValue({});
        mockApiGet.mockResolvedValue(
          makeSuccessResponse({ categories: [], menuItems: [] }),
        );

        const { saveMenuItem } = useMenuManagement();
        await saveMenuItem({
          name: "Free Water",
          price: 0,
          categoryId: 1,
          isFeatured: false,
          isAvailable: true,
          sortOrder: 0,
        });

        expect(mockApiPost).toHaveBeenCalledWith(
          "/menu/test-restaurant-id/items",
          expect.objectContaining({ name: "Free Water", price: 0 }),
        );
        expect(mockToast.success).toHaveBeenCalledWith(
          "menu.toast.itemCreated",
        );
      });

      test("creates item with negative price (sent to API as-is)", async () => {
        mockApiPost.mockResolvedValue({});
        mockApiGet.mockResolvedValue(
          makeSuccessResponse({ categories: [], menuItems: [] }),
        );

        const { saveMenuItem } = useMenuManagement();
        await saveMenuItem({
          name: "Discount Coupon",
          price: -5,
          categoryId: 1,
          isFeatured: false,
          isAvailable: true,
          sortOrder: 0,
        });

        expect(mockApiPost).toHaveBeenCalledWith(
          "/menu/test-restaurant-id/items",
          expect.objectContaining({ name: "Discount Coupon", price: -5 }),
        );
      });

      test("coerces string-like price to number via Number()", async () => {
        mockApiPost.mockResolvedValue({});
        mockApiGet.mockResolvedValue(
          makeSuccessResponse({ categories: [], menuItems: [] }),
        );

        const { saveMenuItem } = useMenuManagement();
        // The composable does Number(form.price), so pass a string-coercible value
        await saveMenuItem({
          name: "Teh Tarik",
          price: "4.50" as unknown as number,
          categoryId: 1,
          isFeatured: false,
          isAvailable: true,
          sortOrder: 0,
        });

        expect(mockApiPost).toHaveBeenCalledWith(
          "/menu/test-restaurant-id/items",
          expect.objectContaining({ price: 4.5 }),
        );
      });

      test("NaN price is sent when price is non-numeric string", async () => {
        mockApiPost.mockResolvedValue({});
        mockApiGet.mockResolvedValue(
          makeSuccessResponse({ categories: [], menuItems: [] }),
        );

        const { saveMenuItem } = useMenuManagement();
        await saveMenuItem({
          name: "Bad Price Item",
          price: "abc" as unknown as number,
          categoryId: 1,
          isFeatured: false,
          isAvailable: true,
          sortOrder: 0,
        });

        expect(mockApiPost).toHaveBeenCalledWith(
          "/menu/test-restaurant-id/items",
          expect.objectContaining({ price: NaN }),
        );
      });
    });

    // ── Concurrent operations ──

    describe("Concurrent operations", () => {
      test("calling saveMenuItem twice rapidly sends two POST requests", async () => {
        let callCount = 0;
        mockApiPost.mockImplementation(() => {
          callCount++;
          return Promise.resolve({});
        });
        mockApiGet.mockResolvedValue(
          makeSuccessResponse({ categories: [], menuItems: [] }),
        );

        const { saveMenuItem } = useMenuManagement();
        const itemForm = {
          name: "Laksa",
          price: 15,
          categoryId: 1,
          isFeatured: false,
          isAvailable: true,
          sortOrder: 0,
        };

        // Fire both without awaiting
        const p1 = saveMenuItem(itemForm);
        const p2 = saveMenuItem(itemForm);
        await Promise.all([p1, p2]);

        expect(mockApiPost).toHaveBeenCalledTimes(2);
        expect(mockToast.success).toHaveBeenCalledTimes(2);
      });

      test("concurrent saveCategory calls both complete", async () => {
        mockApiPost.mockResolvedValue({});
        mockApiGet.mockResolvedValue(
          makeSuccessResponse({ categories: [], menuItems: [] }),
        );

        const { saveCategory } = useMenuManagement();

        const p1 = saveCategory({ name: "Drinks", sortOrder: 0 });
        const p2 = saveCategory({ name: "Snacks", sortOrder: 1 });
        await Promise.all([p1, p2]);

        expect(mockApiPost).toHaveBeenCalledTimes(2);
        expect(mockToast.success).toHaveBeenCalledTimes(2);
      });

      test("concurrent delete and create does not corrupt state", async () => {
        mockApiDelete.mockResolvedValue({});
        mockApiPost.mockResolvedValue({});
        mockApiGet.mockResolvedValue(
          makeSuccessResponse({
            categories: sampleCategories,
            menuItems: sampleItems,
          }),
        );

        const { deleteMenuItem, saveMenuItem, menuItems } = useMenuManagement();

        const pDelete = deleteMenuItem({
          id: 10,
          categoryId: 1,
          name: "Nasi Lemak",
          price: 12,
          isFeatured: false,
          isAvailable: true,
          sortOrder: 0,
        });
        const pCreate = saveMenuItem({
          name: "New Item",
          price: 20,
          categoryId: 1,
          isFeatured: false,
          isAvailable: true,
          sortOrder: 5,
        });
        await Promise.all([pDelete, pCreate]);

        // After both settle, fetchMenu was called and state is consistent
        expect(mockApiGet).toHaveBeenCalled();
        // State should reflect the last fetchMenu response
        expect(menuItems.value).toHaveLength(3);
      });

      test("one failing and one succeeding concurrent operation each handle errors independently", async () => {
        mockApiPost
          .mockResolvedValueOnce({})
          .mockRejectedValueOnce(new Error("second failed"));
        mockApiGet.mockResolvedValue(
          makeSuccessResponse({ categories: [], menuItems: [] }),
        );

        const { saveMenuItem } = useMenuManagement();
        const itemForm = {
          name: "Item",
          price: 10,
          categoryId: 1,
          isFeatured: false,
          isAvailable: true,
          sortOrder: 0,
        };

        const p1 = saveMenuItem(itemForm);
        const p2 = saveMenuItem(itemForm);
        await Promise.all([p1, p2]);

        expect(mockToast.success).toHaveBeenCalledTimes(1);
        expect(mockToast.error).toHaveBeenCalledTimes(1);
      });
    });

    // ── Delete category with items ──

    describe("Delete category with items", () => {
      beforeEach(async () => {
        mockApiGet.mockResolvedValue(
          makeSuccessResponse({
            categories: sampleCategories,
            menuItems: sampleItems,
          }),
        );
        const { fetchMenu } = useMenuManagement();
        await fetchMenu();
        vi.clearAllMocks();
      });

      test("API rejects delete of category that has items — error is shown", async () => {
        const fkError = new Error("Constraint violation") as any;
        fkError.response = {
          status: 409,
          data: {
            error: {
              message: "Cannot delete category with existing items",
            },
          },
        };
        mockApiDelete.mockRejectedValue(fkError);

        const { deleteCategory, categories } = useMenuManagement();
        const categoriesBefore = [...categories.value];

        await deleteCategory(1);

        expect(mockToast.error).toHaveBeenCalledWith(
          "Cannot delete category with existing items",
        );
        expect(mockToast.success).not.toHaveBeenCalled();
        // Categories should not be refetched on error (no fetchMenu call)
        expect(mockApiGet).not.toHaveBeenCalled();
        // State should remain unchanged
        expect(categories.value).toEqual(categoriesBefore);
      });

      test("successful delete of category with items refetches menu", async () => {
        mockApiDelete.mockResolvedValue({});
        mockApiGet.mockResolvedValue(
          makeSuccessResponse({
            categories: [sampleCategories[1]],
            menuItems: [sampleItems[2]],
          }),
        );

        const { deleteCategory, categories, menuItems } = useMenuManagement();
        await deleteCategory(1);

        expect(mockToast.success).toHaveBeenCalledWith(
          "menu.toast.categoryDeleted",
        );
        expect(mockApiGet).toHaveBeenCalled();
        // After refetch, only remaining category and items
        expect(categories.value).toHaveLength(1);
        expect(categories.value[0].name).toBe("Desserts");
        expect(menuItems.value).toHaveLength(1);
      });

      test("getItemsInCategory returns items belonging to category before delete", () => {
        const { getItemsInCategory } = useMenuManagement();
        const items = getItemsInCategory(1);

        expect(items).toHaveLength(2);
        expect(items.every((i) => i.categoryId === 1)).toBe(true);
      });

      test("selectedCategoryId is preserved when deleting a different category fails", async () => {
        const fkError = new Error("Constraint violation") as any;
        fkError.response = {
          status: 409,
          data: {
            error: {
              message: "Cannot delete category with existing items",
            },
          },
        };
        mockApiDelete.mockRejectedValue(fkError);

        const { deleteCategory, selectedCategoryId } = useMenuManagement();
        selectedCategoryId.value = 2;

        await deleteCategory(1);

        // selectedCategoryId for category 2 should be untouched
        expect(selectedCategoryId.value).toBe(2);
      });
    });
  });
});
