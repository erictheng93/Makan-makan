<script setup lang="ts">
import { computed } from "vue";
import { RouterView, useRoute } from "vue-router";
import AppLayout from "@/layouts/AppLayout.vue";

const route = useRoute();
const usesAppLayout = computed(() => route.name !== "Login");
</script>

<template>
  <AppLayout v-if="usesAppLayout">
    <RouterView />
  </AppLayout>
  <RouterView v-else />
</template>
