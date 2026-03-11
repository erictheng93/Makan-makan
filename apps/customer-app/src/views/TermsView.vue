<template>
  <div class="min-h-screen bg-gray-50">
    <div class="max-w-4xl mx-auto py-8 px-4">
      <h1 class="text-3xl font-bold text-gray-900 mb-8">
        {{ t("terms.title") }}
      </h1>

      <div class="bg-white rounded-lg shadow-sm p-6 space-y-6">
        <section>
          <h2 class="text-xl font-semibold text-gray-900 mb-4">
            {{ t("terms.usage.title") }}
          </h2>
          <p class="text-gray-700">
            {{ t("terms.usage.description") }}
          </p>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 mb-4">
            {{ t("terms.responsibility.title") }}
          </h2>
          <p class="text-gray-700">
            {{ t("terms.responsibility.description") }}
          </p>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 mb-4">
            {{ t("terms.disclaimer.title") }}
          </h2>
          <p class="text-gray-700">
            {{ t("terms.disclaimer.description") }}
          </p>
        </section>

        <section>
          <h2 class="text-xl font-semibold text-gray-900 mb-4">
            {{ t("terms.changes.title") }}
          </h2>
          <p class="text-gray-700">
            {{ t("terms.changes.description") }}
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
