<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useToast } from "vue-toastification";
import {
  MapIcon,
  PlusIcon,
  ArrowPathIcon,
  TrashIcon,
  MagnifyingGlassIcon,
} from "@heroicons/vue/24/outline";
import { marketsApi } from "@/services/api";
import type {
  CreateMarketRequest,
  Market,
  MarketJoinRequest,
  MarketVendorCandidate,
} from "@/types";

const toast = useToast();
const markets = ref<Market[]>([]);
const joinRequests = ref<MarketJoinRequest[]>([]);
const loading = ref(false);
const loadingJoinRequests = ref(false);
const saving = ref(false);
const reviewingRequestId = ref<number | null>(null);
const selectedMarketId = ref<string | null>(null);
const cityFilter = ref("台中市");
const districtFilter = ref("");
const vendorSearchQuery = ref("");
const vendorCandidates = ref<MarketVendorCandidate[]>([]);
const selectedVendorCandidate = ref<MarketVendorCandidate | null>(null);
const searchingVendors = ref(false);
const vendorStallNumber = ref("");
const vendorIsPrimary = ref(false);
const requestStallNumber = ref<Record<number, string>>({});
const requestIsPrimary = ref<Record<number, boolean>>({});
const tagsText = ref("");
const imageUrlsText = ref("");

const weekdays = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
  { key: "sunday", label: "Sun" },
] as const;

type WeekdayKey = (typeof weekdays)[number]["key"];
type OpeningHoursDraft = Record<
  WeekdayKey,
  { open: string; close: string; closed: boolean }
>;

function defaultOpeningHours(): OpeningHoursDraft {
  return {
    monday: { open: "17:00", close: "23:00", closed: false },
    tuesday: { open: "17:00", close: "23:00", closed: false },
    wednesday: { open: "17:00", close: "23:00", closed: false },
    thursday: { open: "17:00", close: "23:00", closed: false },
    friday: { open: "17:00", close: "23:30", closed: false },
    saturday: { open: "16:00", close: "23:59", closed: false },
    sunday: { open: "16:00", close: "23:00", closed: false },
  };
}

const openingHoursDraft = reactive<OpeningHoursDraft>(defaultOpeningHours());

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
  openingHours: defaultOpeningHours(),
  bannerUrl: "",
  logoUrl: "",
  imageUrls: [],
  tags: [],
  isActive: true,
});

const selectedMarket = computed(
  () =>
    markets.value.find((market) => market.id === selectedMarketId.value) ??
    null,
);

function resetVendorSelection() {
  vendorSearchQuery.value = "";
  vendorCandidates.value = [];
  selectedVendorCandidate.value = null;
  vendorStallNumber.value = "";
  vendorIsPrimary.value = false;
}

function setOpeningHoursDraft(openingHours?: Record<string, unknown> | null) {
  const defaults = defaultOpeningHours();
  for (const day of weekdays) {
    const value = openingHours?.[day.key] as
      | { open?: unknown; close?: unknown; closed?: unknown }
      | undefined;
    openingHoursDraft[day.key] = {
      open:
        typeof value?.open === "string" ? value.open : defaults[day.key].open,
      close:
        typeof value?.close === "string"
          ? value.close
          : defaults[day.key].close,
      closed:
        typeof value?.closed === "boolean"
          ? value.closed
          : defaults[day.key].closed,
    };
  }
}

function parseDelimitedList(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function serializeOpeningHours() {
  return weekdays.reduce<
    Record<string, { open: string; close: string; closed?: boolean }>
  >((hours, day) => {
    const value = openingHoursDraft[day.key];
    hours[day.key] = {
      open: value.open,
      close: value.close,
      ...(value.closed ? { closed: true } : {}),
    };
    return hours;
  }, {});
}

function resetForm() {
  selectedMarketId.value = null;
  resetVendorSelection();
  tagsText.value = "";
  imageUrlsText.value = "";
  setOpeningHoursDraft();
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
    openingHours: defaultOpeningHours(),
    bannerUrl: "",
    logoUrl: "",
    imageUrls: [],
    tags: [],
    isActive: true,
  });
}

function editMarket(market: Market) {
  selectedMarketId.value = market.id;
  resetVendorSelection();
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
    openingHours: market.openingHours ?? null,
    bannerUrl: market.bannerUrl ?? "",
    logoUrl: market.logoUrl ?? "",
    imageUrls: market.imageUrls ?? [],
    tags: market.tags ?? [],
    isActive: market.isActive,
  });
  tagsText.value = (market.tags ?? []).join(", ");
  imageUrlsText.value = (market.imageUrls ?? []).join("\n");
  setOpeningHoursDraft(market.openingHours ?? null);
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

async function loadJoinRequests() {
  loadingJoinRequests.value = true;
  try {
    joinRequests.value = await marketsApi.listJoinRequests({
      status: "pending",
    });
  } finally {
    loadingJoinRequests.value = false;
  }
}

