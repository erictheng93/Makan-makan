<script setup lang="ts">
import { ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { useOnboardingStore } from "@/stores/onboarding";
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  MapPinIcon,
} from "@heroicons/vue/24/outline";
import { useI18n } from "@/i18n";

const { t } = useI18n();
const router = useRouter();
const toast = useToast();
const store = useOnboardingStore();

const form = ref({
  businessName: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  latitude: null as number | null,
  longitude: null as number | null,
  planId: "standard" as const,
  subdomain: "",
});

const errors = ref<Record<string, string>>({});
const isLocating = ref(false);

// Debounce timer for subdomain check
let subdomainCheckTimer: ReturnType<typeof setTimeout> | null = null;

const parseCoordinate = (value: number | string | null): number | null => {
  if (value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

// Watch subdomain input for debounced availability check
watch(
  () => form.value.subdomain,
  (newValue) => {
    // Clear previous timer
    if (subdomainCheckTimer) {
      clearTimeout(subdomainCheckTimer);
    }

    // Reset status if empty
    if (!newValue) {
      store.subdomainStatus = null;
      return;
    }

    // Validate format first
    if (!/^[a-z0-9-]*$/.test(newValue)) {
      store.subdomainStatus = "invalid";
      return;
    }

    // Debounce the API call (300ms)
    subdomainCheckTimer = setTimeout(async () => {
      if (newValue.length >= 3) {
        await store.checkSubdomain(newValue);
      } else {
        store.subdomainStatus = null;
      }
    }, 300);
  },
);

const validate = (): boolean => {
  errors.value = {};

  if (!form.value.businessName.trim()) {
    errors.value.businessName = t("apply.validation.businessNameRequired");
  }

  if (!form.value.contactName.trim()) {
    errors.value.contactName = t("apply.validation.contactNameRequired");
  }

  if (!form.value.contactEmail.trim()) {
    errors.value.contactEmail = t("apply.validation.emailRequired");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.contactEmail)) {
    errors.value.contactEmail = t("apply.validation.emailInvalid");
  }

  if (!form.value.contactPhone.trim()) {
    errors.value.contactPhone = t("apply.validation.phoneRequired");
  }

  const latitude = parseCoordinate(form.value.latitude);
  const longitude = parseCoordinate(form.value.longitude);

  if (latitude === null) {
    errors.value.latitude = t("apply.validation.latitudeRequired");
  } else if (latitude < -90 || latitude > 90) {
    errors.value.latitude = t("apply.validation.latitudeInvalid");
  }

  if (longitude === null) {
    errors.value.longitude = t("apply.validation.longitudeRequired");
  } else if (longitude < -180 || longitude > 180) {
    errors.value.longitude = t("apply.validation.longitudeInvalid");
  }

  if (form.value.subdomain) {
    if (!/^[a-z0-9-]+$/.test(form.value.subdomain)) {
      errors.value.subdomain = t("apply.validation.subdomainInvalidFormat");
    } else if (form.value.subdomain.length < 3) {
      errors.value.subdomain = t("apply.validation.subdomainTooShort");
    } else if (store.subdomainStatus === "taken") {
      errors.value.subdomain = t("apply.validation.subdomainTaken");
    }
  }

  return Object.keys(errors.value).length === 0;
};

const handleSubmit = async () => {
  if (!validate()) return;

  store.clearError();
  const latitude = parseCoordinate(form.value.latitude);
  const longitude = parseCoordinate(form.value.longitude);

  if (latitude === null || longitude === null) return;

  const success = await store.submitApplication({
    businessName: form.value.businessName,
    contactName: form.value.contactName,
    contactEmail: form.value.contactEmail,
    contactPhone: form.value.contactPhone,
    latitude,
    longitude,
    planId: form.value.planId,
    subdomain: form.value.subdomain || undefined,
  });

  if (success) {
    toast.success(t("apply.toast.submitSuccess"));
    router.push("/connect");
  } else {
    toast.error(store.apiError || t("apply.toast.submitFailureFallback"));
  }
};

const selectSuggestion = (suggestion: string) => {
  form.value.subdomain = suggestion;
};

const useCurrentLocation = () => {
  if (!navigator.geolocation) {
    toast.error(t("apply.form.location.unsupported"));
    return;
  }

  isLocating.value = true;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      form.value.latitude = Number(position.coords.latitude.toFixed(6));
      form.value.longitude = Number(position.coords.longitude.toFixed(6));
      errors.value.latitude = "";
      errors.value.longitude = "";
      isLocating.value = false;
    },
    () => {
      toast.error(t("apply.form.location.failure"));
      isLocating.value = false;
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
  );
};
</script>

