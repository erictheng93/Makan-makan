import { ref } from "vue";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { useToast } from "vue-toastification";
import { useI18n } from "@/i18n";
import { getApiErrorCode } from "@makanmasak/shared/utils/unknown";

/**
 * Shared customization option groups.
 *
 * A group belongs to the restaurant, not to one dish, so 甜度 is built once
 * here and referenced by every drink. Prices are in the same unit the API
 * speaks — dollars, not cents; the conversion lives on the server.
 */
export interface OptionChoiceData {
  id: string;
  groupId: string;
  publicId: string;
  name: string;
  priceAdjustment: number;
  isDefault: boolean;
  /** The manual sold-out switch, shared by every item offering this choice. */
  isAvailable: boolean;
  maxQuantity: number | null;
  sortOrder: number;
}

export interface OptionGroupData {
  id: string;
  restaurantId: string;
  /** Stable id the customer's cart refers to. Never editable after creation. */
  publicId: string;
  kind: "size" | "choice" | "addon";
  name: string;
  type: "single" | "multiple";
  required: boolean;
  maxSelections: number | null;
  sortOrder: number;
  /** How many menu items currently offer this group. */
  usageCount: number;
  choices: OptionChoiceData[];
}

/**
 * One item's option setup, in exactly the shape the API both returns and
 * accepts. It round-trips: what a GET hands back is a legal PUT body, so the
 * form can hold it as its state and post it straight back.
 */
export interface MenuItemOptionGroupLink {
  groupId: string;
  sortOrder: number;
  /** null inherits the group's own value. */
  requiredOverride: boolean | null;
  maxSelectionsOverride: number | null;
  choiceOverrides: Array<{
    choiceId: string;
    isHidden: boolean;
    /** null inherits the group's price for this choice. */
    priceAdjustment: number | null;
  }>;
}

export type OptionGroupInput = {
  publicId: string;
  kind: OptionGroupData["kind"];
  name: string;
  type: OptionGroupData["type"];
  required: boolean;
  maxSelections: number | null;
  sortOrder?: number;
};

export type OptionChoiceInput = {
  publicId: string;
  name: string;
  priceAdjustment: number;
  isDefault: boolean;
  isAvailable: boolean;
  maxQuantity: number | null;
  sortOrder?: number;
};

