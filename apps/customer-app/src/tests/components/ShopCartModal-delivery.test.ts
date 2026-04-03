import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { useShopCartStore } from "@/stores/shopCart";
import ShopCartModal from "@/components/ShopCartModal.vue";
import { menuItemFactory, resetAllFactories } from "@makanmakan/testing-utils";

// ── Mock dependencies ────────────────────────────────────────────────────────

vi.mock("@/utils/format", () => ({
  formatPrice: vi.fn((n: number) => n.toString()),
}));

// Mock useCurrency so the component's formatPrice returns the raw number as a string,
// which allows the test to assert on numeric values like "130".
vi.mock("@/composables/useCurrency", () => ({
  useCurrency: vi.fn(() => ({
    formatPrice: vi.fn((n: number) => n.toString()),
    formatAmount: vi.fn((n: number) => n.toString()),
    currencySymbol: "$",
    currencyCode: "TWD",
  })),
}));

const mockRouterPush = vi.fn();
vi.mock("vue-router", () => ({
  useRouter: vi.fn(() => ({ push: mockRouterPush })),
}));

const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();
vi.mock("vue-toastification", () => ({
  useToast: vi.fn(() => ({ error: mockToastError, success: mockToastSuccess })),
}));

vi.mock("@/services/api", () => ({
  apiClient: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));
import { apiClient } from "@/services/api";
const mockedApiClient = apiClient as unknown as {
  post: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_PROPS = {
  show: true,
  restaurantId: "rest-1",
  phoneLastDigits: "123",
};

function mountModal(props = DEFAULT_PROPS) {
  return mount(ShopCartModal, {
    props,
    global: {
      stubs: { Teleport: true, Transition: true },
    },
    attachTo: document.body,
  });
}

function populateStore(store: ReturnType<typeof useShopCartStore>) {
  const factoryItem = menuItemFactory.build({
    overrides: { id: 1, name: "Test Item", price: 100 },
  });
  store.items = [
    {
      id: "1",
      menuItem: {
        id: factoryItem.id,
        name: factoryItem.name,
        price: factoryItem.price,
      } as any,
      quantity: 1,
      price: 100,
      totalPrice: 100,
    },
  ];
  store.restaurantId = "rest-1";
  store.phoneLastDigits = "123";
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("ShopCartModal – delivery features", () => {
  let store: ReturnType<typeof useShopCartStore>;

  beforeEach(() => {
    resetAllFactories();
    setActivePinia(createPinia());
    store = useShopCartStore();
    vi.clearAllMocks();
    (window.localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(
      null,
    );
  });

  // ── 1. Fulfillment toggle renders ────────────────────────────────────────

  it("should render fulfillment toggle buttons when cart has items", () => {
    populateStore(store);
    const wrapper = mountModal();

    const text = wrapper.text();
    expect(text).toContain("Takeaway");
    wrapper.unmount();
  });

  // ── 2. Delivery button visibility ────────────────────────────────────────

  it("should show delivery button when deliveryEnabled is true", () => {
    populateStore(store);
    // deliveryEnabled is true when deliveryFee >= 0 (which is always the case)
    store.deliveryFee = 0;
    const wrapper = mountModal();

    const text = wrapper.text();
    expect(text).toContain("Delivery");
    wrapper.unmount();
  });

  // ── 3. Delivery form visibility when delivery selected ───────────────────

  it("should show delivery form when delivery is selected", async () => {
    populateStore(store);
    store.setFulfillmentType("delivery");
    const wrapper = mountModal();

    await wrapper.vm.$nextTick();
    const text = wrapper.text();
    expect(text).toContain("Delivery Address");
    expect(text).toContain("Contact Phone");
    wrapper.unmount();
  });

  // ── 4. Delivery form hidden when takeaway selected ───────────────────────

  it("should hide delivery form when takeaway is selected", async () => {
    populateStore(store);
    store.setFulfillmentType("takeaway");
    const wrapper = mountModal();

    await wrapper.vm.$nextTick();
    const text = wrapper.text();
    expect(text).not.toContain("外送地址");
    wrapper.unmount();
  });

  // ── 5. Takeaway info section ─────────────────────────────────────────────

  it("should show takeaway info section when takeaway is selected", async () => {
    populateStore(store);
    store.setFulfillmentType("takeaway");
    const wrapper = mountModal();

    await wrapper.vm.$nextTick();
    const text = wrapper.text();
    expect(text).toContain("Estimated Pickup Time");
    expect(text).toContain("Approx. 15-20 minutes");
    wrapper.unmount();
  });

  // ── 6. Subtotal and delivery fee for delivery orders ─────────────────────

  it("should display subtotal and delivery fee lines for delivery orders", async () => {
    populateStore(store);
    store.setFulfillmentType("delivery");
    store.deliveryFee = 50;
    const wrapper = mountModal();

    await wrapper.vm.$nextTick();
    const text = wrapper.text();
    expect(text).toContain("Subtotal");
    expect(text).toContain("Delivery Fee");
    wrapper.unmount();
  });

  // ── 7. No delivery fee line when fee is 0 ───────────────────────────────

  it("should not show delivery fee line when fee is 0", async () => {
    populateStore(store);
    store.setFulfillmentType("delivery");
    store.deliveryFee = 0;
    const wrapper = mountModal();

    await wrapper.vm.$nextTick();
    const text = wrapper.text();
    // Subtotal line should still appear for delivery
    expect(text).toContain("Subtotal");
    // But delivery fee line should be hidden
    expect(text).not.toContain("Delivery Fee");
    wrapper.unmount();
  });

  // ── 8. Total uses totalWithDelivery ─────────────────────────────────────

  it("should show total using totalWithDelivery", async () => {
    populateStore(store);
    store.setFulfillmentType("delivery");
    store.deliveryFee = 30;
    // item price = 100, delivery fee = 30 → totalWithDelivery = 130
    const wrapper = mountModal();

    await wrapper.vm.$nextTick();
    const text = wrapper.text();
    // formatPrice is mocked to return the number as string, so "130" should appear
    expect(text).toContain("130");
    wrapper.unmount();
  });

  // ── 9. Validate delivery address is required ─────────────────────────────

  it("should validate delivery address is required before checkout", async () => {
    populateStore(store);
    store.setFulfillmentType("delivery");
    const wrapper = mountModal();

    await wrapper.vm.$nextTick();

    // Fill phone but leave address empty
    const phoneInput = wrapper.find('input[type="tel"]');
    await phoneInput.setValue("0912345678");

    // Click checkout button
    const _checkoutBtn =
      wrapper.find("button[disabled]") || wrapper.findAll("button").at(-1);
    // Find the checkout button by its text content
    const buttons = wrapper.findAll("button");
    const checkoutButton = buttons.find((b) =>
      b.text().includes("Confirm Order"),
    );
    await checkoutButton?.trigger("click");

    expect(mockToastError).toHaveBeenCalledWith(
      "Please enter a delivery address",
    );
    wrapper.unmount();
  });

  // ── 10. Validate delivery phone is required ──────────────────────────────

  it("should validate delivery phone is required before checkout", async () => {
    populateStore(store);
    store.setFulfillmentType("delivery");
    const wrapper = mountModal();

    await wrapper.vm.$nextTick();

    // Fill address but leave phone empty
    const addressInput = wrapper.find('input[type="text"]');
    await addressInput.setValue("123 Test Street");

    // Click checkout button
    const buttons = wrapper.findAll("button");
    const checkoutButton = buttons.find((b) =>
      b.text().includes("Confirm Order"),
    );
    await checkoutButton?.trigger("click");

    expect(mockToastError).toHaveBeenCalledWith(
      "Please enter a valid phone number",
    );
    wrapper.unmount();
  });

  // ── 11. setDeliveryInfo called on store during delivery checkout ──────────

  it("should call setDeliveryInfo on store during delivery checkout", async () => {
    populateStore(store);
    store.setFulfillmentType("delivery");
    const setDeliveryInfoSpy = vi.spyOn(store, "setDeliveryInfo");

    // Mock successful apiClient response (apiClient unwraps to data.data)
    mockedApiClient.post.mockResolvedValueOnce({ id: "order-123" });

    const wrapper = mountModal();
    await wrapper.vm.$nextTick();

    // Fill in all required delivery fields
    const inputs = wrapper.findAll("input");
    const addressInput = inputs.find((i) => i.attributes("type") === "text");
    const phoneInput = inputs.find((i) => i.attributes("type") === "tel");

    await addressInput?.setValue("456 Delivery Road");
    await phoneInput?.setValue("0912345678");

    // Click checkout button
    const buttons = wrapper.findAll("button");
    const checkoutButton = buttons.find((b) =>
      b.text().includes("Confirm Order"),
    );
    await checkoutButton?.trigger("click");

    expect(setDeliveryInfoSpy).toHaveBeenCalledWith({
      address: "456 Delivery Road",
      phone: "0912345678",
      instructions: "",
    });
    wrapper.unmount();
  });

  // ── 12. deliveryInfo included in order submission payload ─────────────────

  it("should include deliveryInfo in order submission payload", async () => {
    populateStore(store);
    store.setFulfillmentType("delivery");
    store.deliveryFee = 50;

    // Mock successful apiClient response (apiClient unwraps to data.data)
    mockedApiClient.post.mockResolvedValueOnce({ id: "order-456" });

    const wrapper = mountModal();
    await wrapper.vm.$nextTick();

    // Fill in delivery fields
    const inputs = wrapper.findAll("input");
    const addressInput = inputs.find((i) => i.attributes("type") === "text");
    const phoneInput = inputs.find((i) => i.attributes("type") === "tel");

    await addressInput?.setValue("789 Order Avenue");
    await phoneInput?.setValue("0987654321");

    // Click checkout button
    const buttons = wrapper.findAll("button");
    const checkoutButton = buttons.find((b) =>
      b.text().includes("Confirm Order"),
    );
    await checkoutButton?.trigger("click");

    // Wait for async operations
    await wrapper.vm.$nextTick();

    // Component uses /guest-orders endpoint when no customer_auth_token
    expect(mockedApiClient.post).toHaveBeenCalledWith(
      "/guest-orders",
      expect.objectContaining({
        deliveryInfo: expect.objectContaining({
          type: "delivery",
          address: "789 Order Avenue",
          phone: "0987654321",
          deliveryFee: 50,
        }),
      }),
    );
    wrapper.unmount();
  });
});