<template>
  <div class="max-w-2xl mx-auto">
    <!-- Progress -->
    <div class="flex items-center justify-center mb-8">
      <div class="flex items-center">
        <div
          class="w-8 h-8 rounded-full bg-primary-600 text-white flex items-center justify-center font-medium"
        >
          1
        </div>
        <div class="w-24 h-1 bg-gray-200">
          <div class="w-0 h-full bg-primary-600" />
        </div>
        <div
          class="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-medium"
        >
          2
        </div>
        <div class="w-24 h-1 bg-gray-200" />
        <div
          class="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center font-medium"
        >
          3
        </div>
      </div>
    </div>

    <div class="card">
      <h1 class="text-2xl font-bold text-gray-900 mb-6">
        {{ t("apply.title") }}
      </h1>

      <!-- API Error Alert -->
      <div
        v-if="store.apiError"
        class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg"
      >
        <p class="text-sm text-red-700">{{ store.apiError }}</p>
      </div>

      <form @submit.prevent="handleSubmit" class="space-y-6">
        <!-- 餐廳名稱 -->
        <div>
          <label class="label"
            >{{ t("apply.form.businessName.label") }} *</label
          >
          <input
            v-model="form.businessName"
            type="text"
            class="input"
            :class="{ 'input-error': errors.businessName }"
            :placeholder="t('apply.form.businessName.placeholder')"
          />
          <p v-if="errors.businessName" class="mt-1 text-sm text-red-600">
            {{ errors.businessName }}
          </p>
        </div>

        <!-- 聯絡人姓名 -->
        <div>
          <label class="label">{{ t("apply.form.contactName.label") }} *</label>
          <input
            v-model="form.contactName"
            type="text"
            class="input"
            :class="{ 'input-error': errors.contactName }"
            :placeholder="t('apply.form.contactName.placeholder')"
          />
          <p v-if="errors.contactName" class="mt-1 text-sm text-red-600">
            {{ errors.contactName }}
          </p>
        </div>

        <!-- Email -->
        <div>
          <label class="label"
            >{{ t("apply.form.contactEmail.label") }} *</label
          >
          <input
            v-model="form.contactEmail"
            type="email"
            class="input"
            :class="{ 'input-error': errors.contactEmail }"
            :placeholder="t('apply.form.contactEmail.placeholder')"
          />
          <p v-if="errors.contactEmail" class="mt-1 text-sm text-red-600">
            {{ errors.contactEmail }}
          </p>
        </div>

        <!-- 電話 -->
        <div>
          <label class="label"
            >{{ t("apply.form.contactPhone.label") }} *</label
          >
          <input
            v-model="form.contactPhone"
            type="tel"
            class="input"
            :class="{ 'input-error': errors.contactPhone }"
            :placeholder="t('apply.form.contactPhone.placeholder')"
          />
          <p v-if="errors.contactPhone" class="mt-1 text-sm text-red-600">
            {{ errors.contactPhone }}
          </p>
        </div>

        <!-- 餐廳位置 -->
        <div class="space-y-3">
          <div
            class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
          >
            <div>
              <label class="label"
                >{{ t("apply.form.location.label") }} *</label
              >
              <p class="mt-1 text-sm text-gray-500">
                {{ t("apply.form.location.help") }}
              </p>
            </div>
            <button
              type="button"
              class="btn btn-secondary shrink-0"
              :disabled="isLocating"
              @click="useCurrentLocation"
            >
              <ArrowPathIcon
                v-if="isLocating"
                class="h-4 w-4 mr-2 animate-spin"
              />
              <MapPinIcon v-else class="h-4 w-4 mr-2" />
              {{
                isLocating
                  ? t("apply.form.location.locating")
                  : t("apply.form.location.useCurrent")
              }}
            </button>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <input
                v-model.number="form.latitude"
                type="number"
                step="0.000001"
                min="-90"
                max="90"
                class="input"
                :class="{ 'input-error': errors.latitude }"
                :placeholder="t('apply.form.location.latitudePlaceholder')"
              />
              <p v-if="errors.latitude" class="mt-1 text-sm text-red-600">
                {{ errors.latitude }}
              </p>
            </div>
            <div>
              <input
                v-model.number="form.longitude"
                type="number"
                step="0.000001"
                min="-180"
                max="180"
                class="input"
                :class="{ 'input-error': errors.longitude }"
                :placeholder="t('apply.form.location.longitudePlaceholder')"
              />
              <p v-if="errors.longitude" class="mt-1 text-sm text-red-600">
                {{ errors.longitude }}
              </p>
            </div>
          </div>
        </div>

        <!-- 子域名 -->
        <div>
          <label class="label">{{ t("apply.form.subdomain.label") }}</label>
          <div class="flex">
            <div class="relative flex-1">
              <input
                v-model="form.subdomain"
                type="text"
                class="input rounded-r-none pr-10"
                :class="{
                  'input-error':
                    errors.subdomain || store.subdomainStatus === 'taken',
                  'border-green-500 focus:border-green-500 focus:ring-green-500':
                    store.subdomainStatus === 'available',
                }"
                :placeholder="t('apply.form.subdomain.placeholder')"
              />
              <!-- Status indicator -->
              <div class="absolute inset-y-0 right-0 flex items-center pr-3">
                <ArrowPathIcon
                  v-if="store.isCheckingSubdomain"
                  class="h-5 w-5 text-gray-400 animate-spin"
                />
                <CheckCircleIcon
                  v-else-if="store.subdomainStatus === 'available'"
                  class="h-5 w-5 text-green-500"
                />
                <XCircleIcon
                  v-else-if="
                    store.subdomainStatus === 'taken' ||
                    store.subdomainStatus === 'invalid'
                  "
                  class="h-5 w-5 text-red-500"
                />
              </div>
            </div>
            <span
              class="inline-flex items-center px-3 border border-l-0 border-gray-300 bg-gray-50 text-gray-500 text-sm rounded-r-md"
            >
              .makanmakan.app
            </span>
          </div>

          <!-- Subdomain status message -->
          <div class="mt-1">
            <p v-if="errors.subdomain" class="text-sm text-red-600">
              {{ errors.subdomain }}
            </p>
            <p
              v-else-if="store.subdomainStatus === 'available'"
              class="text-sm text-green-600"
            >
              {{ t("apply.form.subdomain.available") }}
            </p>
            <p
              v-else-if="store.subdomainStatus === 'taken'"
              class="text-sm text-red-600"
            >
              {{ t("apply.form.subdomain.taken") }}
            </p>
            <p
              v-else-if="store.subdomainStatus === 'invalid'"
              class="text-sm text-red-600"
            >
              {{ t("apply.form.subdomain.invalidFormat") }}
            </p>
            <p v-else class="text-xs text-gray-500">
              {{ t("apply.form.subdomain.emptyHint") }}
            </p>
          </div>

          <!-- Subdomain suggestions -->
          <div
            v-if="
              store.subdomainStatus === 'taken' &&
              store.subdomainSuggestions.length > 0
            "
            class="mt-2"
          >
            <p class="text-xs text-gray-600 mb-1">
              {{ t("apply.form.subdomain.suggestionsLabel") }}
            </p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="suggestion in store.subdomainSuggestions"
                :key="suggestion"
                type="button"
                class="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700 transition-colors"
                @click="selectSuggestion(suggestion)"
              >
                {{ suggestion }}.makanmakan.app
              </button>
            </div>
          </div>
        </div>

        <!-- 提交按鈕 -->
        <div class="flex justify-between pt-4">
          <button
            type="button"
            class="btn btn-secondary"
            @click="router.push('/')"
          >
            {{ t("common.back") }}
          </button>
          <button
            type="submit"
            class="btn btn-primary"
            :disabled="store.isLoading || store.isCheckingSubdomain"
          >
            <ArrowPathIcon
              v-if="store.isLoading"
              class="h-4 w-4 mr-2 animate-spin"
            />
            {{
              store.isLoading
                ? t("apply.form.submitting")
                : t("apply.form.next")
            }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
