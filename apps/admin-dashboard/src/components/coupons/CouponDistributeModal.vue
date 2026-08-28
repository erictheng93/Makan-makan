<template>
  <div
    class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50"
  >
    <div
      class="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white"
    >
      <div class="mt-3">
        <div class="flex items-center justify-between pb-4 border-b">
          <h3 class="text-lg font-semibold text-gray-900">
            {{ t("couponDistribute.title") }} - {{ coupon.name }}
          </h3>
          <button
            class="text-gray-400 hover:text-gray-600"
            data-testid="distribute-close"
            @click="$emit('close')"
          >
            <XMarkIcon class="h-6 w-6" />
          </button>
        </div>

        <div class="mt-6 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              {{ t("couponDistribute.targetType") }}
            </label>
            <select
              v-model="form.targetType"
              data-testid="distribute-target-type"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">
                {{ t("couponDistribute.targets.all") }}
              </option>
              <option value="new_user">
                {{ t("couponDistribute.targets.newUser") }}
              </option>
              <option value="vip">
                {{ t("couponDistribute.targets.vip") }}
              </option>
              <option value="user">
                {{ t("couponDistribute.targets.user") }}
              </option>
            </select>
            <p class="mt-1 text-xs text-gray-500">
              {{ t(`couponDistribute.hints.${targetKey(form.targetType)}`) }}
            </p>
          </div>

          <div v-if="form.targetType === 'vip'">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              {{ t("couponDistribute.minOrders") }}
            </label>
            <input
              v-model.number="form.minOrders"
              type="number"
              min="1"
              data-testid="distribute-min-orders"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div v-if="form.targetType === 'user'">
            <label class="block text-sm font-medium text-gray-700 mb-2">
              {{ t("couponDistribute.customerIds") }}
            </label>
            <textarea
              v-model="form.customerIdsRaw"
              rows="3"
              data-testid="distribute-customer-ids"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">
              {{ t("couponDistribute.notes") }}
            </label>
            <input
              v-model="form.notes"
              type="text"
              maxlength="500"
              data-testid="distribute-notes"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>

        <div class="mt-6 flex justify-end space-x-3 pb-4 border-b">
          <button
            class="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg"
            @click="$emit('close')"
          >
            {{ t("common.cancel") }}
          </button>
          <button
            :disabled="!canSubmit || isSubmitting"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="distribute-submit"
            @click="submit"
          >
            {{
              isSubmitting
                ? t("couponDistribute.submitting")
                : t("couponDistribute.submit")
            }}
          </button>
        </div>

        <!-- Batches already issued for this coupon -->
        <div class="mt-6">
          <h4 class="text-sm font-medium text-gray-700 mb-3">
            {{ t("couponDistribute.history") }}
          </h4>
          <p
            v-if="isLoadingHistory"
            class="text-sm text-gray-500"
            data-testid="distribute-history-loading"
          >
            {{ t("common.loading") }}
          </p>
          <p
            v-else-if="distributions.length === 0"
            class="text-sm text-gray-500"
            data-testid="distribute-history-empty"
          >
            {{ t("couponDistribute.historyEmpty") }}
          </p>
          <table v-else class="w-full text-sm" data-testid="distribute-history">
            <thead>
              <tr class="text-left text-gray-500">
                <th class="py-1">{{ t("couponDistribute.colTarget") }}</th>
                <th class="py-1">{{ t("couponDistribute.colIssued") }}</th>
                <th class="py-1">{{ t("couponDistribute.colUsed") }}</th>
                <th class="py-1">{{ t("couponDistribute.colWhen") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in distributions"
                :key="row.id"
                class="border-t border-gray-100"
              >
                <td class="py-1">
                  {{
                    t(`couponDistribute.targets.${targetKey(row.targetType)}`)
                  }}
                </td>
                <td class="py-1">{{ row.totalDistributed ?? 0 }}</td>
                <td class="py-1">{{ row.totalUsed ?? 0 }}</td>
                <td class="py-1">{{ formatDate(row.distributedAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { XMarkIcon } from "@heroicons/vue/24/outline";
import { useI18n } from "@/i18n";
import { useDateFormatter } from "@/composables/useDateFormatter";
import { api } from "@/services/api";
import { useToast } from "vue-toastification";
import { extractApiErrorCode } from "@/utils/errorHandler";
import type { Coupon } from "@makanmasak/shared-types";

const props = defineProps<{ coupon: Coupon }>();
const emit = defineEmits<{ close: []; distributed: [] }>();

const { t } = useI18n();
const { formatDate } = useDateFormatter();
const toast = useToast();

interface DistributionRow {
  id: number;
  targetType: string | null;
  totalDistributed: number | null;
  totalUsed: number | null;
  distributedAt: string;
}

const distributions = ref<DistributionRow[]>([]);
const isLoadingHistory = ref(true);
const isSubmitting = ref(false);

const form = ref({
  targetType: "all" as "all" | "new_user" | "vip" | "user",
  minOrders: 5,
  customerIdsRaw: "",
  notes: "",
});

const customerIds = computed(() =>
  form.value.customerIdsRaw
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean),
);

// "user" without a list would resolve to an empty audience and report a
// successful distribution to nobody.
const canSubmit = computed(
  () => form.value.targetType !== "user" || customerIds.value.length > 0,
);

/** The API may store a target this build has no label for; fall back rather than render a raw key. */
const targetKey = (value: string | null) => {
  const known = ["all", "new_user", "vip", "user"];
  if (!value || !known.includes(value)) return "all";
  return value === "new_user" ? "newUser" : value;
};

const loadHistory = async () => {
  isLoadingHistory.value = true;
  try {
    const response = await api.get<DistributionRow[]>(
      `/coupons/${props.coupon.id}/distributions`,
    );
    distributions.value = response.data.data ?? [];
  } catch {
    toast.error(t("couponDistribute.historyFailed"));
  } finally {
    isLoadingHistory.value = false;
  }
};

const submit = async () => {
  if (!canSubmit.value || isSubmitting.value) return;
  isSubmitting.value = true;
  try {
    const response = await api.post<{ issued: number; skipped: number }>(
      `/coupons/${props.coupon.id}/distribute`,
      {
        distributionType: "manual",
        targetType: form.value.targetType,
        targetCriteria:
          form.value.targetType === "user"
            ? { customerIds: customerIds.value }
            : form.value.targetType === "vip"
              ? { minOrders: form.value.minOrders }
              : undefined,
        notes: form.value.notes || undefined,
      },
    );
    const data = response.data.data;
    toast.success(
      t("couponDistribute.done", {
        issued: data?.issued ?? 0,
        skipped: data?.skipped ?? 0,
      }),
    );
    emit("distributed");
    await loadHistory();
  } catch (error) {
    if (
      extractApiErrorCode(error) === "COUPON_DISTRIBUTION_TARGET_UNSUPPORTED"
    ) {
      toast.error(t("couponDistribute.targetUnsupported"));
    } else {
      toast.error(t("couponDistribute.failed"));
    }
  } finally {
    isSubmitting.value = false;
  }
};

onMounted(loadHistory);
</script>
