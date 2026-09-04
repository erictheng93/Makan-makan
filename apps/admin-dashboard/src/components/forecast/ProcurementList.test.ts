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
      ["\uFEFFSupplier,Ingredient,Quantity,Unit,Estimated Cost"],
      { type: "text/csv;charset=utf-8" },
    );
    createObjectURL.mockRestore();
  });

  it("quotes and neutralizes free-text supplier and ingredient names", () => {
    const createObjectURL = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:test");
    const blob = vi.fn();
    vi.stubGlobal("Blob", blob);

    const wrapper = mount(ProcurementList, {
      props: {
        items: [
          {
            ingredientId: 1,
            ingredientName: '=HYPERLINK("http://evil","click")',
            unit: 'kg"s',
            gap: 3,
          },
        ] as never,
        ingredientDetails: new Map([
          [1, { supplier: 'Acme, "Best" Foods', costPerUnit: 2 }],
        ]),
      },
    });

    wrapper.get("button").trigger("click");

    const [[parts]] = blob.mock.calls;
    const csv = (parts as string[])[0];
    // 值裡的 " 要成對逃逸，欄位才不會被撐開
    expect(csv).toContain('"Acme, ""Best"" Foods"');
    // = 開頭的自由文字要被前置單引號中和，不能讓 Excel 當公式跑
    expect(csv).toContain('"\'=HYPERLINK(""http://evil"",""click"")"');
    expect(csv).toContain('"kg""s"');
    createObjectURL.mockRestore();
  });
});
