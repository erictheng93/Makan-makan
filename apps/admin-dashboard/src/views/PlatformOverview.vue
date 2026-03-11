<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Platform Overview</h1>
      <p class="mt-1 text-sm text-gray-500">
        Manage all restaurants from a single dashboard. Select a restaurant to
        access its full management interface.
      </p>
    </div>

    <!-- Stats Row -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <div class="text-sm font-medium text-gray-500">Total Restaurants</div>
        <div class="mt-1 text-2xl font-bold text-gray-900">
          {{ restaurants.length }}
        </div>
      </div>
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <div class="text-sm font-medium text-gray-500">Active</div>
        <div class="mt-1 text-2xl font-bold text-green-600">
          {{ activeCount }}
        </div>
      </div>
      <div class="bg-white rounded-lg border border-gray-200 p-4">
        <div class="text-sm font-medium text-gray-500">Inactive</div>
        <div class="mt-1 text-2xl font-bold text-gray-400">
          {{ restaurants.length - activeCount }}
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div
      v-if="isLoading"
      class="flex items-center justify-center py-12 text-gray-500"
    >
      <div
        class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"
      />
    </div>

    <!-- Empty State -->
    <div
      v-else-if="restaurants.length === 0"
      class="text-center py-12 bg-white rounded-lg border border-gray-200"
    >
      <Store class="mx-auto h-12 w-12 text-gray-400" />
      <h3 class="mt-2 text-sm font-medium text-gray-900">No restaurants</h3>
      <p class="mt-1 text-sm text-gray-500">
        No restaurants found in the system.
      </p>
    </div>

    <!-- Restaurant Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="restaurant in restaurants"
        :key="restaurant.id"
        class="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow"
      >
        <div class="flex items-start justify-between">
          <div class="min-w-0 flex-1">
            <h3 class="text-lg font-semibold text-gray-900 truncate">
              {{ restaurant.name }}
            </h3>
            <p
              v-if="restaurant.address"
              class="mt-1 text-sm text-gray-500 truncate"
            >
              {{ restaurant.address }}
            </p>
          </div>
          <span
            class="ml-3 flex-shrink-0 text-xs px-2 py-1 rounded-full font-medium"
            :class="
              restaurant.isActive !== false
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-500'
            "
          >
            {{ restaurant.isActive !== false ? "Active" : "Inactive" }}
          </span>
        </div>

        <button
          class="mt-4 w-full px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
          @click="manageRestaurant(restaurant)"
        >
          Manage
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/services/api";
import { Store } from "lucide-vue-next";

interface RestaurantItem {
  id: number | string;
  name: string;
  address?: string;
  isActive?: boolean;
}

const router = useRouter();
const authStore = useAuthStore();

const restaurants = ref<RestaurantItem[]>([]);
const isLoading = ref(true);

const activeCount = computed(
  () => restaurants.value.filter((r) => r.isActive !== false).length,
);

const fetchRestaurants = async () => {
  isLoading.value = true;
  try {
    const response = await api.get<RestaurantItem[]>("/restaurants");
    if (response.data.success && response.data.data) {
      restaurants.value = Array.isArray(response.data.data)
        ? response.data.data
        : [];
    }
  } catch (error) {
    console.error("Failed to fetch restaurants:", error);
  } finally {
    isLoading.value = false;
  }
};

const manageRestaurant = (restaurant: RestaurantItem) => {
  authStore.selectRestaurant(String(restaurant.id), restaurant.name);
  router.push("/dashboard");
};

onMounted(() => {
  fetchRestaurants();
});
</script>
