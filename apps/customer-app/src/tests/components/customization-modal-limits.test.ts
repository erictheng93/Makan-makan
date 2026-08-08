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
