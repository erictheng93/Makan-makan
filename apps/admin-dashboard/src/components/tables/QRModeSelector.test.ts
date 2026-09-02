// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import QRModeSelector from "./QRModeSelector.vue";

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

function mountSelector(modelValue: "table" | "seat" = "table") {
  return mount(QRModeSelector, {
    props: {
      modelValue,
      seatConfig: {
        count: 4,
        numberingStyle: "numeric",
      },
    },
  });
}

describe("QRModeSelector", () => {
  it("exposes the required QR mode choice as a labelled native radio group", () => {
    const wrapper = mountSelector();
    const fieldset = wrapper.get("fieldset");
    const radios = fieldset.findAll('input[type="radio"]');

    expect(fieldset.get("legend").text()).toContain("qrMode.label");
    expect(radios).toHaveLength(2);
    expect(radios.map((radio) => radio.attributes("name"))).toEqual([
      "qr-mode",
      "qr-mode",
    ]);
    expect(radios.map((radio) => radio.element.checked)).toEqual([true, false]);
  });

  it("emits the selected mode when a keyboard-accessible radio changes", async () => {
    const wrapper = mountSelector();

    await wrapper.get('input[type="radio"][value="seat"]').setValue(true);

    expect(wrapper.emitted("update:modelValue")).toEqual([["seat"]]);
  });
});
