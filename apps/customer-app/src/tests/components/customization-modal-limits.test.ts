import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import CustomizationModal from "@/components/CustomizationModal.vue";

vi.mock("@/composables/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    tWithParams: (key: string, params: Record<string, unknown>) =>
      `${key}:${params.count}`,
  }),
}));

vi.mock("@/composables/useCurrency", () => ({
  useCurrency: () => ({
    formatPrice: (price: number) => `$${price}`,
  }),
}));

function itemWithCap(maxSelections?: number) {
  return {
    id: 1,
    name: "珍珠奶茶",
    price: 5000,
    isAvailable: true,
    options: {
      customizations: [
        {
          id: "toppings",
          name: "配料",
          type: "multiple",
          required: false,
          ...(maxSelections === undefined ? {} : { maxSelections }),
          choices: [
            { id: "pearl", name: "珍珠", priceAdjustment: 5 },
            { id: "jelly", name: "椰果", priceAdjustment: 5 },
            { id: "pudding", name: "布丁", priceAdjustment: 10 },
          ],
        },
      ],
    },
  };
}

function mountModal(maxSelections?: number) {
  return mount(CustomizationModal, {
    props: { show: true, item: itemWithCap(maxSelections) as never },
    global: { stubs: { Teleport: true, transition: false } },
  });
}

const checkboxes = (wrapper: ReturnType<typeof mountModal>) =>
  wrapper.findAll('input[type="checkbox"]');

function itemWithAddOn(maxQuantity?: number) {
  return {
    id: 1,
    name: "滷肉飯",
    price: 5000,
    isAvailable: true,
    options: {
      addOns: [
        {
          id: "egg",
          name: "加蛋",
          price: 15,
          ...(maxQuantity === undefined ? {} : { maxQuantity }),
        },
      ],
    },
  };
}

function mountWithAddOn(maxQuantity?: number) {
  return mount(CustomizationModal, {
    props: { show: true, item: itemWithAddOn(maxQuantity) as never },
    global: { stubs: { Teleport: true, transition: false } },
  });
}

describe("CustomizationModal add-on quantity", () => {
  // The order service has always taken a quantity and bounded it by
  // maxQuantity; this modal used to send 1 no matter what, so ordering two
  // eggs meant adding the whole dish to the cart twice.
  it("has no stepper until the add-on is chosen", async () => {
    const wrapper = mountWithAddOn(3);

    expect(wrapper.find('[data-testid="addon-quantity-egg"]').exists()).toBe(
      false,
    );

    await wrapper.find('input[type="checkbox"]').setValue(true);

    expect(wrapper.get('[data-testid="addon-quantity-egg"]').text()).toBe("1");
  });

  it("counts up to the cap and prices each unit", async () => {
    const wrapper = mountWithAddOn(2);
    await wrapper.find('input[type="checkbox"]').setValue(true);

    await wrapper.get('[data-testid="addon-increase-egg"]').trigger("click");

    expect(wrapper.get('[data-testid="addon-quantity-egg"]').text()).toBe("2");
    expect(wrapper.text()).toContain("$30");
    expect(
      wrapper.get('[data-testid="addon-increase-egg"]').attributes("disabled"),
    ).toBeDefined();
  });

  it("will not count below one", async () => {
    const wrapper = mountWithAddOn();
    await wrapper.find('input[type="checkbox"]').setValue(true);

    expect(
      wrapper.get('[data-testid="addon-decrease-egg"]').attributes("disabled"),
    ).toBeDefined();
  });

  it("emits the chosen quantity and its total", async () => {
    const wrapper = mountWithAddOn(3);
    await wrapper.find('input[type="checkbox"]').setValue(true);
    await wrapper.get('[data-testid="addon-increase-egg"]').trigger("click");
    await wrapper.get('[data-testid="addon-increase-egg"]').trigger("click");

    await wrapper
      .findAll("button")
      .find((button) => button.text().includes("customization.confirm"))!
      .trigger("click");

    const [customizations] = wrapper.emitted("confirm")![0] as [
      { addOns: Array<{ quantity: number; totalPrice: number }> },
    ];
    expect(customizations.addOns[0]).toMatchObject({
      quantity: 3,
      totalPrice: 45,
    });
  });

  // A cap of one leaves nothing to step through.
  it("keeps a cap of one as a plain checkbox", async () => {
    const wrapper = mountWithAddOn(1);
    await wrapper.find('input[type="checkbox"]').setValue(true);

    expect(wrapper.find('[data-testid="addon-quantity-egg"]').exists()).toBe(
      false,
    );
  });

  it("forgets the count when the add-on is unticked", async () => {
    const wrapper = mountWithAddOn(5);
    const checkbox = wrapper.find('input[type="checkbox"]');

    await checkbox.setValue(true);
    await wrapper.get('[data-testid="addon-increase-egg"]').trigger("click");
    await checkbox.setValue(false);
    await checkbox.setValue(true);

    expect(wrapper.get('[data-testid="addon-quantity-egg"]').text()).toBe("1");
  });
});

describe("CustomizationModal option caps", () => {
  // The admin form can set maxSelections, and the API stores `options` as
  // opaque JSON without checking it — so if this component ignores the cap,
  // the setting does nothing at all.
  it("stops selecting past the cap but keeps chosen ones toggleable", async () => {
    const wrapper = mountModal(2);

    await checkboxes(wrapper)[0].setValue(true);
    await checkboxes(wrapper)[1].setValue(true);

    expect(checkboxes(wrapper)[2].attributes("disabled")).toBeDefined();
    // Already-chosen rows must stay clickable, or the customer cannot undo.
    expect(checkboxes(wrapper)[0].attributes("disabled")).toBeUndefined();
    expect(checkboxes(wrapper)[1].attributes("disabled")).toBeUndefined();

    await checkboxes(wrapper)[0].setValue(false);

    expect(checkboxes(wrapper)[2].attributes("disabled")).toBeUndefined();
  });

  it("shows the cap so a blocked row is not a mystery", () => {
    expect(mountModal(2).text()).toContain(
      "customizationLimits.maxSelections:2",
    );
  });

  it("leaves an uncapped group unrestricted", async () => {
    const wrapper = mountModal();

    await checkboxes(wrapper)[0].setValue(true);
    await checkboxes(wrapper)[1].setValue(true);

    expect(checkboxes(wrapper)[2].attributes("disabled")).toBeUndefined();
    expect(wrapper.text()).not.toContain("customizationLimits.maxSelections");
  });
});
