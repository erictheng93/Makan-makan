<template>
  <div class="space-y-6">
    <div
      class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"
    >
      <div>
        <h1 class="text-2xl font-bold text-gray-900">市場 / 商圈公開品質</h1>
        <p class="mt-1 text-sm text-gray-500">
          集中檢查夜市、商圈與活動場域的公開頁資料是否足以上架。
        </p>
      </div>
      <button
        type="button"
        class="w-fit rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
        :disabled="isLoading"
        @click="loadMarkets"
      >
        重新整理
      </button>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-7">
      <div
        v-for="metric in metrics"
        :key="metric.label"
        class="rounded-lg bg-white p-4 shadow-ios-card"
      >
        <div class="text-sm font-medium text-gray-500">{{ metric.label }}</div>
        <div class="mt-1 text-2xl font-bold" :class="metric.class">
          {{ metric.value }}
        </div>
      </div>
    </div>

    <div class="rounded-lg bg-white p-4 shadow-ios-card">
      <div class="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
        <input
          v-model="query"
          type="search"
          class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          placeholder="搜尋市場、slug、城市或區域"
        />
        <div class="flex flex-wrap gap-2">
          <button
            v-for="option in filterOptions"
            :key="option.value"
            type="button"
            class="rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            :class="
              readinessFilter === option.value
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            "
            @click="readinessFilter = option.value"
          >
            {{ option.label }}
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="isLoading"
      class="flex items-center justify-center rounded-lg bg-white py-12 text-gray-500 shadow-ios-card"
    >
      <div
        class="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-600"
      />
    </div>

    <div
      v-else-if="filteredMarkets.length === 0"
      class="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500"
    >
      沒有符合條件的市場或商圈。
    </div>

    <div v-else class="overflow-hidden rounded-lg bg-white shadow-ios-card">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th
              class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
            >
              市場 / 商圈
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
            >
              區域
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
            >
              店鋪
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
            >
              商品 / 服務
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
            >
              公開頁狀態
            </th>
            <th
              class="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
            >
              缺項
            </th>
            <th
              class="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500"
            >
              操作
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 bg-white">
          <tr v-for="market in filteredMarkets" :key="market.id">
            <td class="px-4 py-4">
              <div class="font-medium text-gray-900">{{ market.name }}</div>
              <div class="text-xs text-gray-500">/{{ market.slug }}</div>
            </td>
            <td class="px-4 py-4 text-sm text-gray-700">
              {{ market.city }} · {{ market.district }}
            </td>
            <td class="px-4 py-4 text-sm text-gray-700">
              {{ market.vendorCount ?? 0 }}
            </td>
            <td class="px-4 py-4 text-sm text-gray-700">
              <div class="whitespace-nowrap">
                商品 {{ market.catalogCoverage?.searchableProductCount ?? 0 }}
              </div>
              <div class="mt-1 whitespace-nowrap text-xs text-gray-500">
                服務 {{ market.catalogCoverage?.publicServiceCount ?? 0 }}
              </div>
              <div
                v-if="
                  market.catalogCoverage?.vendorsMissingSearchableProducts ||
                  market.catalogCoverage?.vendorsMissingPublicServices
                "
                class="mt-2 space-y-1 text-xs text-amber-700"
              >
                <div>
                  缺商品店鋪
                  {{
                    market.catalogCoverage?.vendorsMissingSearchableProducts ??
                    0
                  }}
                </div>
                <div>
                  缺服務店鋪
                  {{
                    market.catalogCoverage?.vendorsMissingPublicServices ?? 0
                  }}
                </div>
              </div>
            </td>
            <td class="px-4 py-4">
              <span
                class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium"
                :class="readinessBadgeClass(market)"
              >
                {{ marketPublicReadinessSummary(market.publicReadiness).text }}
              </span>
            </td>
            <td class="px-4 py-4">
              <div
                v-if="market.publicReadiness?.issues.length"
                class="flex max-w-md flex-wrap gap-2"
              >
                <span
                  v-for="issue in market.publicReadiness.issues"
                  :key="issue.key"
                  class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                >
                  {{ publicReadinessIssueLabel(issue.key) }}
                </span>
              </div>
              <div
                v-if="
                  market.catalogCoverage?.missingProductVendors?.length ||
                  market.catalogCoverage?.missingServiceVendors?.length
                "
                class="mt-3 max-w-md space-y-2 text-xs text-gray-600"
              >
                <div
                  v-if="market.catalogCoverage?.missingProductVendors?.length"
                >
                  <span class="font-medium text-gray-700">缺商品：</span>
                  {{
                    vendorGapNames(market.catalogCoverage.missingProductVendors)
                  }}
                  <div class="mt-1 flex flex-wrap gap-1.5">
                    <button
                      v-for="vendor in market.catalogCoverage
                        .missingProductVendors"
                      :key="`product-${vendor.restaurantId}`"
                      type="button"
                      class="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200"
                      :data-testid="`manage-products-${vendor.restaurantId}`"
                      @click="manageVendorGap(vendor, 'products')"
                    >
                      補商品
                    </button>
                  </div>
                </div>
                <div
                  v-if="market.catalogCoverage?.missingServiceVendors?.length"
                >
                  <span class="font-medium text-gray-700">缺服務：</span>
                  {{
                    vendorGapNames(market.catalogCoverage.missingServiceVendors)
                  }}
                  <div class="mt-1 flex flex-wrap gap-1.5">
                    <button
                      v-for="vendor in market.catalogCoverage
                        .missingServiceVendors"
                      :key="`service-${vendor.restaurantId}`"
                      type="button"
                      class="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200"
                      :data-testid="`manage-services-${vendor.restaurantId}`"
                      @click="manageVendorGap(vendor, 'services')"
                    >
                      補服務
                    </button>
                  </div>
                </div>
              </div>
              <span
                v-if="
                  !market.publicReadiness?.issues.length &&
                  !market.catalogCoverage?.missingProductVendors?.length &&
                  !market.catalogCoverage?.missingServiceVendors?.length
                "
                class="text-sm text-gray-400"
              >
                -
              </span>
            </td>
            <td class="px-4 py-4 text-right">
              <button
                type="button"
                class="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                @click="startEditing(market)"
              >
                編輯
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-if="editingMarket"
      class="rounded-lg border border-gray-200 bg-white p-5 shadow-ios-card"
    >
      <div
        class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
      >
        <div>
          <h2 class="text-lg font-semibold text-gray-900">
            編輯公開資料：{{ editingMarket.name }}
          </h2>
          <p class="mt-1 text-sm text-gray-500">
            這些欄位會影響市場公開頁、SEO 與可上架完整度。
          </p>
        </div>
        <button
          type="button"
          class="text-sm font-medium text-gray-500 hover:text-gray-700"
          @click="cancelEditing"
        >
          關閉
        </button>
      </div>

      <div class="mt-5 grid gap-4 lg:grid-cols-2">
        <label class="block">
          <span class="text-sm font-medium text-gray-700">描述</span>
          <textarea
            v-model="editForm.description"
            rows="4"
            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          />
        </label>
        <label class="block">
          <span class="text-sm font-medium text-gray-700">地址</span>
          <input
            v-model="editForm.address"
            type="text"
            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          />
        </label>
        <label class="block">
          <span class="text-sm font-medium text-gray-700">緯度</span>
          <input
            v-model="editForm.latitude"
            type="text"
            inputmode="decimal"
            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          />
        </label>
        <label class="block">
          <span class="text-sm font-medium text-gray-700">經度</span>
          <input
            v-model="editForm.longitude"
            type="text"
            inputmode="decimal"
            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          />
        </label>
        <label class="block">
          <span class="text-sm font-medium text-gray-700">主圖 URL</span>
          <input
            v-model="editForm.bannerUrl"
            type="url"
            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          />
        </label>
        <label class="block">
          <span class="text-sm font-medium text-gray-700">Logo URL</span>
          <input
            v-model="editForm.logoUrl"
            type="url"
            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          />
        </label>
        <label class="block lg:col-span-2">
          <span class="text-sm font-medium text-gray-700">圖庫 URL</span>
          <textarea
            v-model="editForm.imageUrlsText"
            rows="3"
            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
            placeholder="每行一個 URL"
          />
        </label>
        <label class="block lg:col-span-2">
          <span class="text-sm font-medium text-gray-700">標籤</span>
          <input
            v-model="editForm.tagsText"
            type="text"
            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
            placeholder="夜市, 小吃, 親子"
          />
        </label>
        <label class="block lg:col-span-2">
          <span class="text-sm font-medium text-gray-700">營業時間 JSON</span>
          <textarea
            v-model="editForm.openingHoursText"
            rows="7"
            class="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
            placeholder='{"friday":{"open":"17:00","close":"23:30"}}'
          />
        </label>
      </div>

      <p v-if="formError" class="mt-4 text-sm text-red-600">
        {{ formError }}
      </p>

      <div class="mt-5 flex justify-end gap-3">
        <button
          type="button"
          class="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          @click="cancelEditing"
        >
          取消
        </button>
        <button
          type="button"
          class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          :disabled="isSaving"
          @click="saveMarketProfile"
        >
          {{ isSaving ? "儲存中..." : "儲存公開資料" }}
        </button>
      </div>

      <section class="mt-6 border-t border-gray-200 pt-5">
        <div
          class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
        >
          <div>
            <h3 class="text-base font-semibold text-gray-900">批次匯入店鋪</h3>
            <p class="mt-1 text-sm text-gray-500">
              貼上店鋪 JSON 陣列；既有店鋪填 restaurantId，新店鋪至少填
              name、address、district。
            </p>
          </div>
          <button
            type="button"
            class="w-fit rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            @click="loadVendorImportExample"
          >
            載入範例
          </button>
        </div>

        <textarea
          v-model="vendorImportText"
          rows="8"
          data-testid="vendor-import-json"
          class="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          placeholder='[{"restaurantId":"restaurant-1","stallNumber":"A-01"},{"name":"新店鋪","address":"台中市西屯區文華路","district":"西屯區","stallNumber":"B-02"}]'
        />

        <p v-if="vendorImportError" class="mt-3 text-sm text-red-600">
          {{ vendorImportError }}
        </p>
        <div
          v-if="vendorImportResult"
          class="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800"
        >
          已建立 {{ vendorImportResult.createdRestaurants }} 間店鋪，加入
          {{ vendorImportResult.attachedVendors }} 間，略過
          {{ vendorImportResult.skipped }} 筆。
        </div>

        <div class="mt-4 flex justify-end">
          <button
            type="button"
            data-testid="vendor-import-submit"
            class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            :disabled="isImportingVendors || !vendorImportText.trim()"
            @click="importVendorsForMarket"
          >
            {{ isImportingVendors ? "匯入中..." : "匯入店鋪" }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import {
  marketsService,
  type ImportMarketVendorInput,
  type ImportMarketVendorsResult,
  type MarketCatalogGapVendor,
  type MarketListItem,
} from "@/services/marketsService";
import { useAuthStore } from "@/stores/auth";
import {
  marketPublicReadinessSummary,
  publicReadinessIssueLabel,
} from "@/utils/marketPublicReadiness";
import {
  filterMarketsByReadiness,
  marketReadinessStats,
  type MarketReadinessFilter,
} from "@/utils/marketPublicReadinessWorkbench";
import {
  buildMarketPublicProfilePayload,
  marketPublicProfileFormFromMarket,
  type MarketPublicProfileForm,
} from "@/utils/marketPublicProfileForm";

const router = useRouter();
const authStore = useAuthStore();
const markets = ref<MarketListItem[]>([]);
const isLoading = ref(true);
const isSaving = ref(false);
const query = ref("");
const readinessFilter = ref<MarketReadinessFilter>("all");
const editingMarket = ref<MarketListItem | null>(null);
const formError = ref("");
const isImportingVendors = ref(false);
const vendorImportText = ref("");
const vendorImportError = ref("");
const vendorImportResult = ref<ImportMarketVendorsResult | null>(null);
const editForm = reactive<MarketPublicProfileForm>({
  description: "",
  address: "",
  latitude: "",
  longitude: "",
  openingHoursText: "",
  bannerUrl: "",
  logoUrl: "",
  imageUrlsText: "",
  tagsText: "",
});

const filterOptions: Array<{ value: MarketReadinessFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "ready", label: "可上架" },
  { value: "blocked", label: "需補齊" },
  { value: "unknown", label: "未知" },
];

