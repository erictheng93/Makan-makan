// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import RecipeEditor from "./RecipeEditor.vue";
import type { RecipeEntryResponse } from "@makanmasak/shared-types";

vi.mock("@/i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

function entry(): RecipeEntryResponse {
  return {
    ingredientId: 1,
    ingredientName: "Chicken",
    quantityPerServing: 0.2,
    unit: "kg",
    isOptional: false,
  };
}

function mountEditor(props: Record<string, unknown> = {}) {
  return mount(RecipeEditor, {
    props: {
      menuItemId: 10,
      menuItemName: "Fried rice",
      initialEntries: [entry()],
      availableIngredients: [],
      ...props,
    },
  });
}

describe("RecipeEditor", () => {
  it("renders the parent's save error without closing", () => {
    const wrapper = mountEditor({ error: "ingredients.recipeSaveFailed" });

    expect(wrapper.get('[data-testid="recipe-save-error"]').text()).toBe(
      "ingredients.recipeSaveFailed",
    );
  });

  it("shows no error region when the parent has none", () => {
    expect(
      mountEditor().find('[data-testid="recipe-save-error"]').exists(),
    ).toBe(false);
  });

  it("disables save while the parent reports the request in flight", async () => {
    // `saving` used to be local state reset in a finally that ran as soon as
    // the synchronous emit returned, so the button never disabled and a
    // double-click sent two PUTs.
    const wrapper = mountEditor({ submitting: true });
    const save = wrapper.findAll("button").at(-1)!;

    expect(save.attributes("disabled")).toBeDefined();
    await save.trigger("click");
    expect(wrapper.emitted("save")).toBeUndefined();
  });

  it("emits the entered rows on save when idle", async () => {
    const wrapper = mountEditor();

    await wrapper.findAll("button").at(-1)!.trigger("click");

    expect(wrapper.emitted("save")?.[0]).toEqual([
      [
        {
          ingredientId: 1,
          quantityPerServing: 0.2,
          unit: "kg",
          isOptional: false,
        },
      ],
    ]);
  });
});
