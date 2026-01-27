import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { z } from "zod";
import type {
  MenuItem,
  SelectedCustomizations,
  CartItem,
} from "@makanmakan/shared-types";

// Zod schemas for localStorage validation (XSS prevention)
const MenuItemSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string().min(1).max(200),
    price: z.number().min(0),
  })
  .passthrough();

const CustomizationOptionSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(100),
  priceAdjustment: z.number().optional(),
});

const AddOnSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(100),
  unitPrice: z.number().min(0),
  quantity: z.number().int().min(1).optional(),
});

const SelectedCustomizationsSchema = z
  .object({
    size: CustomizationOptionSchema.optional(),
    options: z.array(CustomizationOptionSchema).optional(),
    addOns: z.array(AddOnSchema).optional(),
  })
  .optional();

const CartItemSchema = z
  .object({
    id: z.string().min(1).max(500),
    menuItem: MenuItemSchema,
    quantity: z.number().int().min(1).max(100),
    customizations: SelectedCustomizationsSchema,
    notes: z.string().max(500).optional(),
    price: z.number().min(0),
    totalPrice: z.number().min(0),
  })
  .passthrough();

const ShopCartDataSchema = z.object({
  items: z.array(CartItemSchema).max(100),
  restaurantId: z.string().min(1),
  phoneLastDigits: z.string().regex(/^\d{3}$/),
  timestamp: z.number().int().positive(),
});

export const useShopCartStore = defineStore("shopCart", () => {
  // State
  const items = ref<CartItem[]>([]);
  const restaurantId = ref<string | null>(null);
  const phoneLastDigits = ref<string>("");

  // Getters
  const itemCount = computed(() => {
    return items.value.reduce((total, item) => total + item.quantity, 0);
  });

  const subtotal = computed(() => {
    return items.value.reduce((total, item) => total + item.totalPrice, 0);
  });

  const isEmpty = computed(() => items.value.length === 0);

  const getItemById = (id: string) => {
    return items.value.find((item) => item.id === id);
  };

  // Actions
  const initializeCart = (restId: string, phone: string) => {
    // 如果是不同的餐廳/手機，清空購物車
    if (restaurantId.value !== restId || phoneLastDigits.value !== phone) {
      clearCart();
    }

    restaurantId.value = restId;
    phoneLastDigits.value = phone;

    // 從 localStorage 恢復購物車
    restoreCart();
  };

  const addItem = (
    menuItem: MenuItem,
    quantity: number = 1,
    customizations?: SelectedCustomizations,
    notes?: string,
  ) => {
    // 計算客製化後的價格
    const unitPrice = calculatePrice(menuItem, customizations);

    // 生成唯一ID（基於菜品ID + 客製化選項）
    const id = generateCartItemId(menuItem.id, customizations, notes);

    // 檢查是否已存在相同配置的項目
    const existingItem = getItemById(id);

    if (existingItem) {
      // 更新數量
      updateQuantity(id, existingItem.quantity + quantity);
    } else {
      // 新增項目
      const cartItem: CartItem = {
        id,
        menuItem,
        quantity,
        customizations,
        notes,
        price: unitPrice,
        totalPrice: unitPrice * quantity,
      };

      items.value.push(cartItem);
    }

    saveCart();
  };

  const updateQuantity = (id: string, quantity: number) => {
    const item = getItemById(id);
    if (!item) return;

    if (quantity <= 0) {
      removeItem(id);
    } else {
      item.quantity = quantity;
      item.totalPrice = item.price * quantity;
      saveCart();
    }
  };

  const removeItem = (id: string) => {
    const index = items.value.findIndex((item) => item.id === id);
    if (index > -1) {
      items.value.splice(index, 1);
      saveCart();
    }
  };

  const clearCart = () => {
    items.value = [];
    restaurantId.value = null;
    phoneLastDigits.value = "";
    localStorage.removeItem(getCartStorageKey());
  };

  const updateItemNotes = (id: string, notes: string) => {
    const item = getItemById(id);
    if (item) {
      item.notes = notes;
      saveCart();
    }
  };

  // Helper functions
  const calculatePrice = (
    menuItem: MenuItem,
    customizations?: SelectedCustomizations,
  ): number => {
    let price = menuItem.price;

    if (!customizations) return price;

    // 計算尺寸價格調整
    if (customizations.size) {
      price += customizations.size.priceAdjustment || 0;
    }

    // 計算客製化選項價格
    if (customizations.options && customizations.options.length > 0) {
      for (const option of customizations.options) {
        price += option.priceAdjustment || 0;
      }
    }

    // 計算加購項目價格
    if (customizations.addOns && customizations.addOns.length > 0) {
      for (const addOn of customizations.addOns) {
        price += addOn.unitPrice;
      }
    }

    return Math.max(0, price);
  };

  const generateCartItemId = (
    menuItemId: number,
    customizations?: SelectedCustomizations,
    notes?: string,
  ): string => {
    const parts = [menuItemId.toString()];

    if (customizations) {
      if (customizations.size) parts.push(`size:${customizations.size.id}`);

      if (customizations.options && customizations.options.length > 0) {
        const optionIds = customizations.options
          .map((opt) => opt.id)
          .sort()
          .join(",");
        parts.push(`options:${optionIds}`);
      }

      if (customizations.addOns && customizations.addOns.length > 0) {
        const addonIds = customizations.addOns
          .map((addon) => addon.id)
          .sort()
          .join(",");
        parts.push(`addons:${addonIds}`);
      }
    }

    if (notes?.trim()) {
      parts.push(`notes:${notes.trim()}`);
    }

    return parts.join("|");
  };

  const getCartStorageKey = () => {
    return `makanmakan_shop_cart_${restaurantId.value}_${phoneLastDigits.value}`;
  };

  const saveCart = () => {
    if (!restaurantId.value || !phoneLastDigits.value) return;

    const cartData = {
      items: items.value,
      restaurantId: restaurantId.value,
      phoneLastDigits: phoneLastDigits.value,
      timestamp: Date.now(),
    };

    try {
      localStorage.setItem(getCartStorageKey(), JSON.stringify(cartData));
    } catch (error) {
      console.warn("保存購物車失敗:", error);
    }
  };

  const restoreCart = () => {
    if (!restaurantId.value || !phoneLastDigits.value) return;

    try {
      const saved = localStorage.getItem(getCartStorageKey());
      if (!saved) return;

      // Parse JSON (unsafe until validated)
      const parsed = JSON.parse(saved);

      // Validate with Zod schema to prevent XSS attacks
      const validationResult = ShopCartDataSchema.safeParse(parsed);

      if (!validationResult.success) {
        console.warn(
          "購物車資料驗證失敗 (可能被篡改):",
          validationResult.error,
        );
        localStorage.removeItem(getCartStorageKey());
        return;
      }

      const { items: savedItems, timestamp } = validationResult.data;

      // 檢查是否過期（2小時）
      if (Date.now() - timestamp > 2 * 60 * 60 * 1000) {
        localStorage.removeItem(getCartStorageKey());
        return;
      }

      // Type assertion: Zod validates structure, types are compatible
      items.value = savedItems as unknown as CartItem[];
    } catch (error) {
      console.warn("恢復購物車失敗:", error);
      localStorage.removeItem(getCartStorageKey());
    }
  };

  return {
    // State
    items,
    restaurantId,
    phoneLastDigits,

    // Getters
    itemCount,
    subtotal,
    isEmpty,
    getItemById,

    // Actions
    initializeCart,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    updateItemNotes,
  };
});