const stats = computed(() => marketReadinessStats(markets.value));
const filteredMarkets = computed(() =>
  filterMarketsByReadiness(markets.value, readinessFilter.value, query.value),
);
const metrics = computed(() => [
  { label: "總數", value: stats.value.total, class: "text-gray-900" },
  { label: "可上架", value: stats.value.ready, class: "text-green-600" },
  { label: "需補齊", value: stats.value.blocked, class: "text-amber-600" },
  { label: "未知", value: stats.value.unknown, class: "text-gray-400" },
  {
    label: "平均完整度",
    value: `${stats.value.averageScore}%`,
    class: "text-primary-600",
  },
  {
    label: "缺商品店鋪",
    value: stats.value.vendorsMissingProducts,
    class: "text-amber-600",
  },
  {
    label: "缺服務店鋪",
    value: stats.value.vendorsMissingServices,
    class: "text-amber-600",
  },
]);

function readinessBadgeClass(market: MarketListItem) {
  if (!market.publicReadiness) return "bg-gray-100 text-gray-600";
  if (market.publicReadiness.ready) return "bg-green-100 text-green-700";
  return "bg-amber-100 text-amber-800";
}

async function loadMarkets() {
  isLoading.value = true;
  try {
    markets.value = await marketsService.listPlatformReadiness();
  } catch (error) {
    console.error("Failed to load markets:", error);
    markets.value = [];
  } finally {
    isLoading.value = false;
  }
}

