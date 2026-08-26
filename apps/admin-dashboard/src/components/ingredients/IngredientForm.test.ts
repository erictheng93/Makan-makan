// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import IngredientForm from "./IngredientForm.vue";
import type { IngredientDefinitionResponse } from "@makanmasak/shared-types";

vi.mock("@/i18n", () => ({
  useI18n: () => ({ t: (key: string) => key, locale: ref("zh-TW") }),
}));

function ingredient(
  overrides: Partial<IngredientDefinitionResponse> = {},
): IngredientDefinitionResponse {
  return {
    id: 1,
    name: "糯米",
    unit: "kg",
    category: "主食",
    costPerUnit: 60,
    supplier: null,
    minStockLevel: 20,
    currentStock: 10,
    isActive: true,
    ...overrides,
  } as IngredientDefinitionResponse;
}

/** The payload the form emits, which is what actually reaches the API. */
async function submit(props: Record<string, unknown>) {
  const wrapper = mount(IngredientForm, { props });
  await wrapper.find("form").trigger("submit");
  const saved = wrapper.emitted("save");
  expect(saved).toBeTruthy();
  return saved![0][0] as Record<string, unknown>;
}

describe("IngredientForm optional numeric fields", () => {
  /**
   * `props.ingredient?.currentStock || undefined` treated a stored 0 as
   * absent, so an ingredient at zero stock opened with a blank field — the
   * one case an owner is most likely to be looking at.
   */
  it("shows a stored zero rather than an empty field", async () => {
    const wrapper = mount(IngredientForm, {
      props: { ingredient: ingredient({ currentStock: 0 }) },
    });

    const stock = wrapper
      .findAll("input[type=number]")
      .find((i) => (i.element as HTMLInputElement).value === "0");
    expect(stock).toBeDefined();
  });

  /**
   * The two API schemas differ: updateIngredientSchema is
   * `.nullable().optional()` so an explicit null clears the column, while
   * createIngredientSchema is only `.optional()` and rejects null outright.
   * Clearing has to mean different things on the two paths.
   */
  it("clears a field to null when editing", async () => {
    const payload = await submit({ ingredient: ingredient() });
    // Simulate the owner blanking the input: v-model.number yields "".
    const wrapper = mount(IngredientForm, {
      props: { ingredient: ingredient() },
    });
    const inputs = wrapper.findAll("input[type=number]");
    await inputs[0].setValue("");
    await inputs[2].setValue("");
    await wrapper.find("form").trigger("submit");
    const cleared = wrapper.emitted("save")![0][0] as Record<string, unknown>;

    expect(payload.costPerUnit).toBe(60);
    expect(cleared.costPerUnit).toBeNull();
    expect(cleared.minStockLevel).toBeNull();
  });

  it("omits a blank field when creating, because the create schema rejects null", async () => {
    const wrapper = mount(IngredientForm, { props: {} });
    await wrapper.find("input[type=text]").setValue("新食材");
    await wrapper.find("form").trigger("submit");
    const payload = wrapper.emitted("save")![0][0] as Record<string, unknown>;

    expect(payload.costPerUnit).toBeUndefined();
    expect(payload.currentStock).toBeUndefined();
    expect(payload.minStockLevel).toBeUndefined();
  });
});
