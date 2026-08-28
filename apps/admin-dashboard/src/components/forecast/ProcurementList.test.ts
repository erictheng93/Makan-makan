// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import ProcurementList from "./ProcurementList.vue";

vi.mock("@/i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

describe("ProcurementList", () => {
  it("uses neutral empty copy and writes a UTF-8 BOM CSV", () => {
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:test");
    const blob = vi.fn();
    vi.stubGlobal("Blob", blob);
    const wrapper = mount(ProcurementList, {
      props: { items: [], ingredientDetails: new Map() },
    });
    expect(wrapper.text()).toContain("forecast.noProcurementData");
    wrapper.get("button").trigger("click");
    expect(blob).toHaveBeenCalledWith(
      ["\uFEFFSupplier,Ingredient,Quantity,Unit,Estimated Cost\n"],
      { type: "text/csv;charset=utf-8" },
    );
    createObjectURL.mockRestore();
  });
});
