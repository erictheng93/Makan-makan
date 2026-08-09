import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { drizzle } from "drizzle-orm/d1";
import type { D1Database } from "@cloudflare/workers-types";
import { v7 as uuidv7 } from "uuid";
import type { MenuItemOptions } from "@makanmakan/shared-types";
import {
  menuItems,
  optionChoices,
  optionGroups,
  menuItemOptionGroups,
  menuItemOptionChoiceOverrides,
} from "../schema";
import * as schema from "../schema";
import { amountFromCents, toRequiredCents } from "../utils/money";

const D1_IN_CLAUSE_LIMIT = 100;

type MenuOptionsDb = ReturnType<typeof drizzle<typeof schema>>;

type MenuItemWithOptions = {
  id: number;
  options?: unknown;
};

type JsonMenuItemOptions = {
  sizes?: Array<{
    id: string;
    name: string;
    priceAdjustment: number;
    isDefault?: boolean;
  }>;
  customizations?: Array<{
    id: string;
    name: string;
    type: "single" | "multiple";
    required?: boolean;
    maxSelections?: number;
    choices: Array<{
      id: string;
      name: string;
      priceAdjustment?: number;
      isDefault?: boolean;
    }>;
  }>;
  addOns?: Array<{
    id: string;
    name: string;
    price: number;
    available?: boolean;
    maxQuantity?: number;
  }>;
};

type OptionGroupLink = {
  menuItemId: number;
  groupId: string;
  sortOrder: number;
  requiredOverride: boolean | null;
  maxSelectionsOverride: number | null;
  groupPublicId: string;
  kind: "size" | "choice" | "addon";
  name: string;
  type: "single" | "multiple";
  required: boolean;
  maxSelections: number | null;
  groupSortOrder: number;
};

type OptionChoiceRow = {
  id: string;
  groupId: string;
  publicId: string;
  name: string;
  priceAdjustmentCents: number;
  isDefault: boolean;
  isAvailable: boolean;
  maxQuantity: number | null;
  sortOrder: number;
};

type ChoiceOverrideRow = {
  menuItemId: number;
  choiceId: string;
  isHidden: boolean;
  priceAdjustmentCents: number | null;
};

export type MenuItemOptionAssemblyRows = {
  links: OptionGroupLink[];
  choices: OptionChoiceRow[];
  overrides: ChoiceOverrideRow[];
};

type BackfillMenuItemOptionsResult = {
  menuItemsScanned: number;
  menuItemsBackfilled: number;
  groupsInserted: number;
  choicesInserted: number;
};

function chunk<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function centsToRequiredAmount(cents: number): number {
  return amountFromCents(cents) ?? 0;
}

function fallbackOptionMap(
  items: MenuItemWithOptions[],
): Map<number, MenuItemOptions | undefined> {
  return new Map(
    items.map((item) => [
      item.id,
      (item.options as MenuItemOptions | null | undefined) ?? undefined,
    ]),
  );
}

export function assembleMenuItemOptions(
  item: MenuItemWithOptions,
  rows: MenuItemOptionAssemblyRows,
): MenuItemOptions | undefined {
  if (rows.links.length === 0) {
    return (item.options as MenuItemOptions | null | undefined) ?? undefined;
  }

  const choicesByGroup = new Map<string, OptionChoiceRow[]>();
  for (const choice of rows.choices) {
    const choices = choicesByGroup.get(choice.groupId) ?? [];
    choices.push(choice);
    choicesByGroup.set(choice.groupId, choices);
  }

  for (const choices of choicesByGroup.values()) {
    choices.sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
    );
  }

  const overridesByChoice = new Map<string, ChoiceOverrideRow>();
  for (const override of rows.overrides) {
    overridesByChoice.set(override.choiceId, override);
  }

  const options: MenuItemOptions = {};
  const links = [...rows.links].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder ||
      a.groupSortOrder - b.groupSortOrder ||
      a.name.localeCompare(b.name),
  );

  for (const link of links) {
    const visibleChoices = (choicesByGroup.get(link.groupId) ?? []).flatMap(
      (choice) => {
        const override = overridesByChoice.get(choice.id);
        if (override?.isHidden) return [];

        const priceAdjustmentCents =
          override?.priceAdjustmentCents ?? choice.priceAdjustmentCents;

        return [
          {
            choice,
            priceAdjustment: centsToRequiredAmount(priceAdjustmentCents),
          },
        ];
      },
    );

    // An item may reference several groups of the same kind — 配料 and
    // 飲品加購 are both add-ons. Assigning instead of appending dropped every
    // group but the last, which no backfilled item could ever reveal because
    // the backfill produces exactly one group per kind.
    if (link.kind === "size") {
      options.sizes = [
        ...(options.sizes ?? []),
        ...visibleChoices.map(({ choice, priceAdjustment }) => ({
          id: choice.publicId,
          name: choice.name,
          priceAdjustment,
          ...(choice.isDefault ? { isDefault: true } : {}),
          ...(choice.isAvailable ? {} : { available: false }),
        })),
      ];
      continue;
    }

    if (link.kind === "addon") {
      options.addOns = [
        ...(options.addOns ?? []),
        ...visibleChoices.map(({ choice, priceAdjustment }) => ({
          id: choice.publicId,
          name: choice.name,
          price: priceAdjustment,
          ...(choice.maxQuantity != null
            ? { maxQuantity: choice.maxQuantity }
            : {}),
          ...(choice.isAvailable ? {} : { available: false }),
        })),
      ];
      continue;
    }

    const required = link.requiredOverride ?? link.required;
    const maxSelections = link.maxSelectionsOverride ?? link.maxSelections;
    options.customizations = [
      ...(options.customizations ?? []),
      {
        id: link.groupPublicId,
        name: link.name,
        type: link.type,
        required,
        ...(maxSelections != null ? { maxSelections } : {}),
        choices: visibleChoices.map(({ choice, priceAdjustment }) => ({
          id: choice.publicId,
          name: choice.name,
          priceAdjustment,
          ...(choice.isDefault ? { isDefault: true } : {}),
          // Sold out is a property of the choice, not of the add-on container
          // it happens to sit in — 半糖 runs out the same way 珍珠 does.
          ...(choice.isAvailable ? {} : { available: false }),
        })),
      },
    ];
  }

  return options;
}