async function loadDashboard() {
  await Promise.all([loadMarkets(), loadJoinRequests()]);
}

function normalizePayload(): CreateMarketRequest {
  return {
    ...form,
    description: form.description || null,
    bannerUrl: form.bannerUrl || null,
    logoUrl: form.logoUrl || null,
    imageUrls: parseDelimitedList(imageUrlsText.value),
    tags: parseDelimitedList(tagsText.value),
    openingHours: serializeOpeningHours(),
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
  if (!selectedMarket.value || !selectedVendorCandidate.value) return;
  await marketsApi.addVendor(selectedMarket.value.id, {
    restaurantId: selectedVendorCandidate.value.id,
    stallNumber: vendorStallNumber.value.trim() || null,
    isPrimary: vendorIsPrimary.value,
  });
  toast.success("Vendor attached");
  selectedVendorCandidate.value = null;
  vendorStallNumber.value = "";
  vendorIsPrimary.value = false;
  await Promise.all([loadMarkets(), searchVendorCandidates()]);
}

async function removeVendor() {
  if (!selectedMarket.value || !selectedVendorCandidate.value) return;
  await marketsApi.removeVendor(
    selectedMarket.value.id,
    selectedVendorCandidate.value.id,
  );
  toast.success("Vendor removed");
  selectedVendorCandidate.value = null;
  await Promise.all([loadMarkets(), searchVendorCandidates()]);
}

async function searchVendorCandidates() {
  if (!selectedMarket.value) return;
  const query = vendorSearchQuery.value.trim();
  if (query.length < 2) {
    vendorCandidates.value = [];
    selectedVendorCandidate.value = null;
    return;
  }

  searchingVendors.value = true;
  try {
    const response = await marketsApi.listVendorCandidates({
      q: query,
      marketId: selectedMarket.value.id,
      limit: 10,
    });
    vendorCandidates.value = response.restaurants;
    if (
      selectedVendorCandidate.value &&
      !response.restaurants.some(
        (restaurant) => restaurant.id === selectedVendorCandidate.value?.id,
      )
    ) {
      selectedVendorCandidate.value = null;
    }
  } finally {
    searchingVendors.value = false;
  }
}

function selectVendorCandidate(candidate: MarketVendorCandidate) {
  selectedVendorCandidate.value = candidate;
}

async function approveJoinRequest(request: MarketJoinRequest) {
  reviewingRequestId.value = request.id;
  try {
    await marketsApi.approveJoinRequest(request.id, {
      stallNumber: requestStallNumber.value[request.id]?.trim() || null,
      isPrimary: requestIsPrimary.value[request.id] ?? false,
    });
    toast.success("Join request approved");
    delete requestStallNumber.value[request.id];
    delete requestIsPrimary.value[request.id];
    await loadDashboard();
  } finally {
    reviewingRequestId.value = null;
  }
}

async function rejectJoinRequest(request: MarketJoinRequest) {
  reviewingRequestId.value = request.id;
  try {
    await marketsApi.rejectJoinRequest(request.id);
    toast.success("Join request rejected");
    delete requestStallNumber.value[request.id];
    delete requestIsPrimary.value[request.id];
    await loadJoinRequests();
  } finally {
    reviewingRequestId.value = null;
  }
}

onMounted(loadDashboard);
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

        <section class="card space-y-4">
          <div
            class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <h2 class="text-lg font-semibold text-gray-900">Join requests</h2>
              <p class="mt-1 text-sm text-gray-500">
                Review restaurants asking to join a market or district.
              </p>
            </div>
            <button
              type="button"
              class="btn btn-secondary"
              :disabled="loadingJoinRequests"
              @click="loadJoinRequests"
            >
              <ArrowPathIcon class="mr-2 h-5 w-5" />
              Refresh
            </button>
          </div>

          <div
            v-if="loadingJoinRequests"
            class="py-8 text-center text-sm text-gray-500"
          >
            Loading requests...
          </div>
          <div
            v-else-if="joinRequests.length === 0"
            class="py-8 text-center text-sm text-gray-500"
          >
            No pending join requests.
          </div>
          <div v-else class="divide-y divide-gray-200">
            <article
              v-for="request in joinRequests"
              :key="request.id"
              class="space-y-3 py-4 first:pt-0 last:pb-0"
            >
              <div
                class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
              >
                <div>
                  <h3 class="font-medium text-gray-900">
                    {{ request.restaurant.name }}
                  </h3>
                  <p class="text-sm text-gray-500">
                    {{ request.market.name }} · {{ request.market.city }}
                    {{ request.market.district }}
                  </p>
                </div>
                <span
                  class="inline-flex w-fit rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700"
                >
                  {{ request.status }}
                </span>
              </div>

              <p
                v-if="request.message"
                class="rounded-md bg-gray-50 p-3 text-sm text-gray-600"
              >
                {{ request.message }}
              </p>

              <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                <input
                  v-model="requestStallNumber[request.id]"
                  class="input"
                  placeholder="Stall number"
                  :disabled="reviewingRequestId === request.id"
                />
                <label
                  class="flex min-h-10 items-center gap-2 text-sm text-gray-700"
                >
                  <input
                    v-model="requestIsPrimary[request.id]"
                    type="checkbox"
                    class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    :disabled="reviewingRequestId === request.id"
                  />
                  Primary
                </label>
              </div>

              <div class="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  class="btn btn-primary"
                  :disabled="reviewingRequestId === request.id"
                  @click="approveJoinRequest(request)"
                >
                  {{
                    reviewingRequestId === request.id
                      ? "Reviewing..."
                      : "Approve"
                  }}
                </button>
                <button
                  type="button"
                  class="btn btn-secondary text-red-600 hover:text-red-700"
                  :disabled="reviewingRequestId === request.id"
                  @click="rejectJoinRequest(request)"
                >
                  Reject
                </button>
              </div>
            </article>
          </div>
        </section>
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
          <input v-model="form.logoUrl" class="input" placeholder="Logo URL" />
          <textarea
            v-model="imageUrlsText"
            class="input min-h-24"
            placeholder="Gallery image URLs, one per line"
          />
          <input
            v-model="tagsText"
            class="input"
            placeholder="Tags, separated by commas"
          />

          <fieldset class="space-y-3">
            <legend class="text-sm font-medium text-gray-900">
              Opening hours
            </legend>
            <div class="space-y-2">
              <div
                v-for="day in weekdays"
                :key="day.key"
                class="grid items-center gap-2 sm:grid-cols-[44px_1fr_1fr_auto]"
              >
                <span class="text-sm font-medium text-gray-700">
                  {{ day.label }}
                </span>
                <input
                  v-model="openingHoursDraft[day.key].open"
                  type="time"
                  class="input"
                  :disabled="openingHoursDraft[day.key].closed"
                  :aria-label="`${day.label} open time`"
                />
                <input
                  v-model="openingHoursDraft[day.key].close"
                  type="time"
                  class="input"
                  :disabled="openingHoursDraft[day.key].closed"
                  :aria-label="`${day.label} close time`"
                />
                <label class="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    v-model="openingHoursDraft[day.key].closed"
                    type="checkbox"
                    class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  Closed
                </label>
              </div>
            </div>
          </fieldset>

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
              Select a market above, then search and attach a restaurant.
            </p>
          </div>

          <div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <input
              v-model="vendorSearchQuery"
              class="input"
              placeholder="Search restaurant name or area"
              :disabled="!selectedMarket"
              @keyup.enter="searchVendorCandidates"
            />
            <button
              type="button"
              class="btn btn-secondary"
              :disabled="!selectedMarket || searchingVendors"
              @click="searchVendorCandidates"
            >
              <MagnifyingGlassIcon class="mr-2 h-5 w-5" />
              Search
            </button>
          </div>

          <div
            v-if="searchingVendors"
            class="py-4 text-center text-sm text-gray-500"
          >
            Searching restaurants...
          </div>
          <div
            v-else-if="
              vendorSearchQuery.trim().length >= 2 &&
              vendorCandidates.length === 0
            "
            class="py-4 text-center text-sm text-gray-500"
          >
            No matching restaurants available for this market.
          </div>
          <div v-else class="divide-y divide-gray-200 rounded-md border">
            <button
              v-for="candidate in vendorCandidates"
              :key="candidate.id"
              type="button"
              class="block w-full px-3 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
              :class="{
                'bg-primary-50': selectedVendorCandidate?.id === candidate.id,
              }"
              @click="selectVendorCandidate(candidate)"
            >
              <span class="block font-medium text-gray-900">
                {{ candidate.name }}
              </span>
              <span class="mt-1 block text-sm text-gray-500">
                {{ candidate.city }} {{ candidate.district }} ·
                {{ candidate.address }}
              </span>
            </button>
          </div>

          <div
            v-if="selectedVendorCandidate"
            class="rounded-md bg-gray-50 p-3 text-sm text-gray-600"
          >
            Selected:
            <span class="font-medium text-gray-900">
              {{ selectedVendorCandidate.name }}
            </span>
            <span class="mt-1 block text-xs text-gray-500">
              {{ selectedVendorCandidate.id }}
            </span>
          </div>

          <input
            v-model="vendorStallNumber"
            class="input"
            placeholder="Stall number"
            :disabled="!selectedMarket || !selectedVendorCandidate"
          />
          <label class="flex items-center gap-2 text-sm text-gray-700">
            <input
              v-model="vendorIsPrimary"
              type="checkbox"
              class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              :disabled="!selectedMarket || !selectedVendorCandidate"
            />
            Primary market for this restaurant
          </label>
          <div class="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              class="btn btn-secondary"
              :disabled="!selectedMarket || !selectedVendorCandidate"
              @click="addVendor"
            >
              Attach
            </button>
            <button
              type="button"
              class="btn btn-secondary"
              :disabled="!selectedMarket || !selectedVendorCandidate"
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