function vendorGapNames(
  vendors: NonNullable<
    NonNullable<MarketListItem["catalogCoverage"]>["missingProductVendors"]
  >,
) {
  return vendors
    .map((vendor) =>
      vendor.stallNumber
        ? `${vendor.name} (${vendor.stallNumber})`
        : vendor.name,
    )
    .join("、");
}

function manageVendorGap(
  vendor: MarketCatalogGapVendor,
  target: "products" | "services",
) {
  authStore.selectRestaurant(vendor.restaurantId, vendor.name);
  if (target === "products") {
    router.push({ name: "Menu" });
    return;
  }

  router.push({ name: "Settings", query: { tab: "contact" } });
}

function startEditing(market: MarketListItem) {
  editingMarket.value = market;
  formError.value = "";
  vendorImportError.value = "";
  vendorImportResult.value = null;
  vendorImportText.value = "";
  Object.assign(editForm, marketPublicProfileFormFromMarket(market));
}

function cancelEditing() {
  editingMarket.value = null;
  formError.value = "";
  vendorImportError.value = "";
  vendorImportResult.value = null;
  vendorImportText.value = "";
}

async function saveMarketProfile() {
  if (!editingMarket.value) return;

  formError.value = "";
  let payload;
  try {
    payload = buildMarketPublicProfilePayload(editForm);
  } catch (error) {
    formError.value =
      error instanceof Error ? error.message : "公開資料格式不正確";
    return;
  }

  isSaving.value = true;
  try {
    await marketsService.updateMarketPublicProfile(
      editingMarket.value.id,
      payload,
    );
    await loadMarkets();
    cancelEditing();
  } catch (error) {
    console.error("Failed to update market public profile:", error);
    formError.value = "儲存失敗，請確認 URL 與欄位格式。";
  } finally {
    isSaving.value = false;
  }
}

