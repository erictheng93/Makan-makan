<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useToast } from "vue-toastification";
import {
  MapIcon,
  PlusIcon,
  ArrowPathIcon,
  TrashIcon,
} from "@heroicons/vue/24/outline";
import { marketsApi } from "@/services/api";
import type { CreateMarketRequest, Market } from "@/types";

const toast = useToast();
const markets = ref<Market[]>([]);
const loading = ref(false);
const saving = ref(false);
const selectedMarketId = ref<string | null>(null);
const cityFilter = ref("台中市");
const districtFilter = ref("");
const vendorRestaurantId = ref("");
const vendorStallNumber = ref("");
const vendorIsPrimary = ref(false);

const form = reactive<CreateMarketRequest>({
  slug: "",
  name: "",
  type: "night_market",
  description: "",
  city: "台中市",
  district: "",
  address: "",
  latitude: 24.1477,
  longitude: 120.6736,
  bannerUrl: "",
  logoUrl: "",
  tags: [],
  isActive: true,
});

const selectedMarket = computed(
  () =>
    markets.value.find((market) => market.id === selectedMarketId.value) ??
    null,
);

function resetForm() {
  selectedMarketId.value = null;
  Object.assign(form, {
    slug: "",
    name: "",
    type: "night_market",
    description: "",
    city: "台中市",
    district: "",
    address: "",
    latitude: 24.1477,
    longitude: 120.6736,
    bannerUrl: "",
    logoUrl: "",
    tags: [],
    isActive: true,
  });
}

function editMarket(market: Market) {
  selectedMarketId.value = market.id;
  Object.assign(form, {
    slug: market.slug,
    name: market.name,
    type: market.type,
    description: market.description ?? "",
    city: market.city,
    district: market.district,
    address: market.address,
    latitude: market.latitude,
    longitude: market.longitude,
    bannerUrl: market.bannerUrl ?? "",
    logoUrl: market.logoUrl ?? "",
    tags: market.tags ?? [],
    isActive: market.isActive,
  });
}

async function loadMarkets() {
  loading.value = true;
  try {
    const response = await marketsApi.list({
      city: cityFilter.value || undefined,
      district: districtFilter.value || undefined,
      limit: 50,
    });
    markets.value = response.markets;
  } finally {
    loading.value = false;
  }
}

function normalizePayload(): CreateMarketRequest {
  return {
    ...form,
    description: form.description || null,
    bannerUrl: form.bannerUrl || null,
    logoUrl: form.logoUrl || null,
    tags: Array.isArray(form.tags) ? form.tags.filter(Boolean) : [],
    latitude: Number(form.latitude),
    longitude: Number(form.longitude),
  };
}

async function saveMarket() {
  saving.value = true;
  try {
    if (selectedMarketId.value) {
      await marketsApi.update(selectedMarketId.value, normalizePayload());
      toast.success("Market updated");
    } else {
      await marketsApi.create(normalizePayload());
      toast.success("Market created");
    }
    resetForm();
    await loadMarkets();
  } finally {
    saving.value = false;
  }
}

async function deleteMarket(market: Market) {
  if (!confirm(`Delete ${market.name}?`)) return;
  await marketsApi.delete(market.id);
  toast.success("Market deleted");
  if (selectedMarketId.value === market.id) resetForm();
  await loadMarkets();
}

async function addVendor() {
  if (!selectedMarket.value || !vendorRestaurantId.value.trim()) return;
  await marketsApi.addVendor(selectedMarket.value.id, {
    restaurantId: vendorRestaurantId.value.trim(),
    stallNumber: vendorStallNumber.value.trim() || null,
    isPrimary: vendorIsPrimary.value,
  });
  toast.success("Vendor attached");
  vendorRestaurantId.value = "";
  vendorStallNumber.value = "";
  vendorIsPrimary.value = false;
  await loadMarkets();
}

async function removeVendor() {
  if (!selectedMarket.value || !vendorRestaurantId.value.trim()) return;
  await marketsApi.removeVendor(
    selectedMarket.value.id,
    vendorRestaurantId.value.trim(),
  );
  toast.success("Vendor removed");
  vendorRestaurantId.value = "";
  await loadMarkets();
}

onMounted(loadMarkets);
</script>

