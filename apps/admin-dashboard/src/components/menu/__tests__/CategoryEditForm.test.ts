/**
 * CategoryEditForm Component Tests
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";

// ── Module mocks ───────────────────────────────────────────────────────────

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => {
      // Return recognisable strings for the keys used in the template
      const map: Record<string, string> = {
        "menu.editCategory": "編輯分類",
        "menu.addCategory": "新增分類",
        "menu.form.categoryName": "Category Name",
        "menu.form.categoryNamePlaceholder": "Enter name",
        "menu.form.nameEn": "English Name",
        "menu.form.sortOrder": "Sort Order",
        "menu.form.description": "Description",
        "menu.form.descriptionPlaceholder": "Enter description",
        "menu.form.update": "Update",
        "menu.form.add": "Add",
        "common.cancel": "Cancel",
      };
      return map[key] ?? key;
    },
  }),
}));

// ── Import after mocks ─────────────────────────────────────────────────────

import CategoryEditForm from "../CategoryEditForm.vue";

// ── Helpers ────────────────────────────────────────────────────────────────

const sampleCategory = {
  id: 5,
  name: "Mains",
  nameEn: "Mains EN",
  description: "Main dishes",
  sortOrder: 3,
};

const mountForm = (editingCategory?: typeof sampleCategory | null) => {
  return mount(CategoryEditForm, {
    props: {
      editingCategory: editingCategory ?? null,
    },
    attachTo: document.body,
    global: {
      stubs: { transition: false },
    },
  });
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe("CategoryEditForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Title", () => {
    test("shows '新增分類' when editingCategory is null", () => {
      const wrapper = mountForm(null);
      expect(wrapper.text()).toContain("新增分類");
    });

    test("shows '編輯分類' when editingCategory is provided", () => {
      const wrapper = mountForm(sampleCategory);
      expect(wrapper.text()).toContain("編輯分類");
    });
  });

  describe("Form pre-fill", () => {
    test("inputs are empty when editingCategory is null", () => {
      const wrapper = mountForm(null);
      const nameInput = wrapper.find('input[type="text"]');
      expect((nameInput.element as HTMLInputElement).value).toBe("");
    });

    test("name field is pre-filled when editingCategory is provided", async () => {
      const wrapper = mountForm(sampleCategory);
      const inputs = wrapper.findAll('input[type="text"]');
      const nameInput = inputs[0];
      expect((nameInput.element as HTMLInputElement).value).toBe("Mains");
    });

    test("nameEn field is pre-filled when editingCategory is provided", async () => {
      const wrapper = mountForm(sampleCategory);
      const inputs = wrapper.findAll('input[type="text"]');
      const nameEnInput = inputs[1];
      expect((nameEnInput.element as HTMLInputElement).value).toBe("Mains EN");
    });

    test("sortOrder field is pre-filled when editingCategory is provided", async () => {
      const wrapper = mountForm(sampleCategory);
      const sortOrderInput = wrapper.find('input[type="number"]');
      expect((sortOrderInput.element as HTMLInputElement).value).toBe("3");
    });
  });

  describe("Emitted events", () => {
    test("emits 'save' with form data and editingId on submit", async () => {
      const wrapper = mountForm(sampleCategory);

      const form = wrapper.find("form");
      await form.trigger("submit");

      const saved = wrapper.emitted("save");
      expect(saved).toBeTruthy();
      expect(saved![0][0]).toMatchObject({
        name: "Mains",
        nameEn: "Mains EN",
        description: "Main dishes",
        sortOrder: 3,
      });
      // Second argument to save is the editing id
      expect(saved![0][1]).toBe(5);
    });

    test("emits 'save' without editingId when creating new", async () => {
      const wrapper = mountForm(null);

      // Fill in the required name field
      const nameInput = wrapper.find("input[required]");
      await nameInput.setValue("New Category");

      await wrapper.find("form").trigger("submit");

      const saved = wrapper.emitted("save");
      expect(saved).toBeTruthy();
      expect(saved![0][1]).toBeUndefined();
    });

    test("emits 'cancel' when cancel button is clicked", async () => {
      const wrapper = mountForm(null);

      const cancelBtn = wrapper
        .findAll("button")
        .find((b) => b.text() === "Cancel");
      expect(cancelBtn).toBeTruthy();
      await cancelBtn!.trigger("click");

      expect(wrapper.emitted("cancel")).toBeTruthy();
    });
  });

  describe("Validation", () => {
    test("name field has required attribute", () => {
      const wrapper = mountForm(null);
      const nameInput = wrapper.find("input[required]");
      expect(nameInput.exists()).toBe(true);
    });
  });
});