function loadVendorImportExample() {
  vendorImportError.value = "";
  vendorImportText.value = JSON.stringify(
    [
      {
        restaurantId: "restaurant-1",
        stallNumber: "A-01",
        isPrimary: true,
      },
      {
        name: "新店鋪",
        type: "market_stall",
        category: "food",
        address: "台中市西屯區文華路 100 號",
        district: "西屯區",
        stallNumber: "B-02",
      },
    ],
    null,
    2,
  );
}

function isVendorImportEnvelope(
  value: unknown,
): value is { vendors: unknown[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { vendors?: unknown }).vendors)
  );
}

function parseVendorImportText(): ImportMarketVendorInput[] {
  const payload: unknown = JSON.parse(vendorImportText.value);
  const vendors = Array.isArray(payload)
    ? payload
    : isVendorImportEnvelope(payload)
      ? payload.vendors
      : null;

  if (!vendors?.length) {
    throw new Error("請貼上至少一筆店鋪資料。");
  }

  if (vendors.some((vendor) => typeof vendor !== "object" || vendor === null)) {
    throw new Error("每一筆店鋪資料都必須是 JSON 物件。");
  }

  return vendors as ImportMarketVendorInput[];
}

async function importVendorsForMarket() {
  if (!editingMarket.value) return;

  vendorImportError.value = "";
  vendorImportResult.value = null;

  let vendors: ImportMarketVendorInput[];
  try {
    vendors = parseVendorImportText();
  } catch (error) {
    vendorImportError.value =
      error instanceof Error ? error.message : "店鋪 JSON 格式不正確。";
    return;
  }

  isImportingVendors.value = true;
  try {
    vendorImportResult.value = await marketsService.importVendors(
      editingMarket.value.id,
      vendors,
    );
    vendorImportText.value = "";
    await loadMarkets();
  } catch (error) {
    console.error("Failed to import market vendors:", error);
    vendorImportError.value = "匯入失敗，請確認店鋪欄位與權限。";
  } finally {
    isImportingVendors.value = false;
  }
}

onMounted(() => {
  loadMarkets();
});
</script>