export async function loadAssembledMenuItemOptions(
  db: MenuOptionsDb,
  items: MenuItemWithOptions[],
): Promise<Map<number, MenuItemOptions | undefined>> {
  if (items.length === 0) return new Map();
  if (typeof (db as { select?: unknown }).select !== "function") {
    return fallbackOptionMap(items);
  }

  const result = new Map<number, MenuItemOptions | undefined>();
  const itemIds = [...new Set(items.map((item) => item.id))];
  const links: OptionGroupLink[] = [];

  for (const ids of chunk(itemIds, D1_IN_CLAUSE_LIMIT)) {
    const linkQuery = db
      .select({
        menuItemId: menuItemOptionGroups.menuItemId,
        groupId: menuItemOptionGroups.groupId,
        sortOrder: menuItemOptionGroups.sortOrder,
        requiredOverride: menuItemOptionGroups.requiredOverride,
        maxSelectionsOverride: menuItemOptionGroups.maxSelectionsOverride,
        groupPublicId: optionGroups.publicId,
        kind: optionGroups.kind,
        name: optionGroups.name,
        type: optionGroups.type,
        required: optionGroups.required,
        maxSelections: optionGroups.maxSelections,
        groupSortOrder: optionGroups.sortOrder,
      })
      .from(menuItemOptionGroups);
    if (
      typeof (linkQuery as { innerJoin?: unknown }).innerJoin !== "function"
    ) {
      return fallbackOptionMap(items);
    }
    links.push(
      ...(await linkQuery
        .innerJoin(
          optionGroups,
          eq(menuItemOptionGroups.groupId, optionGroups.id),
        )
        .where(
          and(
            inArray(menuItemOptionGroups.menuItemId, ids),
            isNull(optionGroups.deletedAt),
          ),
        )
        .orderBy(
          asc(menuItemOptionGroups.sortOrder),
          asc(optionGroups.sortOrder),
          asc(optionGroups.name),
        )),
    );
  }

  const groupIds = [...new Set(links.map((link) => link.groupId))];
  const choices: OptionChoiceRow[] = [];
  for (const ids of chunk(groupIds, D1_IN_CLAUSE_LIMIT)) {
    choices.push(
      ...(await db
        .select({
          id: optionChoices.id,
          groupId: optionChoices.groupId,
          publicId: optionChoices.publicId,
          name: optionChoices.name,
          priceAdjustmentCents: optionChoices.priceAdjustmentCents,
          isDefault: optionChoices.isDefault,
          isAvailable: optionChoices.isAvailable,
          maxQuantity: optionChoices.maxQuantity,
          sortOrder: optionChoices.sortOrder,
        })
        .from(optionChoices)
        .where(inArray(optionChoices.groupId, ids))
        .orderBy(asc(optionChoices.sortOrder), asc(optionChoices.name))),
    );
  }

  const overrides: ChoiceOverrideRow[] = [];
  for (const ids of chunk(itemIds, D1_IN_CLAUSE_LIMIT)) {
    overrides.push(
      ...(await db
        .select({
          menuItemId: menuItemOptionChoiceOverrides.menuItemId,
          choiceId: menuItemOptionChoiceOverrides.choiceId,
          isHidden: menuItemOptionChoiceOverrides.isHidden,
          priceAdjustmentCents:
            menuItemOptionChoiceOverrides.priceAdjustmentCents,
        })
        .from(menuItemOptionChoiceOverrides)
        .where(inArray(menuItemOptionChoiceOverrides.menuItemId, ids))),
    );
  }

  const linksByItem = new Map<number, OptionGroupLink[]>();
  for (const link of links) {
    const itemLinks = linksByItem.get(link.menuItemId) ?? [];
    itemLinks.push(link);
    linksByItem.set(link.menuItemId, itemLinks);
  }

  for (const item of items) {
    const itemLinks = linksByItem.get(item.id) ?? [];
    const groupIdSet = new Set(itemLinks.map((link) => link.groupId));
    const choiceIdSet = new Set(
      choices
        .filter((choice) => groupIdSet.has(choice.groupId))
        .map((choice) => choice.id),
    );
    result.set(
      item.id,
      assembleMenuItemOptions(item, {
        links: itemLinks,
        choices: choices.filter((choice) => groupIdSet.has(choice.groupId)),
        overrides: overrides.filter(
          (override) =>
            override.menuItemId === item.id &&
            choiceIdSet.has(override.choiceId),
        ),
      }),
    );
  }

  return result;
}

