<script setup lang="ts">
import { computed, ref } from "vue";
import { useGroupOrder } from "@/composables/useGroupOrder";
import { readHostCredentials } from "@/utils/groupOrderSession";

const props = defineProps<{
  groupOrderId: string;
  recover?: (groupOrderId: string, recoveryCode: string) => Promise<void>;
}>();

const emit = defineEmits<{
  (event: "recovered"): void;
}>();

const fallbackRecover =
  props.recover ?? useGroupOrder({ restaurantId: "" }).recoverHost;
const recoveryCodeInput = ref("");
const isRevealed = ref(false);
const isRecovering = ref(false);
const error = ref("");
const credentials = ref(readHostCredentials(props.groupOrderId));

const hasCredentials = computed(() => credentials.value !== null);

async function submitRecovery(): Promise<void> {
  const normalizedCode = recoveryCodeInput.value.trim();
  error.value = "";
  if (!normalizedCode) return;

  isRecovering.value = true;
  try {
    await fallbackRecover(props.groupOrderId, normalizedCode);
    credentials.value = readHostCredentials(props.groupOrderId);
    recoveryCodeInput.value = "";
    emit("recovered");
  } catch (recoveryError) {
    error.value = recoveryErrorMessage(recoveryError);
  } finally {
    isRecovering.value = false;
  }
}

function recoveryErrorMessage(recoveryError: unknown): string {
  const status =
    recoveryError && typeof recoveryError === "object"
      ? (recoveryError as { status?: unknown }).status
      : undefined;

  if (status === 429) {
    return "Too many recovery attempts. Try again in 15 minutes.";
  }

  if (status === 400) {
    return "That recovery code did not match this group order.";
  }

  return recoveryError instanceof Error
    ? recoveryError.message
    : "Unable to recover host access.";
}
</script>

<template>
  <section class="mt-4 rounded-2xl bg-ios-card p-5 shadow-card-sm">
    <div v-if="hasCredentials">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold text-ios-text">Host recovery</h2>
          <p class="mt-1 text-xs text-ios-secondary">
            Keep this code private in case this device loses access.
          </p>
        </div>
        <button
          data-testid="reveal-recovery-code"
          type="button"
          class="shrink-0 rounded-full bg-ios-blue px-4 py-2 text-sm font-semibold text-white transition-all duration-200 active:scale-[0.98]"
          @click="isRevealed = !isRevealed"
        >
          {{ isRevealed ? "Hide" : "Show code" }}
        </button>
      </div>

      <p
        v-if="isRevealed"
        data-testid="recovery-code-value"
        class="mt-4 select-all break-all rounded-xl bg-ios-bg p-4 font-mono text-sm text-ios-text"
      >
        {{ credentials?.recoveryCode }}
      </p>
    </div>

    <form v-else class="space-y-3" @submit.prevent="submitRecovery">
      <div>
        <label
          for="group-order-recovery-code"
          class="text-sm font-semibold text-ios-text"
        >
          Recover host access
        </label>
        <input
          id="group-order-recovery-code"
          v-model="recoveryCodeInput"
          data-testid="recovery-code-input"
          type="text"
          autocomplete="one-time-code"
          class="mt-2 w-full rounded-xl border-0 bg-ios-bg px-4 py-3 text-sm text-ios-text transition-all duration-200 placeholder:text-ios-tertiary focus:bg-white focus:ring-2 focus:ring-ios-blue/30"
          placeholder="Recovery code"
        />
      </div>

      <p
        v-if="error"
        data-testid="recovery-error"
        class="rounded-xl bg-ios-red/10 p-4 text-sm text-ios-red"
      >
        {{ error }}
      </p>

      <button
        data-testid="recovery-submit"
        type="button"
        class="rounded-full bg-ios-blue px-5 py-2.5 text-sm font-semibold text-white transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
        :disabled="isRecovering"
        @click="submitRecovery"
      >
        {{ isRecovering ? "Recovering..." : "Recover" }}
      </button>
    </form>
  </section>
</template>
