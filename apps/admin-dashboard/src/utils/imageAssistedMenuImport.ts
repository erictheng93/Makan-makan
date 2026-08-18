import type { MenuItemImportInput } from "./menuItemImport";

export interface ImageMenuCategoryDraft {
  key: string;
  name: string;
  sortOrder: number;
}

export interface ImageAssistedMenuItemDraft {
  id: string;
  name: string;
  price: string;
  categoryKey: string;
  description: string;
  isAvailable: boolean;
  sortOrder: string;
}

export type ImageAssistedMenuItemErrors = Record<
  string,
  Partial<Record<keyof ImageAssistedMenuItemDraft, string>>
>;

export function validateImageAssistedMenuItems(
  drafts: ImageAssistedMenuItemDraft[],
  categoryIds: ReadonlyMap<string, number>,
): { items: MenuItemImportInput[]; errors: ImageAssistedMenuItemErrors } {
  const errors: ImageAssistedMenuItemErrors = {};
  const items: MenuItemImportInput[] = [];

  for (const draft of drafts) {
    const rowErrors: Partial<Record<keyof ImageAssistedMenuItemDraft, string>> =
      {};
    const price = Number(draft.price);
    const sortOrder = Number(draft.sortOrder);
    const categoryId = categoryIds.get(draft.categoryKey);

    if (!draft.name.trim()) rowErrors.name = "名稱必填。";
    if (!Number.isInteger(price) || price < 0) {
      rowErrors.price = "價格必須是 0 以上整數分。";
    }
    if (!categoryId) rowErrors.categoryKey = "請選擇分類。";
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      rowErrors.sortOrder = "排序必須是 0 以上整數。";
    }

    if (Object.keys(rowErrors).length > 0) {
      errors[draft.id] = rowErrors;
      continue;
    }

    items.push({
      name: draft.name.trim(),
      price,
      categoryId,
      ...(draft.description.trim()
        ? { description: draft.description.trim() }
        : {}),
      isAvailable: draft.isAvailable,
      isFeatured: false,
      catalogType: "menu_item",
      sortOrder,
    });
  }

  return Object.keys(errors).length > 0
    ? { items: [], errors }
    : { items, errors };
}
