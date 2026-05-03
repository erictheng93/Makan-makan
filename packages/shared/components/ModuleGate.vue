<script setup lang="ts">
import type { ModuleKey } from "../types/module-access";
import { useModuleAccess } from "../composables/useModuleAccess";

defineProps<{
  module: ModuleKey;
}>();

const { hasModule, isLoaded } = useModuleAccess();
</script>

<template>
  <slot v-if="isLoaded && hasModule(module)" />
  <slot v-else-if="!isLoaded" name="loading">
    <div class="h-32 animate-pulse rounded-2xl bg-ios-gray-100" />
  </slot>
  <slot v-else name="fallback" />
</template>
