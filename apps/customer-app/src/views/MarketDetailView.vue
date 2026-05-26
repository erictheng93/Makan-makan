<template>
  <div class="min-h-screen bg-ios-bg">
    <nav class="sticky top-0 z-10 border-b border-gray-100 bg-white shadow-sm">
      <div class="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
        <button
          type="button"
          class="text-gray-500 hover:text-gray-700"
          aria-label="返回"
          @click="$router.back()"
        >
          <svg
            class="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <h1 class="truncate text-lg font-semibold text-gray-900">
          {{ store.selectedMarket?.name || "市場" }}
        </h1>
      </div>
    </nav>

    <main class="mx-auto max-w-md">
      <div v-if="store.loading" class="py-12 text-center text-sm text-gray-500">
        載入中...
      </div>
      <div
        v-else-if="store.error"
        class="py-8 text-center text-sm text-red-500"
      >
        {{ store.error }}
      </div>
      <template v-else-if="store.selectedMarket">
        <MarketDetailHero
          :market="store.selectedMarket"
          :vendor-count="store.vendorCount"
        />
        <section class="space-y-4 px-4 py-4">
          <VendorListInMarket
            :vendors="store.vendors"
            :loading="store.vendorsLoading"
            :query="vendorQuery"
            :takeaway-only="takeawayOnly"
            @update:query="onQueryChange"
            @update:takeaway-only="onTakeawayOnlyChange"
            @select-vendor="openVendor"
            @takeaway="startTakeaway"
            @contact-vendor="openContactProfile"
          />

          <MarketProductSearch
            :market-id="store.selectedMarket.id"
            @select="openDishVendor"
            @takeaway="startDishTakeaway"
          />

          <section
            v-if="selectedContactVendor"
            class="rounded-xl border border-gray-200 bg-white p-4"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <h2 class="text-base font-semibold text-gray-900">
                  {{ selectedContactVendor.name }}
                </h2>
                <p class="text-sm text-gray-500">常見問題與聯絡方式</p>
              </div>
              <button
                type="button"
                class="text-sm font-medium text-gray-500"
                @click="closeContactProfile"
              >
                關閉
              </button>
            </div>

            <div v-if="contactLoading" class="mt-4 text-sm text-gray-500">
              載入聯絡資訊中...
            </div>
            <template v-else>
              <div v-if="contactProfile?.faqs.length" class="mt-4 space-y-2">
                <input
                  v-model="faqQuery"
                  type="search"
                  class="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ios-blue focus:outline-none focus:ring-2 focus:ring-ios-blue/20"
                  placeholder="搜尋常見問題"
                />
                <details
                  v-for="faq in filteredFaqs"
                  :key="faq.id"
                  class="rounded-lg border border-gray-200 px-3 py-2"
                >
                  <summary class="cursor-pointer text-sm font-medium">
                    {{ faq.question }}
                  </summary>
                  <p class="mt-2 text-sm leading-6 text-gray-600">
                    {{ faq.answer }}
                  </p>
                </details>
                <p
                  v-if="filteredFaqs.length === 0"
                  class="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-500"
                >
                  沒有符合的常見問題。
                </p>
              </div>
              <div
                v-else
                class="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-500"
              >
                尚未提供常見問題。
              </div>

              <div class="mt-4 grid grid-cols-2 gap-2">
                <a
                  v-for="channel in availableContactChannels"
                  :key="channel.key"
                  :href="channel.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="rounded-lg bg-ios-blue px-3 py-2 text-center text-sm font-medium text-white"
                >
                  {{ channel.label }}
                </a>
              </div>
              <p
                v-if="availableContactChannels.length === 0"
                class="mt-3 text-sm text-gray-500"
              >
                店家尚未設定公開聯絡方式。
              </p>
            </template>
          </section>
        </section>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import MarketDetailHero from "@/components/markets/MarketDetailHero.vue";