export async function backfillMenuItemOptions(
  d1: D1Database,
): Promise<BackfillMenuItemOptionsResult> {
  const db = drizzle(d1, { schema });
  const items = await db
    .select({
      id: menuItems.id,
      restaurantId: menuItems.restaurantId,
      options: menuItems.options,
    })
    .from(menuItems)
    .where(isNotNull(menuItems.options));

  const existingLinks = await db
    .select({ menuItemId: menuItemOptionGroups.menuItemId })
    .from(menuItemOptionGroups);
  const alreadyBackfilled = new Set(existingLinks.map((row) => row.menuItemId));

  const groupRows: (typeof optionGroups.$inferInsert)[] = [];
  const choiceRows: (typeof optionChoices.$inferInsert)[] = [];
  const linkRows: (typeof menuItemOptionGroups.$inferInsert)[] = [];

  for (const item of items) {
    if (alreadyBackfilled.has(item.id)) continue;
    const options = item.options as JsonMenuItemOptions | null;
    if (!options) continue;
    let groupSortOrder = 0;

    if (options.sizes?.length) {
      const groupId = uuidv7();
      groupRows.push({
        id: groupId,
        restaurantId: item.restaurantId,
        publicId: "sizes",
        kind: "size",
        name: "Sizes",
        type: "single",
        required: true,
        sortOrder: groupSortOrder,
      });
      linkRows.push({
        menuItemId: item.id,
        groupId,
        sortOrder: groupSortOrder,
      });
      options.sizes.forEach((size, choiceSortOrder) => {
        choiceRows.push({
          id: uuidv7(),
          groupId,
          publicId: size.id,
          name: size.name,
          priceAdjustmentCents: toRequiredCents(size.priceAdjustment),
          isDefault: size.isDefault ?? false,
          sortOrder: choiceSortOrder,
        });
      });
      groupSortOrder++;
    }

    for (const customization of options.customizations ?? []) {
      const groupId = uuidv7();
      groupRows.push({
        id: groupId,
        restaurantId: item.restaurantId,
        publicId: customization.id,
        kind: "choice",
        name: customization.name,
        type: customization.type,
        required: customization.required ?? false,
        maxSelections: customization.maxSelections,
        sortOrder: groupSortOrder,
      });
      linkRows.push({
        menuItemId: item.id,
        groupId,
        sortOrder: groupSortOrder,
      });
      customization.choices.forEach((choice, choiceSortOrder) => {
        choiceRows.push({
          id: uuidv7(),
          groupId,
          publicId: choice.id,
          name: choice.name,
          priceAdjustmentCents: toRequiredCents(choice.priceAdjustment ?? 0),
          isDefault: choice.isDefault ?? false,
          sortOrder: choiceSortOrder,
        });
      });
      groupSortOrder++;
    }

    if (options.addOns?.length) {
      const groupId = uuidv7();
      groupRows.push({
        id: groupId,
        restaurantId: item.restaurantId,
        publicId: "addOns",
        kind: "addon",
        name: "Add-ons",
        type: "multiple",
        required: false,
        sortOrder: groupSortOrder,
      });
      linkRows.push({
        menuItemId: item.id,
        groupId,
        sortOrder: groupSortOrder,
      });
      options.addOns.forEach((addOn, choiceSortOrder) => {
        choiceRows.push({
          id: uuidv7(),
          groupId,
          publicId: addOn.id,
          name: addOn.name,
          priceAdjustmentCents: toRequiredCents(addOn.price),
          isAvailable: addOn.available ?? true,
          maxQuantity: addOn.maxQuantity,
          sortOrder: choiceSortOrder,
        });
      });
    }
  }

  const statements = [
    ...groupRows.map(
      (row) => db.insert(optionGroups).values(row) as BatchItem<"sqlite">,
    ),
    ...choiceRows.map(
      (row) => db.insert(optionChoices).values(row) as BatchItem<"sqlite">,
    ),
    ...linkRows.map(
      (row) =>
        db.insert(menuItemOptionGroups).values(row) as BatchItem<"sqlite">,
    ),
  ];
  if (statements.length > 0) {
    await db.batch(
      statements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]],
    );
  }

  return {
    menuItemsScanned: items.length,
    menuItemsBackfilled: new Set(linkRows.map((row) => row.menuItemId)).size,
    groupsInserted: groupRows.length,
    choicesInserted: choiceRows.length,
  };
}
