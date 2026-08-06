<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { apiClient } from "@/services/api";
import { useGroupOrder } from "@/composables/useGroupOrder";

interface GroupOrderJoinPreview {
  groupOrderId: string;
  restaurantId: string;
  hostName: string;
  memberCount: number;
  fulfillmentType: "dine_in" | "delivery" | "pickup";
  expiresAt: string;
  status: string;
}

const props = defineProps<{
  shareCode: string;
}>();

const router = useRouter();
const preview = ref<GroupOrderJoinPreview | null>(null);
const isLoading = ref(true);
const isNotFound = ref(false);
const previewError = ref("");
const isJoining = ref(false);
const joinError = ref("");
const showJoinForm = ref(false);
const memberName = ref("");

const groupOrder = useGroupOrder({ restaurantId: "" });

const fulfillmentLabel = computed(() => {
  switch (preview.value?.fulfillmentType) {
    case "delivery":
      return "Delivery";
    case "pickup":
      return "Pickup";
    case "dine_in":
    default:
      return "Dine in";
  }
});

const expiresAtLabel = computed(() => {
  if (!preview.value?.expiresAt) return "";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(preview.value.expiresAt));
});

async function loadPreview(): Promise<void> {
  isLoading.value = true;
  isNotFound.value = false;
  previewError.value = "";

  try {
    preview.value = await apiClient.get<GroupOrderJoinPreview>(
      `/orders/group/join/${props.shareCode}`,
    );
  } catch (error) {
    preview.value = null;
    if (isNotFoundError(error)) {
      isNotFound.value = true;
    } else {
      previewError.value =
        error instanceof Error
          ? error.message
          : "Unable to load this group order.";
    }
  } finally {
    isLoading.value = false;
  }
}

function isNotFoundError(error: unknown): boolean {
  if (error && typeof error === "object") {
    const status = (error as { status?: unknown }).status;
    if (status === 404) return true;
  }
  return error instanceof Error && /\b404\b/.test(error.message);
}

function openJoinForm(): void {
  showJoinForm.value = true;
  joinError.value = "";
}

async function submitJoin(): Promise<void> {
  const name = memberName.value.trim();
  if (!name) {
    joinError.value = "Enter your name to join.";
    return;
  }

  isJoining.value = true;
  joinError.value = "";

  try {
    const joined = await groupOrder.joinGroupOrder(props.shareCode, name);
    const groupOrderId = groupOrder.groupOrder.value?.id;

    if (!joined || !groupOrderId) {
      throw new Error("Unable to join this group order.");
    }

    await router.push({
      name: "GroupOrder",
      params: { groupOrderId },
    });
  } catch (error) {
    joinError.value =
      error instanceof Error ? error.message : "Unable to join this group.";
  } finally {
    isJoining.value = false;
  }
}

onMounted(() => {
  void loadPreview();
});
</script>

<template>
  <main class="min-h-screen bg-ios-bg px-4 py-8">
    <section class="mx-auto w-full max-w-md">
      <div v-if="isLoading" class="py-16 text-center text-ios-secondary">
        Loading group order...
      </div>

      <div
        v-else-if="isNotFound"
        data-testid="join-not-found"
        class="rounded-lg bg-ios-card p-6 text-center"
      >
        <h1 class="text-xl font-semibold text-ios-text">
          Group order not found
        </h1>
        <p class="mt-2 text-sm text-ios-secondary">
          This share link may have expired or been cancelled.
        </p>
      </div>

      <div
        v-else-if="previewError"
        data-testid="join-preview-error"
        class="rounded-lg bg-ios-card p-6 text-center"
      >
        <h1 class="text-xl font-semibold text-ios-text">
          Unable to load group order
        </h1>
        <p class="mt-2 text-sm text-ios-secondary">{{ previewError }}</p>
        <button
          data-testid="join-retry-button"
          type="button"
          class="mt-5 rounded-md bg-ios-blue px-4 py-2 text-sm font-semibold text-white"
          @click="loadPreview"
        >
          Try again
        </button>
      </div>

      <div v-else-if="preview" class="rounded-lg bg-ios-card p-5">
        <p class="text-sm font-medium text-ios-secondary">Group order</p>
        <h1 class="mt-1 text-2xl font-semibold text-ios-text">
          {{ preview.hostName }} is ordering
        </h1>

        <dl class="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div class="rounded-md bg-ios-bg p-3">
            <dt class="text-ios-secondary">Members</dt>
            <dd class="mt-1 text-lg font-semibold text-ios-text">
              {{ preview.memberCount }}
            </dd>
          </div>
          <div class="rounded-md bg-ios-bg p-3">
            <dt class="text-ios-secondary">Fulfillment</dt>
            <dd class="mt-1 text-lg font-semibold text-ios-text">
              {{ fulfillmentLabel }}
            </dd>
          </div>
          <div class="col-span-2 rounded-md bg-ios-bg p-3">
            <dt class="text-ios-secondary">Expires</dt>
            <dd class="mt-1 font-semibold text-ios-text">
              {{ expiresAtLabel }}
            </dd>
          </div>
        </dl>

        <button
          v-if="!showJoinForm"
          data-testid="join-confirm-button"
          type="button"
          class="mt-5 w-full rounded-md bg-ios-blue px-4 py-3 text-sm font-semibold text-white"
          @click="openJoinForm"
        >
          Join group order
        </button>

        <form v-else class="mt-5 space-y-3" @submit.prevent="submitJoin">
          <label class="block text-sm font-medium text-ios-text">
            Your name
            <input
              v-model="memberName"
              data-testid="join-name-input"
              class="mt-1 block w-full rounded-md border border-ios-separator bg-white px-3 py-2 text-ios-text"
              autocomplete="name"
              type="text"
            />
          </label>

          <p v-if="joinError" class="text-sm text-ios-red">{{ joinError }}</p>

          <button
            data-testid="join-submit-button"
            type="button"
            class="w-full rounded-md bg-ios-blue px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            :disabled="isJoining"
            @click="submitJoin"
          >
            {{ isJoining ? "Joining..." : "Join now" }}
          </button>
        </form>
      </div>
    </section>
  </main>
</template>