<template>
  <div class="space-y-6">
    <div
      class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Markets</h1>
        <p class="mt-1 text-sm text-gray-500">
          Curate night markets and commercial districts for customer discovery.
        </p>
      </div>
      <button type="button" class="btn btn-secondary" @click="resetForm">
        <PlusIcon class="mr-2 h-5 w-5" />
        New market
      </button>
    </div>

    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
      <section class="space-y-4">
        <div class="card">
          <div class="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <input
              v-model="cityFilter"
              class="input"
              placeholder="City"
              @keyup.enter="loadMarkets"
            />
            <input
              v-model="districtFilter"
              class="input"
              placeholder="District"
              @keyup.enter="loadMarkets"
            />
            <button
              type="button"
              class="btn btn-secondary"
              @click="loadMarkets"
            >
              <ArrowPathIcon class="mr-2 h-5 w-5" />
              Refresh
            </button>
          </div>
        </div>

        <div class="card overflow-hidden p-0">
          <div v-if="loading" class="py-12 text-center text-sm text-gray-500">
            Loading markets...
          </div>
          <div
            v-else-if="markets.length === 0"
            class="py-12 text-center text-sm text-gray-500"
          >
            <MapIcon class="mx-auto mb-3 h-10 w-10 text-gray-400" />
            No markets match the current filters.
          </div>
          <table v-else class="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Area</th>
                <th>Type</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white">
              <tr v-for="market in markets" :key="market.id">
                <td>
                  <div class="font-medium text-gray-900">{{ market.name }}</div>
                  <div class="text-xs text-gray-500">/{{ market.slug }}</div>
                </td>
                <td>{{ market.city }} · {{ market.district }}</td>
                <td>{{ market.type }}</td>
                <td class="space-x-3 text-right">
                  <button
                    type="button"
                    class="font-medium text-primary-600 hover:text-primary-700"
                    @click="editMarket(market)"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="font-medium text-red-600 hover:text-red-700"
                    @click="deleteMarket(market)"
                  >
                    <TrashIcon class="inline h-4 w-4" />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <aside class="space-y-4">
        <form class="card space-y-4" @submit.prevent="saveMarket">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">
              {{ selectedMarketId ? "Edit market" : "Create market" }}
            </h2>
            <p class="mt-1 text-sm text-gray-500">
              Market metadata is public in customer discovery.
            </p>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <input
              v-model="form.name"
              required
              class="input"
              placeholder="Name"
            />
            <input
              v-model="form.slug"
              required
              class="input"
              placeholder="slug"
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
            />
            <select v-model="form.type" class="input">
              <option value="night_market">Night market</option>
              <option value="commercial_district">Commercial district</option>
              <option value="food_court">Food court</option>
              <option value="event_venue">Event venue</option>
            </select>
            <input
              v-model="form.city"
              required
              class="input"
              placeholder="City"
            />
            <input
              v-model="form.district"
              required
              class="input"
              placeholder="District"
            />
            <input
              v-model.number="form.latitude"
              required
              type="number"
              step="0.000001"
              class="input"
              placeholder="Latitude"
            />
            <input
              v-model.number="form.longitude"
              required
              type="number"
              step="0.000001"
              class="input"
              placeholder="Longitude"
            />
          </div>
          <input
            v-model="form.address"
            required
            class="input"
            placeholder="Address"
          />
          <input
            v-model="form.bannerUrl"
            class="input"
            placeholder="Banner URL"
          />
          <textarea
            v-model="form.description"
            class="input min-h-24"
            placeholder="Description"
          />
          <button
            type="submit"
            class="btn btn-primary w-full"
            :disabled="saving"
          >
            {{ saving ? "Saving..." : "Save market" }}
          </button>
        </form>

        <section class="card space-y-4">
          <div>
            <h2 class="text-lg font-semibold text-gray-900">
              Vendor membership
            </h2>
            <p class="mt-1 text-sm text-gray-500">
              Select a market above, then attach or remove a restaurant by ID.
            </p>
          </div>
          <input
            v-model="vendorRestaurantId"
            class="input"
            placeholder="Restaurant ID"
            :disabled="!selectedMarket"
          />
          <input
            v-model="vendorStallNumber"
            class="input"
            placeholder="Stall number"
            :disabled="!selectedMarket"
          />
          <label class="flex items-center gap-2 text-sm text-gray-700">
            <input
              v-model="vendorIsPrimary"
              type="checkbox"
              class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              :disabled="!selectedMarket"
            />
            Primary market for this restaurant
          </label>
          <div class="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              class="btn btn-secondary"
              :disabled="!selectedMarket"
              @click="addVendor"
            >
              Attach
            </button>
            <button
              type="button"
              class="btn btn-secondary"
              :disabled="!selectedMarket"
              @click="removeVendor"
            >
              Remove
            </button>
          </div>
        </section>
      </aside>
    </div>
  </div>
</template>
