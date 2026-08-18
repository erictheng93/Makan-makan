// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ImageAssistedMenuImport from "./ImageAssistedMenuImport.vue";

describe("ImageAssistedMenuImport", () => {
  it("emits a corrected draft with a new category and item defaults", async () => {
    const wrapper = mount(ImageAssistedMenuImport, {
      props: {
        categories: [],
        sourceImages: ["https://images.example.test/menu.jpg"],
        isPublishing: false,
        errors: {},
        categoryErrors: {},
      },
    });

    await wrapper
      .get('[data-testid="image-menu-import-add-category"]')
      .trigger("click");
    await wrapper
      .get('[data-testid="image-menu-import-add-item"]')
      .trigger("click");

    const inputs = wrapper.findAll("input");
    await inputs[1].setValue("主食");
    await inputs[2].setValue("牛肉麵");
    await inputs[3].setValue("18000");
    await wrapper.get("select").setValue("new-1");
    await inputs[4].setValue("0");
    await wrapper
      .get('[data-testid="image-menu-import-publish"]')
      .trigger("click");

    expect(wrapper.emitted("publish")).toEqual([
      [
        {
          categories: [{ key: "new-1", name: "主食", sortOrder: 0 }],
          items: [
            expect.objectContaining({
              name: "牛肉麵",
              price: "18000",
              categoryKey: "new-1",
              isAvailable: true,
              sortOrder: "0",
            }),
          ],
        },
      ],
    ]);
  });
});