export function useOptionGroups() {
  const authStore = useAuthStore();
  const toast = useToast();
  const { t } = useI18n();

  const groups = ref<OptionGroupData[]>([]);
  const isLoading = ref(false);

  const normalizeGroup = (raw: any): OptionGroupData => ({
    id: raw.id,
    restaurantId: String(raw.restaurantId ?? ""),
    publicId: raw.publicId,
    kind: raw.kind,
    name: raw.name,
    type: raw.type,
    required: !!raw.required,
    maxSelections: raw.maxSelections ?? null,
    sortOrder: raw.sortOrder ?? 0,
    usageCount: raw.usageCount ?? 0,
    choices: (raw.choices ?? []).map(
      (choice: any): OptionChoiceData => ({
        id: choice.id,
        groupId: choice.groupId,
        publicId: choice.publicId,
        name: choice.name,
        priceAdjustment: choice.priceAdjustment ?? 0,
        isDefault: !!choice.isDefault,
        isAvailable: choice.isAvailable !== false,
        maxQuantity: choice.maxQuantity ?? null,
        sortOrder: choice.sortOrder ?? 0,
      }),
    ),
  });

  const fetchGroups = async () => {
    if (!authStore.restaurantId) return;
    isLoading.value = true;
    try {
      const response = await api.get<any>(
        `/menu/${authStore.restaurantId}/option-groups`,
      );
      const payload = response.data?.success ? response.data.data : undefined;
      groups.value = Array.isArray(payload) ? payload.map(normalizeGroup) : [];
    } catch (error) {
      console.error("Failed to fetch option groups:", error);
      toast.error(t("optionGroups.errors.fetchFailed"));
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Every mutation refetches rather than patching the local list. The list is
   * small, and a group edit changes what several items offer — reconstructing
   * that locally is more ways to be wrong than one extra request.
   */
  const runMutation = async (
    mutate: () => Promise<unknown>,
    successKey: string,
    failureKey: string,
  ): Promise<boolean> => {
    try {
      await mutate();
      await fetchGroups();
      toast.success(t(successKey));
      return true;
    } catch (error: unknown) {
      console.error(failureKey, error);
      const code = getApiErrorCode(error);
      toast.error(
        code === "OPTION_GROUP_PUBLIC_ID_CONFLICT"
          ? t("optionGroups.errors.publicIdConflict")
          : t(failureKey),
      );
      return false;
    }
  };

  const createGroup = (input: OptionGroupInput) =>
    runMutation(
      () =>
        api.post(`/menu/${authStore.restaurantId}/option-groups`, {
          publicId: input.publicId,
          kind: input.kind,
          name: input.name,
          type: input.type,
          required: input.required,
          // Blank means no cap, and the field is omitted rather than sent as 0.
          ...(input.maxSelections != null
            ? { maxSelections: input.maxSelections }
            : {}),
          ...(input.sortOrder != null ? { sortOrder: input.sortOrder } : {}),
        }),
      "optionGroups.toast.created",
      "optionGroups.errors.saveFailed",
    );

  const updateGroup = (
    groupId: string,
    input: Omit<OptionGroupInput, "publicId" | "kind">,
  ) =>
    runMutation(
      () =>
        api.put(`/menu/option-groups/${groupId}`, {
          name: input.name,
          type: input.type,
          required: input.required,
          // null clears the cap. publicId and kind are never sent: the cart
          // refers to publicId, and kind decides which container the option
          // lands in — both are fixed at creation.
          maxSelections: input.maxSelections,
          ...(input.sortOrder != null ? { sortOrder: input.sortOrder } : {}),
        }),
      "optionGroups.toast.updated",
      "optionGroups.errors.saveFailed",
    );

  const deleteGroup = (groupId: string) =>
    runMutation(
      () => api.delete(`/menu/option-groups/${groupId}`),
      "optionGroups.toast.deleted",
      "optionGroups.errors.deleteFailed",
    );

  const createChoice = (groupId: string, input: OptionChoiceInput) =>
    runMutation(
      () =>
        api.post(`/menu/option-groups/${groupId}/choices`, {
          publicId: input.publicId,
          name: input.name,
          priceAdjustment: input.priceAdjustment,
          isDefault: input.isDefault,
          isAvailable: input.isAvailable,
          ...(input.maxQuantity != null
            ? { maxQuantity: input.maxQuantity }
            : {}),
          ...(input.sortOrder != null ? { sortOrder: input.sortOrder } : {}),
        }),
      "optionGroups.toast.choiceCreated",
      "optionGroups.errors.saveFailed",
    );

  const updateChoice = (
    choiceId: string,
    input: Partial<Omit<OptionChoiceInput, "publicId">>,
  ) =>
    runMutation(
      () => api.patch(`/menu/option-choices/${choiceId}`, input),
      "optionGroups.toast.choiceUpdated",
      "optionGroups.errors.saveFailed",
    );

  const deleteChoice = (choiceId: string) =>
    runMutation(
      () => api.delete(`/menu/option-choices/${choiceId}`),
      "optionGroups.toast.choiceDeleted",
      "optionGroups.errors.deleteFailed",
    );

  /** The sold-out switch. Separated because it is the one-tap path. */
  const setChoiceAvailability = (choiceId: string, isAvailable: boolean) =>
    runMutation(
      () => api.patch(`/menu/option-choices/${choiceId}`, { isAvailable }),
      isAvailable
        ? "optionGroups.toast.backInStock"
        : "optionGroups.toast.soldOut",
      "optionGroups.errors.saveFailed",
    );

  /**
   * An item with no link rows is still on its JSON options — the assembler
   * falls back to that column — so an empty list is the signal that this item
   * has not moved to shared groups, not that it has no options.
   */
  const fetchItemGroups = async (
    menuItemId: number,
  ): Promise<MenuItemOptionGroupLink[]> => {
    try {
      const response = await api.get<any>(
        `/menu/items/${menuItemId}/option-groups`,
      );
      const payload = response.data?.success ? response.data.data : undefined;
      return (payload?.groups ?? []).map(
        (group: any): MenuItemOptionGroupLink => ({
          groupId: group.groupId,
          sortOrder: group.sortOrder ?? 0,
          requiredOverride: group.requiredOverride ?? null,
          maxSelectionsOverride: group.maxSelectionsOverride ?? null,
          choiceOverrides: (group.choiceOverrides ?? []).map(
            (override: any) => ({
              choiceId: override.choiceId,
              isHidden: !!override.isHidden,
              priceAdjustment: override.priceAdjustment ?? null,
            }),
          ),
        }),
      );
    } catch (error) {
      console.error("Failed to fetch item option groups:", error);
      toast.error(t("optionGroups.errors.fetchFailed"));
      return [];
    }
  };

  /**
   * Replaces the whole set. Returns false on failure so the caller can keep
   * the modal open rather than reporting a save that did not happen.
   */
  const saveItemGroups = async (
    menuItemId: number,
    groups: MenuItemOptionGroupLink[],
  ): Promise<boolean> => {
    try {
      await api.put(`/menu/items/${menuItemId}/option-groups`, { groups });
      return true;
    } catch (error: unknown) {
      console.error("Failed to save item option groups:", error);
      const code = getApiErrorCode(error);
      toast.error(
        code === "OPTION_GROUP_PUBLIC_ID_CONFLICT"
          ? t("optionGroups.errors.publicIdConflict")
          : t("optionGroups.errors.saveFailed"),
      );
      return false;
    }
  };

  return {
    groups,
    isLoading,
    fetchGroups,
    fetchItemGroups,
    saveItemGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    createChoice,
    updateChoice,
    deleteChoice,
    setChoiceAvailability,
  };
}
