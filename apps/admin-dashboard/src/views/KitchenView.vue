<script setup lang="ts">
import ModuleGate from "@makanmakan/shared/components/ModuleGate.vue";
</script>

<template>
  <ModuleGate module="kitchen_display">
    <div class="min-h-screen bg-gray-50 px-4 py-10 sm:px-6 lg:px-8">
      <div
        class="mx-auto max-w-3xl rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600"
      >
        Kitchen display access is enabled for this restaurant.
      </div>
    </div>
    <template #fallback>
      <div class="min-h-screen bg-gray-50 px-4 py-10 sm:px-6 lg:px-8">
        <div
          class="mx-auto max-w-3xl rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600"
        >
          Kitchen display is not included in the current plan.
        </div>
      </div>
    </template>
    <template #loading>
      <div class="min-h-screen bg-gray-50 px-4 py-10 sm:px-6 lg:px-8">
        <div
          class="mx-auto h-32 max-w-3xl animate-pulse rounded-lg bg-gray-100"
        />
      </div>
    </template>
  </ModuleGate>
</template>
