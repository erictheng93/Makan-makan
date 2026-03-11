<template>
  <div v-if="authStore.isAdminRole" ref="selectorRef" class="relative">
    <button
      class="flex items-center space-x-2 px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
      @click="toggleDropdown"
    >
      <Store class="w-4 h-4 text-gray-500" />
      <span class="max-w-32 truncate text-gray-700">
        {{ authStore.selectedRestaurantName || "Select Restaurant..." }}
      </span>
      <ChevronDown class="w-3 h-3 text-gray-400" />
    </button>

    <div
      v-if="isOpen"
      class="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 z-50"
    >
      <!-- Search -->
      <div class="p-2 border-b border-gray-100">
        <input
          v-model="searchText"
          type="text"
          placeholder="Search restaurants..."
          class="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500"
          @click.stop
        />
      </div>

      <!-- Restaurant List -->
      <div class="max-h-64 overflow-y-auto py-1">
        <div
          v-if="isLoadingList"
          class="px-4 py-3 text-sm text-gray-500 text-center"
        >
          Loading...
        </div>
        <div
          v-else-if="filteredRestaurants.length === 0"
          class="px-4 py-3 text-sm text-gray-500 text-center"
        >
          No restaurants found
        </div>
        <button
          v-for="restaurant in filteredRestaurants"
          :key="restaurant.id"
          class="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center justify-between"
          :class="{
            'bg-primary-50': authStore.restaurantId === String(restaurant.id),
          }"
          @click="handleSelect(restaurant)"
        >
          <span class="font-medium text-gray-900 truncate">{{
            restaurant.name
          }}</span>
          <span
            class="ml-2 flex-shrink-0 text-xs px-1.5 py-0.5 rounded-full"
            :class="
              restaurant.isActive !== false
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-500'
            "
          >
            {{ restaurant.isActive !== false ? "Active" : "Inactive" }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/services/api";
import { Store, ChevronDown } from "lucide-vue-next";

interface RestaurantItem {
  id: number | string;
  name: string;
  isActive?: boolean;
}

const router = useRouter();
const authStore = useAuthStore();

const isOpen = ref(false);
const searchText = ref("");
const restaurants = ref<RestaurantItem[]>([]);
const isLoadingList = ref(false);
const selectorRef = ref<HTMLElement | null>(null);

const filteredRestaurants = computed(() => {
  if (!searchText.value) return restaurants.value;
  const query = searchText.value.toLowerCase();
  return restaurants.value.filter((r) => r.name.toLowerCase().includes(query));
});

const toggleDropdown = () => {
  isOpen.value = !isOpen.value;
  if (isOpen.value && restaurants.value.length === 0) {
    fetchRestaurants();
  }
};

const fetchRestaurants = async () => {
  isLoadingList.value = true;
  try {
    const response = await api.get<RestaurantItem[]>("/restaurants");
    if (response.data.success && response.data.data) {
      // Handle both direct array and nested {success, data: [...]} response formats
      const payload = response.data.data;
      const list = Array.isArray(payload)
        ? payload
        : ((payload as any)?.data ?? []);
      restaurants.value = Array.isArray(list) ? list : [];
    }
  } catch (error) {
    console.error("Failed to fetch restaurants:", error);
  } finally {
    isLoadingList.value = false;
  }
};

const handleSelect = (restaurant: RestaurantItem) => {
  authStore.selectRestaurant(String(restaurant.id), restaurant.name);
  isOpen.value = false;
  searchText.value = "";
  router.push("/dashboard");
};

const handleClickOutside = (event: Event) => {
  if (selectorRef.value && !selectorRef.value.contains(event.target as Node)) {
    isOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});
</script>
