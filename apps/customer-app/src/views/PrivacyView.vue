<template>
  <div class="min-h-screen bg-gray-50">
    <div class="max-w-4xl mx-auto py-8 px-4">
      <h1 class="text-3xl font-bold text-gray-900 mb-8">
        {{ t("privacy.title") }}
      </h1>

      <div class="bg-white rounded-lg shadow-sm p-6 space-y-6">
        <section>
          <h2 class="text-xl font-semibold text-gray-900 mb-4">
            {{ t("privacy.dataCollection.title") }}
          </h2>
          <p class="text-gray-700">
            {{ t("privacy.dataCollection.description") }}
          </p>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 mb-4">
            {{ t("privacy.dataUsage.title") }}
          </h2>
          <p class="text-gray-700">
            {{ t("privacy.dataUsage.description") }}
          </p>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 mb-4">
            {{ t("privacy.dataProtection.title") }}
          </h2>
          <p class="text-gray-700">
            {{ t("privacy.dataProtection.description") }}
          </p>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 mb-4">
            {{ t("privacy.contact.title") }}
          </h2>
          <p class="text-gray-700">
            {{ t("privacy.contact.description") }}
          </p>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "@/composables/useI18n";

const { t } = useI18n();
</script>
