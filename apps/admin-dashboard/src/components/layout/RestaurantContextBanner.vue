<template>
  <div
    v-if="authStore.isAdminRole && authStore.hasRestaurantContext"
    class="bg-amber-500 text-amber-900 px-4 py-2 flex items-center justify-between"
  >
    <div class="flex items-center space-x-2 text-sm font-medium">
      <Store class="w-4 h-4" />
      <span>Currently managing: {{ authStore.selectedRestaurantName }}</span>
    </div>
    <button
      class="flex items-center space-x-1 px-3 py-1 text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors"
      @click="exitRestaurant"
    >
      <X class="w-3 h-3" />
      <span>Exit</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { Store, X } from "lucide-vue-next";

const router = useRouter();
const authStore = useAuthStore();

const exitRestaurant = () => {
  authStore.clearRestaurant();
  router.push("/dashboard/platform");
};
</script>