import MarketProductSearch from "@/components/markets/MarketProductSearch.vue";
import VendorListInMarket from "@/components/markets/VendorListInMarket.vue";
import { useMarketsStore } from "@/stores/markets";
import { discoveryApi } from "@/services/discoveryApi";
import type { DishSearchResult } from "@/services/discoveryApi";
import type { MarketVendor } from "@/services/marketsApi";
import {
  restaurantContactApi,
  type RestaurantContactProfile,
} from "@/services/restaurantContactApi";
import { applyMarketSeoMeta } from "@/utils/seoMeta";

const route = useRoute();
const router = useRouter();
const store = useMarketsStore();
const vendorQuery = ref("");
const takeawayOnly = ref(false);
const selectedContactVendor = ref<MarketVendor | null>(null);
const contactProfile = ref<RestaurantContactProfile | null>(null);
const contactLoading = ref(false);
const faqQuery = ref("");
let queryTimer: ReturnType<typeof setTimeout> | undefined;

const slug = () => String(route.params.slug);

function loadVendors() {
  store.loadVendors(slug(), {
    q: vendorQuery.value || undefined,
    takeaway: takeawayOnly.value || undefined,
  });
}

function onQueryChange(value: string) {
  vendorQuery.value = value;
  if (queryTimer) clearTimeout(queryTimer);
  queryTimer = setTimeout(loadVendors, 250);
}

function onTakeawayOnlyChange(value: boolean) {
  takeawayOnly.value = value;
  loadVendors();
}

function openVendor(vendor: MarketVendor) {
  router.push({
    name: "ShopMenu",
    params: { restaurantId: vendor.restaurantId },
  });
}

async function startTakeaway(vendor: MarketVendor) {
  await startTakeawayForRestaurant(vendor.restaurantId);
}

async function startDishTakeaway(dish: DishSearchResult) {
  await startTakeawayForRestaurant(dish.restaurantId);
}

async function startTakeawayForRestaurant(restaurantId: string) {
  const result = await discoveryApi.getTakeawayEligibility(restaurantId);
  if (!result.eligible) {
    store.error = "目前無法從 Discovery 直接外帶。";
    return;
  }
  router.push({
    name: "OrderTypeLanding",
    params: { restaurantId },
    query: { qr: result.shopQrCode },
  });
}

function openDishVendor(dish: DishSearchResult) {
  router.push({
    name: "ShopMenu",
    params: { restaurantId: dish.restaurantId },
  });
}

async function openContactProfile(vendor: MarketVendor) {
  selectedContactVendor.value = vendor;
  contactProfile.value = null;
  faqQuery.value = "";
  contactLoading.value = true;
  try {
    contactProfile.value = await restaurantContactApi.getContactProfile(
      vendor.restaurantId,
    );
  } catch (error) {
    console.error("Failed to load contact profile:", error);
    store.error = "無法載入店家聯絡資訊。";
  } finally {
    contactLoading.value = false;
  }
}

function closeContactProfile() {
  selectedContactVendor.value = null;
  contactProfile.value = null;
  faqQuery.value = "";
}

const contactChannelLabels: Record<string, string> = {
  line: "LINE",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  telegram: "Telegram",
};

const availableContactChannels = computed(() => {
  const channels = contactProfile.value?.messagingChannels ?? {};
  return Object.entries(channels)
    .filter(([, url]) => typeof url === "string" && url.length > 0)
    .map(([key, url]) => ({
      key,
      label: contactChannelLabels[key] ?? key,
      url,
    }));
});

const filteredFaqs = computed(() => {
  const query = faqQuery.value.trim().toLowerCase();
  const faqs = contactProfile.value?.faqs ?? [];
  if (!query) return faqs;

  return faqs.filter((faq) => {
    const haystack = [faq.question, faq.answer, ...faq.keywords]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
});

onMounted(async () => {
  await store.loadMarketDetail(slug());
  if (store.selectedMarket) {
    applyMarketSeoMeta({
      market: store.selectedMarket,
      vendorCount: store.vendorCount,
      path: route.fullPath,
    });
  }
  await store.loadVendors(slug());
});

onBeforeUnmount(() => {
  if (queryTimer) clearTimeout(queryTimer);
  closeContactProfile();
  store.resetSelectedMarket();
});
</script>
