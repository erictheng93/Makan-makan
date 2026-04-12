<script setup lang="ts">
import { RouterLink } from "vue-router";
import { HomeIcon } from "@heroicons/vue/24/outline";
import { useI18n } from "@/i18n";

const { t } = useI18n();
</script>

<template>
  <div class="min-h-[60vh] flex items-center justify-center">
    <div class="text-center">
      <p class="text-6xl font-bold text-primary-600">404</p>
      <h1 class="mt-4 text-2xl font-bold text-gray-900">
        {{ t("notFound.title") }}
      </h1>
      <p class="mt-2 text-gray-500">{{ t("notFound.description") }}</p>
      <RouterLink to="/" class="mt-6 btn btn-primary inline-flex">
        <HomeIcon class="h-5 w-5 mr-2" />
        {{ t("notFound.backHome") }}
      </RouterLink>
    </div>
  </div>
</template>
