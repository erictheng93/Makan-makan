// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { describe, expect, it, vi } from "vitest";
import CouponFormModal from "./CouponFormModal.vue";

vi.mock("@/i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("@/composables/useCurrency", () => ({
  useCurrency: () => ({
    formatPrice: (value: number) => String(value),
    currencySymbol: "$",
  }),
}));
vi.mock("@/composables/useDateFormatter", () => ({
  useDateFormatter: () => ({ formatDate: (value: string) => value }),
}));

function coupon() {
  return {
    id: 1,
    code: "SAVE10",
    name: "Save 10",
    description: "",
    discountType: "percentage" as const,
    discountValue: 10,
    maxDiscountAmount: 20,
    minOrderAmount: 0,
    usageLimit: 5,
    usageLimitPerUser: 2,
    validFrom: "2026-08-01T00:00:00.000Z",
    validTo: "2026-09-01T00:00:00.000Z",
    isActive: true,
    isVisible: true,
  };
}

describe("CouponFormModal", () => {
  it("defaults a new coupon start time to now, not tomorrow", async () => {
    const before = Date.now() - 60_000;
    const wrapper = mount(CouponFormModal);
    await nextTick();
    const start = wrapper.find('input[type="datetime-local"]')
      .element as HTMLInputElement;

    expect(new Date(start.value).getTime()).toBeGreaterThanOrEqual(before);
    expect(new Date(start.value).getTime()).toBeLessThanOrEqual(
      Date.now() + 60_000,
    );
  });

  it("emits explicit nulls when an edited owner clears optional limits", async () => {
    const wrapper = mount(CouponFormModal, { props: { coupon: coupon() } });
    await nextTick();
    const numberInputs = wrapper.findAll('input[type="number"]');
    await numberInputs[1].setValue("");
    await numberInputs[3].setValue("");
    await numberInputs[4].setValue("");
    await wrapper.find("form").trigger("submit");

    const payload = wrapper.emitted("save")![0][0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      maxDiscountAmount: null,
      usageLimit: null,
      usageLimitPerUser: null,
    });
  });
});
