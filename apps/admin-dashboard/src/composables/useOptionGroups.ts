import { ref } from "vue";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import { useToast } from "vue-toastification";
import { useI18n } from "@/i18n";

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
  choices: OptionChoiceData[];
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
    } catch (error: any) {
      console.error(failureKey, error);
      const code = error?.response?.data?.error?.code;
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

  return {
    groups,
    isLoading,
    fetchGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    createChoice,
    updateChoice,
    deleteChoice,
    setChoiceAvailability,
  };
}
