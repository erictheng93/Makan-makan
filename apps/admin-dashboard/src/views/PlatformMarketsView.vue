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
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="export-catalog-gaps"
          class="w-fit rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50"
          :disabled="isLoading || catalogGapRowCount === 0"
          @click="downloadCatalogGapCsv"
        >
          匯出缺口 CSV
        </button>
        <button
          type="button"
          data-testid="export-vendor-import-worklist"
          class="w-fit rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50"
          :disabled="isLoading || vendorImportWorklistRowCount === 0"
          @click="downloadVendorImportWorklistCsv"
        >
          匯出店鋪模板
        </button>
        <button
          type="button"
          data-testid="export-area-readiness"
          class="w-fit rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50"
          :disabled="isLoading || areaReadiness.length === 0"
          @click="downloadAreaReadinessCsv"
        >
          匯出區域 CSV
        </button>
        <button
          type="button"
          class="w-fit rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
          :disabled="isLoading"
          @click="loadMarkets"
        >
          重新整理
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-11">
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

    <section class="rounded-lg bg-white p-4 shadow-ios-card">
      <div
        class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
      >
        <div>
          <h2 class="text-base font-semibold text-gray-900">
            Discovery 搜尋索引
          </h2>
          <p class="mt-1 text-sm text-gray-500">
            大量匯入市場、店鋪或菜單後，可手動重建公開搜尋索引。
          </p>
        </div>
        <button
          type="button"
          data-testid="discovery-reindex"
          class="w-fit rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
          :disabled="isReindexingDiscovery"
          @click="reindexDiscovery"
        >
          {{ isReindexingDiscovery ? "重建中..." : "重建索引" }}
        </button>
      </div>
      <p v-if="discoveryReindexError" class="mt-3 text-sm text-red-600">
        {{ discoveryReindexError }}
      </p>
      <p
        v-if="discoveryReindexResult"
        data-testid="discovery-reindex-result"
        class="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800"
      >
        已重建 {{ discoveryReindexResult.dishes }} 筆商品索引，
        {{ discoveryReindexResult.restaurants }} 間店鋪，耗時
        {{ discoveryReindexResult.duration_ms }}ms。
      </p>
    </section>

    <section class="rounded-lg bg-white p-4 shadow-ios-card">
      <div
        class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
      >
        <div>
          <h2 class="text-base font-semibold text-gray-900">店家加入申請</h2>
          <p class="mt-1 text-sm text-gray-500">
            審核店家申請加入市場或商圈；核准後會建立攤位關聯並更新公開搜尋索引。
          </p>
        </div>
        <button
          type="button"
          class="w-fit rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
          :disabled="isLoadingJoinRequests"
          @click="loadJoinRequests"
        >
          {{ isLoadingJoinRequests ? "讀取中..." : "重新整理申請" }}
        </button>
      </div>

      <p v-if="joinRequestError" class="mt-3 text-sm text-red-600">
        {{ joinRequestError }}
      </p>

      <div
        v-if="pendingJoinRequests.length > 0"
        class="mt-4 divide-y divide-gray-200 rounded-lg border border-gray-200"
      >
        <div
          v-for="request in pendingJoinRequests"
          :key="request.id"
          class="grid gap-3 p-3 lg:grid-cols-[1fr_10rem_8rem_auto_auto]"
        >
          <div>
            <div class="font-medium text-gray-900">
              {{ request.restaurant.name }}
            </div>
            <div class="mt-0.5 text-xs text-gray-500">
              {{ request.restaurant.city || "未填城市" }} ·
              {{ request.restaurant.district || "未填區域" }}
            </div>
            <div class="mt-1 text-sm text-gray-700">
              申請加入 {{ request.market.name }}
            </div>
            <p
              v-if="request.message"
              class="mt-1 text-sm leading-5 text-gray-600"
            >
              {{ request.message }}
            </p>
          </div>
          <input
            v-model="joinRequestDrafts[request.id].stallNumber"
            type="text"
            :data-testid="`join-request-stall-${request.id}`"
            class="h-fit rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
            placeholder="攤位號"
          />
          <label
            class="inline-flex h-fit items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700"
          >
            <input
              v-model="joinRequestDrafts[request.id].isPrimary"
              type="checkbox"
              :data-testid="`join-request-primary-${request.id}`"
              class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            主要市場
          </label>
          <button
            type="button"
            :data-testid="`approve-join-request-${request.id}`"
            class="h-fit rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            :disabled="resolvingJoinRequestId === request.id"
            @click="approveJoinRequest(request)"
          >
            {{ resolvingJoinRequestId === request.id ? "處理中..." : "核准" }}
          </button>
          <button
            type="button"
            :data-testid="`reject-join-request-${request.id}`"
            class="h-fit rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
            :disabled="resolvingJoinRequestId === request.id"
            @click="rejectJoinRequest(request)"
          >
            拒絕
          </button>
        </div>
      </div>

      <p
        v-else-if="!isLoadingJoinRequests && !joinRequestError"
        class="mt-3 rounded-lg border border-dashed border-gray-300 px-3 py-3 text-sm text-gray-500"
      >
        目前沒有待審加入申請。
      </p>
    </section>

    <section class="rounded-lg bg-white p-4 shadow-ios-card">
      <div
        class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
      >
        <div>
          <h2 class="text-base font-semibold text-gray-900">
            批次匯入市場 / 商圈
          </h2>
          <p class="mt-1 text-sm text-gray-500">
            貼上 CSV 或 JSON，一次建立夜市、商圈、商場或活動場域。
          </p>
        </div>
        <button
          type="button"
          class="w-fit rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          @click="loadMarketImportExample"
        >
          載入範例
        </button>
      </div>

      <div class="mt-4 flex flex-wrap gap-2">
        <button
          v-for="option in marketImportFormatOptions"
          :key="option.value"
          type="button"
          class="rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          :class="
            marketImportFormat === option.value
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          "
          :data-testid="`market-import-format-${option.value}`"
          @click="setMarketImportFormat(option.value)"
        >
          {{ option.label }}
        </button>
      </div>

      <textarea
        v-model="marketImportText"
        rows="6"
        data-testid="market-import-text"
        class="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
        :placeholder="marketImportPlaceholder"
      />

      <div v-if="marketImportPreview.errors.length" class="mt-3 space-y-1">
        <p
          v-for="error in marketImportPreview.errors"
          :key="error"
          class="text-sm text-red-600"
        >
          {{ error }}
        </p>
      </div>
      <p v-if="marketImportError" class="mt-3 text-sm text-red-600">
        {{ marketImportError }}
      </p>
      <div
        v-if="
          marketImportText.trim() &&
          !marketImportPreview.errors.length &&
          marketImportPreview.markets.length
        "
        class="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800"
      >
        已解析 {{ marketImportPreview.markets.length }} 筆市場，準備匯入。
      </div>
      <div
        v-if="marketImportResult"
        class="mt-3 rounded-lg px-3 py-2 text-sm"
        :class="
          marketImportResult.failed > 0
            ? 'bg-amber-50 text-amber-900'
            : 'bg-green-50 text-green-800'
        "
      >
        <p>
          已建立 {{ marketImportResult.created }} 個市場
          <span v-if="marketImportResult.failed > 0">
            ，匯入失敗 {{ marketImportResult.failed }} 筆
          </span>
          。
        </p>
        <p v-if="marketImportResult.created > 0" class="mt-1 text-xs">
          下一步：編輯市場並批次匯入店鋪，才能讓使用者搜尋商品/服務並開啟菜單。
        </p>
        <ul
          v-if="marketImportResult.items.length"
          class="mt-2 space-y-1"
          data-testid="market-import-result-items"
        >
          <li
            v-for="item in marketImportResult.items"
            :key="`${item.slug}-${item.status}`"
            class="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2"
          >
            <span class="font-medium">
              {{ item.name }}（{{ item.slug }}）
            </span>
            <span
              :class="
                item.status === 'created' ? 'text-green-700' : 'text-red-700'
              "
            >
              {{ item.status === "created" ? "已建立" : item.message }}
            </span>
            <button
              v-if="item.status === 'created' && item.createdMarket"
              type="button"
              :data-testid="`market-import-edit-${item.slug}`"
              class="w-fit rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800 hover:bg-green-200"
              @click="startEditing(item.createdMarket)"
            >
              匯入店鋪
            </button>
          </li>
        </ul>
      </div>

      <div class="mt-4 flex justify-end">
        <button
          type="button"
          data-testid="market-import-submit"
          class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          :disabled="
            isImportingMarkets ||
            !marketImportText.trim() ||
            marketImportPreview.errors.length > 0 ||
            marketImportPreview.markets.length === 0
          "
          @click="importMarkets"
        >
          {{ isImportingMarkets ? "匯入中..." : "匯入市場" }}
        </button>
      </div>
    </section>

    <section
      v-if="areaReadiness.length > 0"
      class="rounded-lg bg-white p-4 shadow-ios-card"
    >
      <div
        class="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h2 class="text-base font-semibold text-gray-900">區域缺口排行</h2>
          <p class="text-sm text-gray-500">
            依城市與行政區彙總市場、店鋪、商品與服務缺口。
          </p>
        </div>
        <span class="text-xs text-gray-400">依總缺口排序</span>
      </div>
      <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div
          v-for="area in areaReadiness.slice(0, 6)"
          :key="`${area.city}-${area.district}`"
          role="button"
          tabindex="0"
          data-testid="area-readiness-row"
          class="rounded-lg border p-3 text-left transition-colors"
          :class="
            isSelectedArea(area)
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-200 hover:border-primary-200 hover:bg-gray-50'
          "
          @click="selectArea(area)"
          @keydown.enter.prevent="selectArea(area)"
          @keydown.space.prevent="selectArea(area)"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="font-medium text-gray-900">
                {{ area.city }} · {{ area.district }}
              </h3>
              <p class="mt-0.5 text-xs text-gray-500">
                {{ area.marketCount }} 個市場 / {{ area.vendorCount }} 間店鋪
              </p>
            </div>
            <span
              class="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800"
            >
              總缺口 {{ area.totalCatalogGapVendors }}
            </span>
          </div>
          <div class="mt-3 grid grid-cols-3 gap-2 text-xs text-gray-600">
            <div>
              <div class="font-medium text-gray-900">
                {{ area.searchableProductCount }}
              </div>
              <div>商品</div>
            </div>
            <div>
              <div class="font-medium text-gray-900">
                {{ area.publicServiceCount }}
              </div>
              <div>服務</div>
            </div>
            <div>
              <div class="font-medium text-gray-900">
                {{ area.averageReadinessScore }}%
              </div>
              <div>完整度</div>
            </div>
          </div>
          <div class="mt-3 flex flex-wrap gap-2 text-xs text-amber-700">
            <button
              type="button"
              data-testid="area-gap-missing-products"
              class="rounded bg-amber-50 px-2 py-1 font-medium text-amber-800 hover:bg-amber-100"
              @click.stop="selectAreaGap(area, 'missingProducts')"
            >
              缺商品 {{ area.vendorsMissingSearchableProducts }}
            </button>
            <button
              type="button"
              data-testid="area-gap-missing-services"
              class="rounded bg-amber-50 px-2 py-1 font-medium text-amber-800 hover:bg-amber-100"
              @click.stop="selectAreaGap(area, 'missingServices')"
            >
              缺服務 {{ area.vendorsMissingPublicServices }}
            </button>
          </div>
          <div
            v-if="
              area.marketsWithoutVendors || area.marketsWithoutSearchableCatalog
            "
            class="mt-2 flex flex-wrap gap-2 text-xs text-red-700"
          >
            <button
              v-if="area.marketsWithoutVendors"
              type="button"
              data-testid="area-gap-empty-vendors"
              class="rounded bg-red-50 px-2 py-1 font-medium text-red-800 hover:bg-red-100"
              @click.stop="selectAreaGap(area, 'emptyVendors')"
            >
              無店鋪 {{ area.marketsWithoutVendors }}
            </button>
            <button
              v-if="area.marketsWithoutSearchableCatalog"
              type="button"
              data-testid="area-gap-empty-catalog"
              class="rounded bg-red-50 px-2 py-1 font-medium text-red-800 hover:bg-red-100"
              @click.stop="selectAreaGap(area, 'emptyCatalog')"
            >
              無搜尋內容 {{ area.marketsWithoutSearchableCatalog }}
            </button>
          </div>
        </div>
      </div>
    </section>

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
      <div
        v-if="selectedArea"
        data-testid="selected-area-filter"
        class="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-600"
      >
        <span>
          目前區域：{{ selectedArea.city }} · {{ selectedArea.district }}
        </span>
        <button
          type="button"
          data-testid="clear-area-filter"
          class="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
          @click="clearArea"
        >
          清除區域
        </button>
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
              補齊優先
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
              <p
                v-if="marketHasNoSearchableCatalog(market)"
                class="mt-2 max-w-48 text-xs text-amber-700"
              >
                補菜單/服務或重建索引，避免前台搜尋沒有內容。
              </p>
              <div
                v-if="
                  market.catalogCoverage?.vendorsMissingSearchableProducts ||
                  market.catalogCoverage?.vendorsMissingPublicServices ||
                  market.catalogCoverage?.vendorsMissingStallNumbers ||
                  market.catalogCoverage?.vendorsMissingSearchEntrypoints
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
                <div>
                  缺攤位號
                  {{ market.catalogCoverage?.vendorsMissingStallNumbers ?? 0 }}
                </div>
                <div>
                  缺搜尋入口
                  {{
                    market.catalogCoverage?.vendorsMissingSearchEntrypoints ?? 0
                  }}
                </div>
              </div>
            </td>
            <td class="px-4 py-4">
              <span
                data-testid="catalog-priority"
                class="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800"
              >
                {{ marketCatalogGapPriority(market) }}
              </span>
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
                v-if="hasCustomerEmptyStateGap(market)"
                class="mt-3 max-w-md space-y-1 text-xs text-red-700"
              >
                <div
                  v-if="marketHasNoVendors(market)"
                  class="rounded bg-red-50 px-2 py-1"
                >
                  <div>使用者會看到尚未收錄店鋪</div>
                  <button
                    type="button"
                    :data-testid="`import-vendors-${market.id}`"
                    class="mt-1 rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-200"
                    @click="startVendorImport(market)"
                  >
                    匯入店鋪
                  </button>
                </div>
                <div
                  v-if="marketHasNoSearchableCatalog(market)"
                  class="rounded bg-red-50 px-2 py-1"
                >
                  <div>使用者會看到尚未上架商品/服務</div>
                  <button
                    type="button"
                    :data-testid="`reindex-${market.id}`"
                    class="mt-1 rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-200 disabled:opacity-50"
                    :disabled="isReindexingDiscovery"
                    @click="reindexDiscovery"
                  >
                    重建索引
                  </button>
                </div>
              </div>
              <div
                v-if="hasCatalogGapVendors(market)"
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
                <div
                  v-if="
                    market.catalogCoverage?.missingStallNumberVendors?.length
                  "
                >
                  <span class="font-medium text-gray-700">缺攤位號：</span>
                  {{
                    vendorGapNames(
                      market.catalogCoverage.missingStallNumberVendors,
                    )
                  }}
                  <div class="mt-1 flex flex-wrap gap-1.5">
                    <button
                      v-for="vendor in market.catalogCoverage
                        .missingStallNumberVendors"
                      :key="`stall-${vendor.restaurantId}`"
                      type="button"
                      class="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200"
                      :data-testid="`manage-stall-${vendor.restaurantId}`"
                      @click="startEditing(market)"
                    >
                      補攤位號
                    </button>
                  </div>
                </div>
                <div
                  v-if="
                    market.catalogCoverage?.missingSearchEntrypointVendors
                      ?.length
                  "
                >
                  <span class="font-medium text-gray-700">缺搜尋入口：</span>
                  {{
                    vendorGapNames(
                      market.catalogCoverage.missingSearchEntrypointVendors,
                    )
                  }}
                </div>
              </div>
              <span
                v-if="
                  !market.publicReadiness?.issues.length &&
                  !hasCustomerEmptyStateGap(market) &&
                  !hasCatalogGapVendors(market)
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

      <section
        ref="vendorImportSection"
        data-testid="vendor-import-section"
        class="mt-6 border-t border-gray-200 pt-5"
      >
        <div
          class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
        >
          <div>
            <h3 class="text-base font-semibold text-gray-900">批次匯入店鋪</h3>
            <p class="mt-1 text-sm text-gray-500">
              貼上 CSV 或 JSON；既有店鋪填 restaurantId，新店鋪至少填
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

        <div class="mt-4 flex flex-wrap gap-2">
          <button
            v-for="option in vendorImportFormatOptions"
            :key="option.value"
            type="button"
            class="rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            :class="
              vendorImportFormat === option.value
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            "
            :data-testid="`vendor-import-format-${option.value}`"
            @click="setVendorImportFormat(option.value)"
          >
            {{ option.label }}
          </button>
        </div>

        <textarea
          v-model="vendorImportText"
          rows="8"
          data-testid="vendor-import-json"
          class="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
          :placeholder="vendorImportPlaceholder"
        />

        <div v-if="vendorImportPreview.errors.length" class="mt-3 space-y-1">
          <p
            v-for="error in vendorImportPreview.errors"
            :key="error"
            class="text-sm text-red-600"
          >
            {{ error }}
          </p>
        </div>
        <p v-if="vendorImportError" class="mt-3 text-sm text-red-600">
          {{ vendorImportError }}
        </p>
        <div
          v-if="
            vendorImportText.trim() &&
            !vendorImportPreview.errors.length &&
            vendorImportPreview.vendors.length
          "
          class="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800"
        >
          已解析 {{ vendorImportPreview.vendors.length }} 筆店鋪，準備匯入。
        </div>
        <div
          v-if="vendorImportResult"
          class="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800"
        >
          已建立 {{ vendorImportResult.createdRestaurants ?? 0 }} 間店鋪，加入
          {{ vendorImportResult.attachedVendors ?? 0 }} 間，略過
          {{ vendorImportResult.skipped }} 筆。
          <span v-if="vendorImportResult.publicReadiness" class="block">
            公開頁狀態：
            {{
              marketPublicReadinessSummary(vendorImportResult.publicReadiness)
                .text
            }}
          </span>
        </div>
        <div
          v-if="vendorImportDryRunResult"
          data-testid="vendor-import-dry-run-result"
          class="mt-3 space-y-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          <p class="font-medium">預檢結果</p>
          <p>
            會建立
            {{ vendorImportDryRunResult.wouldCreateRestaurants ?? 0 }}
            間，會加入
            {{ vendorImportDryRunResult.wouldAttachVendors ?? 0 }} 間，略過
            {{ vendorImportDryRunResult.skipped }} 筆；阻擋
            {{ vendorImportDryRunResult.blockingIssueCount ?? 0 }}，提醒
            {{ vendorImportDryRunResult.warningIssueCount ?? 0 }}。
          </p>
          <p v-if="vendorImportDryRunResult.publicReadiness">
            預估公開頁狀態：
            {{
              marketPublicReadinessSummary(
                vendorImportDryRunResult.publicReadiness,
              ).text
            }}
          </p>
          <ul
            v-if="vendorImportDryRunResult.issues?.length"
            class="list-disc space-y-1 pl-5 text-xs"
          >
            <li
              v-for="issue in vendorImportDryRunResult.issues"
              :key="`${issue.index}-${issue.code}-${issue.restaurantId ?? issue.restaurantName ?? ''}`"
            >
              第 {{ issue.index + 1 }} 筆：
              {{ issue.restaurantName || issue.restaurantId || "新店鋪" }} -
              {{ issue.message }}
            </li>
          </ul>
        </div>

        <div class="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            data-testid="vendor-import-dry-run"
            class="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
            :disabled="
              isDryRunningVendors ||
              isImportingVendors ||
              !vendorImportText.trim() ||
              vendorImportPreview.errors.length > 0 ||
              vendorImportPreview.vendors.length === 0
            "
            @click="dryRunVendorsForMarket"
          >
            {{ isDryRunningVendors ? "預檢中..." : "預檢匯入" }}
          </button>
          <button
            type="button"
            data-testid="vendor-import-submit"
            class="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            :disabled="
              isImportingVendors ||
              !vendorImportText.trim() ||
              vendorImportPreview.errors.length > 0 ||
              vendorImportPreview.vendors.length === 0
            "
            @click="importVendorsForMarket"
          >
            {{ isImportingVendors ? "匯入中..." : "匯入店鋪" }}
          </button>
        </div>
      </section>

      <section class="mt-6 border-t border-gray-200 pt-5">
        <div
          class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
        >
          <div>
            <h3 class="text-base font-semibold text-gray-900">已加入店鋪</h3>
            <p class="mt-1 text-sm text-gray-500">
              維護攤位號與主要市場設定，或將店鋪從此市場移除。
            </p>
          </div>
          <button
            type="button"
            class="w-fit rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
            :disabled="isLoadingAttachedVendors"
            @click="loadAttachedVendors()"
          >
            {{ isLoadingAttachedVendors ? "讀取中..." : "重新整理" }}
          </button>
        </div>

        <p v-if="attachedVendorError" class="mt-3 text-sm text-red-600">
          {{ attachedVendorError }}
        </p>

        <div class="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            v-model="attachedVendorQuery"
            type="search"
            data-testid="attached-vendor-query"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
            placeholder="搜尋已加入店鋪"
            @keyup.enter="searchAttachedVendors"
          />
          <button
            type="button"
            data-testid="attached-vendor-search"
            class="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
            :disabled="isLoadingAttachedVendors"
            @click="searchAttachedVendors"
          >
            搜尋
          </button>
        </div>

        <div
          v-if="attachedVendors.length > 0"
          class="mt-4 divide-y divide-gray-200 rounded-lg border border-gray-200"
        >
          <div
            v-for="vendor in attachedVendors"
            :key="vendor.restaurantId"
            :data-testid="`attached-vendor-row-${vendor.restaurantId}`"
            class="grid gap-3 p-3 lg:grid-cols-[1fr_10rem_8rem_auto_auto]"
          >
            <div>
              <div class="font-medium text-gray-900">
                {{ vendor.name }}
              </div>
              <div class="mt-0.5 text-xs text-gray-500">
                {{ vendor.city || "未填城市" }} ·
                {{ vendor.district || "未填區域" }}
              </div>
              <div class="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                <span v-if="vendor.type">{{ vendor.type }}</span>
                <span v-if="vendor.category">{{ vendor.category }}</span>
                <span v-if="vendor.supportsTakeaway">可外帶</span>
                <span v-if="vendor.supportsDelivery">可外送</span>
              </div>
            </div>
            <input
              v-model="vendor.draftStallNumber"
              type="text"
              :data-testid="`attached-vendor-stall-${vendor.restaurantId}`"
              class="h-fit rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              placeholder="攤位號"
            />
            <label
              class="inline-flex h-fit items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700"
            >
              <input
                v-model="vendor.draftIsPrimary"
                type="checkbox"
                :data-testid="`attached-vendor-primary-${vendor.restaurantId}`"
                class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              主要市場
            </label>
            <button
              type="button"
              :data-testid="`attached-vendor-save-${vendor.restaurantId}`"
              class="h-fit rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              :disabled="vendor.isSaving || vendor.isRemoving"
              @click="saveAttachedVendor(vendor)"
            >
              {{ vendor.isSaving ? "儲存中..." : "儲存" }}
            </button>
            <button
              type="button"
              :data-testid="`attached-vendor-remove-${vendor.restaurantId}`"
              class="h-fit rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
              :disabled="vendor.isSaving || vendor.isRemoving"
              @click="removeAttachedVendor(vendor)"
            >
              {{ vendor.isRemoving ? "移除中..." : "移除" }}
            </button>
          </div>
        </div>

        <div
          v-if="attachedVendorTotal > 0"
          class="mt-3 flex flex-col gap-3 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>
            共 {{ attachedVendorTotal }} 間店鋪，第 {{ attachedVendorPage }} /
            {{ attachedVendorPageCount }} 頁
          </span>
          <div class="flex gap-2">
            <button
              type="button"
              data-testid="attached-vendor-prev-page"
              class="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
              :disabled="isLoadingAttachedVendors || attachedVendorPage <= 1"
              @click="goToAttachedVendorPage(attachedVendorPage - 1)"
            >
              上一頁
            </button>
            <button
              type="button"
              data-testid="attached-vendor-next-page"
              class="rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
              :disabled="
                isLoadingAttachedVendors ||
                attachedVendorPage >= attachedVendorPageCount
              "
              @click="goToAttachedVendorPage(attachedVendorPage + 1)"
            >
              下一頁
            </button>
          </div>
        </div>

        <p
          v-else-if="!isLoadingAttachedVendors && !attachedVendorError"
          class="mt-3 rounded-lg border border-dashed border-gray-300 px-3 py-3 text-sm text-gray-500"
        >
          這個市場目前沒有已加入店鋪。
        </p>
      </section>

      <section class="mt-6 border-t border-gray-200 pt-5">
        <div
          class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
        >
          <div>
            <h3 class="text-base font-semibold text-gray-900">加入既有店鋪</h3>
            <p class="mt-1 text-sm text-gray-500">
              搜尋已建立的店鋪，直接掛到這個市場或商圈。
            </p>
          </div>
        </div>

        <div class="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            v-model="vendorCandidateQuery"
            type="search"
            data-testid="vendor-candidate-query"
            class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
            placeholder="搜尋店名、地址、城市或行政區"
            @keyup.enter="loadVendorCandidates"
          />
          <button
            type="button"
            data-testid="vendor-candidate-search"
            class="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
            :disabled="isLoadingVendorCandidates"
            @click="loadVendorCandidates"
          >
            {{ isLoadingVendorCandidates ? "搜尋中..." : "搜尋店鋪" }}
          </button>
        </div>

        <p v-if="vendorCandidateError" class="mt-3 text-sm text-red-600">
          {{ vendorCandidateError }}
        </p>
        <p v-if="vendorAttachMessage" class="mt-3 text-sm text-green-700">
          {{ vendorAttachMessage }}
        </p>

        <div
          v-if="vendorCandidates.length > 0"
          class="mt-4 divide-y divide-gray-200 rounded-lg border border-gray-200"
        >
          <div
            v-for="candidate in vendorCandidates"
            :key="candidate.id"
            class="grid gap-3 p-3 lg:grid-cols-[1fr_10rem_8rem_auto]"
          >
            <div>
              <div class="font-medium text-gray-900">
                {{ candidate.name }}
              </div>
              <div class="mt-0.5 text-xs text-gray-500">
                {{ candidate.city }} · {{ candidate.district }} ·
                {{ candidate.address }}
              </div>
              <div class="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                <span>{{ candidate.type }}</span>
                <span>{{ candidate.category }}</span>
                <span v-if="candidate.supportsTakeaway">可外帶</span>
                <span v-if="candidate.supportsDelivery">可外送</span>
              </div>
            </div>
            <input
              v-model="vendorCandidateStalls[candidate.id]"
              type="text"
              :data-testid="`vendor-candidate-stall-${candidate.id}`"
              class="h-fit rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              placeholder="攤位號"
            />
            <label
              class="inline-flex h-fit items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700"
            >
              <input
                v-model="vendorCandidatePrimary[candidate.id]"
                type="checkbox"
                :data-testid="`vendor-candidate-primary-${candidate.id}`"
                class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              主要市場
            </label>
            <button
              type="button"
              :data-testid="`vendor-candidate-attach-${candidate.id}`"
              class="h-fit rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              :disabled="attachingVendorId === candidate.id"
              @click="attachVendorCandidate(candidate)"
            >
              {{ attachingVendorId === candidate.id ? "加入中..." : "加入" }}
            </button>
          </div>
        </div>

        <p
          v-else-if="vendorCandidateSearched && !isLoadingVendorCandidates"
          class="mt-3 rounded-lg border border-dashed border-gray-300 px-3 py-3 text-sm text-gray-500"
        >
          沒有可加入的既有店鋪。
        </p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  marketsService,
  type AdminMarketJoinRequest,
  type CreateMarketInput,
  type ImportMarketVendorInput,
  type ImportMarketVendorsResult,
  type MarketCatalogGapVendor,
  type MarketAreaReadinessSummary,
  type MarketListItem,
  type MarketVendor,
  type MarketVendorCandidate,
} from "@/services/marketsService";
import {
  discoveryService,
  type DiscoveryReindexResult,
} from "@/services/discoveryService";
import { useAuthStore } from "@/stores/auth";
import {
  marketPublicReadinessSummary,
  publicReadinessIssueLabel,
} from "@/utils/marketPublicReadiness";
import {
  filterMarketsByReadiness,
  marketCatalogGapPriority,
  marketHasNoSearchableCatalog,
  marketHasNoVendors,
  marketReadinessStats,
  sortMarketsByCatalogPriority,
  type MarketReadinessFilter,
} from "@/utils/marketPublicReadinessWorkbench";
import {
  buildMarketPublicProfilePayload,
  marketPublicProfileFormFromMarket,
  type MarketPublicProfileForm,
} from "@/utils/marketPublicProfileForm";
import {
  buildMarketVendorImportTemplate,
  parseMarketVendorImport,
  type MarketVendorImportFormat,
} from "@/utils/marketVendorImport";
import {
  buildMarketImportRetryText,
  buildMarketImportTemplate,
  parseMarketImport,
  type MarketImportFormat,
} from "@/utils/marketImport";
import {
  buildMarketCatalogGapCsv,
  buildMarketVendorImportWorklistCsv,
  countMarketCatalogGapRows,
  countMarketVendorImportWorklistRows,
  marketCatalogGapCsvFilename,
  marketVendorImportWorklistCsvFilename,
} from "@/utils/marketCatalogGapExport";
import {
  buildMarketAreaReadinessCsv,
  marketAreaReadinessCsvFilename,
} from "@/utils/marketAreaReadinessExport";

type MarketAreaKey = Pick<MarketAreaReadinessSummary, "city" | "district">;
type EditableMarketVendor = MarketVendor & {
  draftStallNumber: string;
  draftIsPrimary: boolean;
  isSaving?: boolean;
  isRemoving?: boolean;
};
type MarketImportItemResult = {
  slug: string;
  name: string;
  status: "created" | "failed";
  market: CreateMarketInput;
  createdMarket?: MarketListItem;
  message?: string;
};
type MarketImportResult = {
  created: number;
  failed: number;
  items: MarketImportItemResult[];
};
type JoinRequestDraft = {
  stallNumber: string;
  isPrimary: boolean;
};

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const markets = ref<MarketListItem[]>([]);
const areaReadiness = ref<MarketAreaReadinessSummary[]>([]);
const selectedArea = ref<MarketAreaKey | null>(areaFromQuery());
const isLoading = ref(true);
const isSaving = ref(false);
const isReindexingDiscovery = ref(false);
const discoveryReindexResult = ref<DiscoveryReindexResult | null>(null);
const discoveryReindexError = ref("");
const query = ref("");
const readinessFilter = ref<MarketReadinessFilter>("all");
const editingMarket = ref<MarketListItem | null>(null);
const formError = ref("");
const isImportingMarkets = ref(false);
const marketImportFormat = ref<MarketImportFormat>("csv");
const marketImportText = ref("");
const marketImportError = ref("");
const marketImportResult = ref<MarketImportResult | null>(null);
const isImportingVendors = ref(false);
const isDryRunningVendors = ref(false);
const vendorImportFormat = ref<MarketVendorImportFormat>("csv");
const vendorImportText = ref("");
const vendorImportError = ref("");
const vendorImportResult = ref<ImportMarketVendorsResult | null>(null);
const vendorImportDryRunResult = ref<ImportMarketVendorsResult | null>(null);
const vendorCandidateQuery = ref("");
const vendorCandidates = ref<MarketVendorCandidate[]>([]);
const vendorCandidateStalls = reactive<Record<string, string>>({});
const vendorCandidatePrimary = reactive<Record<string, boolean>>({});
const vendorCandidateError = ref("");
const vendorAttachMessage = ref("");
const vendorCandidateSearched = ref(false);
const isLoadingVendorCandidates = ref(false);
const attachingVendorId = ref<string | null>(null);
const attachedVendors = ref<EditableMarketVendor[]>([]);
const attachedVendorError = ref("");
const isLoadingAttachedVendors = ref(false);
const attachedVendorQuery = ref("");
const attachedVendorPage = ref(1);
const attachedVendorLimit = 10;
const attachedVendorTotal = ref(0);
const pendingJoinRequests = ref<AdminMarketJoinRequest[]>([]);
const isLoadingJoinRequests = ref(false);
const joinRequestError = ref("");
const resolvingJoinRequestId = ref<number | null>(null);
const joinRequestDrafts = reactive<Record<number, JoinRequestDraft>>({});
const vendorImportSection = ref<HTMLElement | null>(null);
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
  { value: "missingProducts", label: "缺商品" },
  { value: "missingServices", label: "缺服務" },
  { value: "missingStalls", label: "缺攤位號" },
  { value: "missingEntrypoints", label: "缺入口" },
  { value: "emptyVendors", label: "無店鋪" },
  { value: "emptyCatalog", label: "無搜尋內容" },
  { value: "unknown", label: "未知" },
];
const vendorImportFormatOptions: Array<{
  value: MarketVendorImportFormat;
  label: string;
}> = [
  { value: "csv", label: "CSV" },
  { value: "json", label: "JSON" },
];
const marketImportFormatOptions: Array<{
  value: MarketImportFormat;
  label: string;
}> = [
  { value: "csv", label: "CSV" },
  { value: "json", label: "JSON" },
];

const stats = computed(() => marketReadinessStats(markets.value));
const areaFilteredMarkets = computed(() => {
  if (!selectedArea.value) return markets.value;

  return markets.value.filter(
    (market) =>
      market.city === selectedArea.value?.city &&
      market.district === selectedArea.value?.district,
  );
});
const filteredMarkets = computed(() =>
  sortMarketsByCatalogPriority(
    filterMarketsByReadiness(
      areaFilteredMarkets.value,
      readinessFilter.value,
      query.value,
    ),
  ),
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
  {
    label: "缺攤位號",
    value: stats.value.vendorsMissingStallNumbers,
    class: "text-amber-600",
  },
  {
    label: "缺搜尋入口",
    value: stats.value.vendorsMissingSearchEntrypoints,
    class: "text-amber-600",
  },
  {
    label: "無店鋪市場",
    value: stats.value.marketsWithoutVendors,
    class: "text-red-600",
  },
  {
    label: "無搜尋內容市場",
    value: stats.value.marketsWithoutSearchableCatalog,
    class: "text-red-600",
  },
]);
const catalogGapRowCount = computed(() =>
  countMarketCatalogGapRows(filteredMarkets.value),
);
const vendorImportWorklistRowCount = computed(() =>
  countMarketVendorImportWorklistRows(filteredMarkets.value),
);
const marketImportPreview = computed(() => {
  if (!marketImportText.value.trim()) {
    return { markets: [], errors: [] };
  }

  return parseMarketImport(marketImportFormat.value, marketImportText.value);
});
const marketImportPlaceholder = computed(() =>
  marketImportFormat.value === "csv"
    ? "slug,name,type,city,district,address,latitude,longitude,description,bannerUrl,logoUrl,imageUrls,tags,isActive"
    : '[{"slug":"fengjia","name":"逢甲夜市","type":"night_market","city":"台中市","district":"西屯區","address":"台中市西屯區文華路","latitude":24.176,"longitude":120.646}]',
);
const vendorImportPreview = computed(() => {
  if (!vendorImportText.value.trim()) {
    return { vendors: [], errors: [] };
  }

  return parseMarketVendorImport(
    vendorImportFormat.value,
    vendorImportText.value,
    {
      marketId: editingMarket.value?.id,
      marketSlug: editingMarket.value?.slug,
    },
  );
});
const vendorImportPlaceholder = computed(() =>
  vendorImportFormat.value === "csv"
    ? "restaurantId,name,type,category,description,address,district,city,phone,email,website,stallNumber,isPrimary"
    : '[{"restaurantId":"restaurant-1","stallNumber":"A-01"},{"name":"新店鋪","address":"台中市西屯區文華路","district":"西屯區","stallNumber":"B-02"}]',
);
const attachedVendorPageCount = computed(() =>
  Math.max(1, Math.ceil(attachedVendorTotal.value / attachedVendorLimit)),
);

function readinessBadgeClass(market: MarketListItem) {
  if (!market.publicReadiness) return "bg-gray-100 text-gray-600";
  if (market.publicReadiness.ready) return "bg-green-100 text-green-700";
  return "bg-amber-100 text-amber-800";
}

function isSelectedArea(area: MarketAreaKey) {
  return (
    selectedArea.value?.city === area.city &&
    selectedArea.value?.district === area.district
  );
}

function selectArea(area: MarketAreaKey) {
  selectedArea.value = { city: area.city, district: area.district };
  syncAreaQuery();
}

function selectAreaGap(area: MarketAreaKey, filter: MarketReadinessFilter) {
  readinessFilter.value = filter;
  selectArea(area);
}

function clearArea() {
  selectedArea.value = null;
  syncAreaQuery();
}

function areaFromQuery(): MarketAreaKey | null {
  const city = firstQueryString(route.query.areaCity);
  const district = firstQueryString(route.query.areaDistrict);

  return city && district ? { city, district } : null;
}

function firstQueryString(value: unknown) {
  if (Array.isArray(value)) {
    return value.find((item) => typeof item === "string");
  }

  return typeof value === "string" ? value : undefined;
}

function syncAreaQuery() {
  const {
    areaCity: _areaCity,
    areaDistrict: _areaDistrict,
    ...query
  } = route.query;

  router.replace({
    query: selectedArea.value
      ? {
          ...query,
          areaCity: selectedArea.value.city,
          areaDistrict: selectedArea.value.district,
        }
      : query,
  });
}

async function loadMarkets() {
  isLoading.value = true;
  try {
    const [marketRows, areaRows] = await Promise.all([
      marketsService.listPlatformReadiness(),
      marketsService.listAreaReadiness(),
    ]);
    markets.value = marketRows;
    areaReadiness.value = areaRows;
  } catch (error) {
    console.error("Failed to load markets:", error);
    markets.value = [];
    areaReadiness.value = [];
  } finally {
    isLoading.value = false;
  }
}

async function loadJoinRequests() {
  isLoadingJoinRequests.value = true;
  joinRequestError.value = "";
  try {
    pendingJoinRequests.value = await marketsService.listAdminJoinRequests({
      status: "pending",
    });
    syncJoinRequestDrafts();
  } catch (error) {
    console.error("Failed to load market join requests:", error);
    pendingJoinRequests.value = [];
    joinRequestError.value = "載入加入申請失敗，請稍後再試。";
  } finally {
    isLoadingJoinRequests.value = false;
  }
}

function syncJoinRequestDrafts() {
  const requestIds = new Set(pendingJoinRequests.value.map(({ id }) => id));
  Object.keys(joinRequestDrafts).forEach((id) => {
    if (!requestIds.has(Number(id))) {
      delete joinRequestDrafts[Number(id)];
    }
  });

  pendingJoinRequests.value.forEach((request) => {
    joinRequestDrafts[request.id] ??= {
      stallNumber: "",
      isPrimary: false,
    };
  });
}

async function approveJoinRequest(request: AdminMarketJoinRequest) {
  const draft = joinRequestDrafts[request.id] ?? {
    stallNumber: "",
    isPrimary: false,
  };
  resolvingJoinRequestId.value = request.id;
  joinRequestError.value = "";
  try {
    await marketsService.approveJoinRequest(request.id, {
      stallNumber: draft.stallNumber.trim() || null,
      isPrimary: draft.isPrimary,
    });
    await Promise.all([loadJoinRequests(), loadMarkets()]);
  } catch (error) {
    console.error("Failed to approve market join request:", error);
    joinRequestError.value = "核准加入申請失敗，請確認申請仍在待審狀態。";
  } finally {
    resolvingJoinRequestId.value = null;
  }
}

async function rejectJoinRequest(request: AdminMarketJoinRequest) {
  resolvingJoinRequestId.value = request.id;
  joinRequestError.value = "";
  try {
    await marketsService.rejectJoinRequest(request.id);
    await loadJoinRequests();
  } catch (error) {
    console.error("Failed to reject market join request:", error);
    joinRequestError.value = "拒絕加入申請失敗，請確認申請仍在待審狀態。";
  } finally {
    resolvingJoinRequestId.value = null;
  }
}

async function reindexDiscovery() {
  discoveryReindexError.value = "";
  discoveryReindexResult.value = null;
  isReindexingDiscovery.value = true;
  try {
    discoveryReindexResult.value = await discoveryService.reindex();
    await loadMarkets();
  } catch (error) {
    console.error("Failed to reindex discovery:", error);
    discoveryReindexError.value = "重建搜尋索引失敗，請稍後再試。";
  } finally {
    isReindexingDiscovery.value = false;
  }
}

function loadMarketImportExample() {
  marketImportError.value = "";
  marketImportText.value =
    marketImportFormat.value === "csv"
      ? buildMarketImportTemplate()
      : JSON.stringify(
          [
            {
              slug: "fengjia",
              name: "逢甲夜市",
              type: "night_market",
              description: "台中指標夜市商圈",
              city: "台中市",
              district: "西屯區",
              address: "台中市西屯區文華路",
              latitude: 24.176,
              longitude: 120.646,
              tags: ["夜市", "小吃"],
              isActive: true,
            },
          ],
          null,
          2,
        );
}

function setMarketImportFormat(format: MarketImportFormat) {
  marketImportFormat.value = format;
  marketImportError.value = "";
  marketImportResult.value = null;
  marketImportText.value = "";
}

function parsedMarketsForImport(): CreateMarketInput[] {
  const parsed = marketImportPreview.value;
  if (!parsed.markets.length || parsed.errors.length) {
    throw new Error(parsed.errors[0] ?? "請確認市場資料格式後再送出。");
  }

  return parsed.markets;
}

async function importMarkets() {
  marketImportError.value = "";
  marketImportResult.value = null;

  let marketInputs: CreateMarketInput[];
  try {
    marketInputs = parsedMarketsForImport();
  } catch (error) {
    marketImportError.value =
      error instanceof Error ? error.message : "市場資料格式不正確。";
    return;
  }

  isImportingMarkets.value = true;
  try {
    const items: MarketImportItemResult[] = [];
    for (const market of marketInputs) {
      try {
        const createdMarket = await marketsService.createMarket(market);
        items.push({
          slug: market.slug,
          name: market.name,
          status: "created",
          market,
          createdMarket,
        });
      } catch (error) {
        console.error("Failed to import market:", error);
        items.push({
          slug: market.slug,
          name: market.name,
          status: "failed",
          market,
          message: marketImportFailureMessage(error),
        });
      }
    }
    const created = items.filter((item) => item.status === "created").length;
    const failed = items.length - created;
    marketImportResult.value = { created, failed, items };
    if (created > 0) {
      await loadMarkets();
    }
    if (failed === 0) {
      marketImportText.value = "";
    } else {
      marketImportText.value = buildMarketImportRetryText(
        marketImportFormat.value,
        items
          .filter((item) => item.status === "failed")
          .map((item) => item.market),
      );
    }
  } finally {
    isImportingMarkets.value = false;
  }
}

function marketImportFailureMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : "建立失敗，請確認 slug 不重複且欄位格式正確。";
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

function hasCatalogGapVendors(market: MarketListItem) {
  return (
    Boolean(market.catalogCoverage?.missingProductVendors?.length) ||
    Boolean(market.catalogCoverage?.missingServiceVendors?.length) ||
    Boolean(market.catalogCoverage?.missingStallNumberVendors?.length) ||
    Boolean(market.catalogCoverage?.missingSearchEntrypointVendors?.length)
  );
}

function hasCustomerEmptyStateGap(market: MarketListItem) {
  return marketHasNoVendors(market) || marketHasNoSearchableCatalog(market);
}

function manageVendorGap(
  vendor: MarketCatalogGapVendor,
  target: "products" | "services",
) {
  authStore.selectRestaurant(vendor.restaurantId, vendor.name);
  if (target === "products") {
    router.push({
      name: "Menu",
      query: { source: "market-gap", gap: "products" },
    });
    return;
  }

  router.push({
    name: "Settings",
    query: { tab: "contact", section: "services" },
  });
}

function startEditing(market: MarketListItem) {
  editingMarket.value = market;
  formError.value = "";
  vendorImportError.value = "";
  vendorImportResult.value = null;
  vendorImportDryRunResult.value = null;
  vendorImportText.value = "";
  resetVendorCandidateState();
  resetAttachedVendorState();
  Object.assign(editForm, marketPublicProfileFormFromMarket(market));
  void loadAttachedVendors(market);
}

async function startVendorImport(market: MarketListItem) {
  startEditing(market);
  await nextTick();
  const scrollIntoView = vendorImportSection.value?.scrollIntoView;
  if (typeof scrollIntoView === "function") {
    scrollIntoView.call(vendorImportSection.value, {
      behavior: "smooth",
      block: "start",
    });
  }
}

function cancelEditing() {
  editingMarket.value = null;
  formError.value = "";
  vendorImportError.value = "";
  vendorImportResult.value = null;
  vendorImportDryRunResult.value = null;
  vendorImportText.value = "";
  resetVendorCandidateState();
  resetAttachedVendorState();
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
  vendorImportText.value =
    vendorImportFormat.value === "csv"
      ? buildMarketVendorImportTemplate()
      : JSON.stringify(
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

function setVendorImportFormat(format: MarketVendorImportFormat) {
  vendorImportFormat.value = format;
  vendorImportError.value = "";
  vendorImportResult.value = null;
  vendorImportDryRunResult.value = null;
  vendorImportText.value = "";
}

function parsedVendorsForImport(): ImportMarketVendorInput[] {
  const parsed = vendorImportPreview.value;
  if (!parsed.vendors.length || parsed.errors.length) {
    throw new Error(parsed.errors[0] ?? "請確認匯入資料格式後再送出。");
  }

  return parsed.vendors;
}

async function dryRunVendorsForMarket() {
  if (!editingMarket.value) return;

  vendorImportError.value = "";
  vendorImportResult.value = null;

  let vendors: ImportMarketVendorInput[];
  try {
    vendors = parsedVendorsForImport();
  } catch (error) {
    vendorImportError.value =
      error instanceof Error ? error.message : "店鋪資料格式不正確。";
    return;
  }

  isDryRunningVendors.value = true;
  try {
    vendorImportDryRunResult.value = await marketsService.importVendors(
      editingMarket.value.id,
      vendors,
      { dryRun: true },
    );
  } catch (error) {
    console.error("Failed to dry-run market vendors:", error);
    vendorImportError.value = "預檢失敗，請確認店鋪欄位與權限。";
  } finally {
    isDryRunningVendors.value = false;
  }
}

async function importVendorsForMarket() {
  if (!editingMarket.value) return;

  vendorImportError.value = "";
  vendorImportResult.value = null;
  vendorImportDryRunResult.value = null;

  let vendors: ImportMarketVendorInput[];
  try {
    vendors = parsedVendorsForImport();
  } catch (error) {
    vendorImportError.value =
      error instanceof Error ? error.message : "店鋪資料格式不正確。";
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
    await loadAttachedVendors();
  } catch (error) {
    console.error("Failed to import market vendors:", error);
    vendorImportError.value = "匯入失敗，請確認店鋪欄位與權限。";
  } finally {
    isImportingVendors.value = false;
  }
}

function resetAttachedVendorState() {
  attachedVendors.value = [];
  attachedVendorError.value = "";
  isLoadingAttachedVendors.value = false;
  attachedVendorQuery.value = "";
  attachedVendorPage.value = 1;
  attachedVendorTotal.value = 0;
}

function editableMarketVendor(vendor: MarketVendor): EditableMarketVendor {
  return {
    ...vendor,
    draftStallNumber: vendor.stallNumber ?? "",
    draftIsPrimary: vendor.isPrimary,
  };
}

async function loadAttachedVendors(market = editingMarket.value) {
  if (!market) return;

  attachedVendorError.value = "";
  isLoadingAttachedVendors.value = true;

  try {
    const result = await marketsService.listMarketVendors(market.slug, {
      q: attachedVendorQuery.value.trim() || undefined,
      page: attachedVendorPage.value,
      limit: attachedVendorLimit,
    });
    if (editingMarket.value?.id !== market.id) return;
    attachedVendors.value = result.vendors.map(editableMarketVendor);
    attachedVendorTotal.value = result.total;
    attachedVendorPage.value = result.page;
  } catch (error) {
    console.error("Failed to load attached market vendors:", error);
    if (editingMarket.value?.id !== market.id) return;
    attachedVendorError.value = "讀取已加入店鋪失敗，請稍後再試。";
    attachedVendors.value = [];
    attachedVendorTotal.value = 0;
  } finally {
    if (editingMarket.value?.id === market.id) {
      isLoadingAttachedVendors.value = false;
    }
  }
}

function searchAttachedVendors() {
  attachedVendorPage.value = 1;
  void loadAttachedVendors();
}

function goToAttachedVendorPage(page: number) {
  attachedVendorPage.value = Math.min(
    Math.max(1, page),
    attachedVendorPageCount.value,
  );
  void loadAttachedVendors();
}

async function saveAttachedVendor(vendor: EditableMarketVendor) {
  if (!editingMarket.value) return;

  vendor.isSaving = true;
  attachedVendorError.value = "";

  try {
    await marketsService.updateVendor(
      editingMarket.value.id,
      vendor.restaurantId,
      {
        stallNumber: vendor.draftStallNumber.trim() || null,
        isPrimary: vendor.draftIsPrimary,
      },
    );
    await loadMarkets();
    await loadAttachedVendors();
  } catch (error) {
    console.error("Failed to update attached market vendor:", error);
    attachedVendorError.value = "儲存店鋪設定失敗，請確認權限後再試。";
  } finally {
    vendor.isSaving = false;
  }
}

async function removeAttachedVendor(vendor: EditableMarketVendor) {
  if (!editingMarket.value) return;

  vendor.isRemoving = true;
  attachedVendorError.value = "";

  try {
    await marketsService.removeVendor(
      editingMarket.value.id,
      vendor.restaurantId,
    );
    if (attachedVendors.value.length === 1 && attachedVendorPage.value > 1) {
      attachedVendorPage.value -= 1;
    }
    await loadAttachedVendors();
    await loadMarkets();
  } catch (error) {
    console.error("Failed to remove attached market vendor:", error);
    attachedVendorError.value = "移除店鋪失敗，請確認權限後再試。";
  } finally {
    vendor.isRemoving = false;
  }
}

function resetVendorCandidateState() {
  vendorCandidateQuery.value = "";
  vendorCandidates.value = [];
  vendorCandidateError.value = "";
  vendorAttachMessage.value = "";
  vendorCandidateSearched.value = false;
  Object.keys(vendorCandidateStalls).forEach((key) => {
    delete vendorCandidateStalls[key];
  });
  Object.keys(vendorCandidatePrimary).forEach((key) => {
    delete vendorCandidatePrimary[key];
  });
}

async function loadVendorCandidates() {
  if (!editingMarket.value) return;

  vendorCandidateError.value = "";
  vendorAttachMessage.value = "";
  isLoadingVendorCandidates.value = true;
  vendorCandidateSearched.value = true;

  try {
    const result = await marketsService.searchVendorCandidates({
      q: vendorCandidateQuery.value.trim() || undefined,
      marketId: editingMarket.value.id,
      limit: 10,
    });
    vendorCandidates.value = result.restaurants;
    Object.keys(vendorCandidateStalls).forEach((key) => {
      if (!result.restaurants.some((candidate) => candidate.id === key)) {
        delete vendorCandidateStalls[key];
        delete vendorCandidatePrimary[key];
      }
    });
  } catch (error) {
    console.error("Failed to load market vendor candidates:", error);
    vendorCandidateError.value = "搜尋失敗，請稍後再試。";
    vendorCandidates.value = [];
  } finally {
    isLoadingVendorCandidates.value = false;
  }
}

async function attachVendorCandidate(candidate: MarketVendorCandidate) {
  if (!editingMarket.value) return;

  vendorCandidateError.value = "";
  vendorAttachMessage.value = "";
  attachingVendorId.value = candidate.id;

  try {
    const stallNumber = vendorCandidateStalls[candidate.id]?.trim();
    await marketsService.addVendor(editingMarket.value.id, {
      restaurantId: candidate.id,
      stallNumber: stallNumber || null,
      isPrimary: Boolean(vendorCandidatePrimary[candidate.id]),
    });
    vendorAttachMessage.value = `已加入${candidate.name}`;
    vendorCandidates.value = vendorCandidates.value.filter(
      (item) => item.id !== candidate.id,
    );
    delete vendorCandidateStalls[candidate.id];
    delete vendorCandidatePrimary[candidate.id];
    await loadMarkets();
    await loadAttachedVendors();
  } catch (error) {
    console.error("Failed to attach market vendor candidate:", error);
    vendorCandidateError.value = "加入失敗，可能已在此市場或權限不足。";
  } finally {
    attachingVendorId.value = null;
  }
}

function downloadCatalogGapCsv() {
  downloadCsv(
    buildMarketCatalogGapCsv(filteredMarkets.value),
    marketCatalogGapCsvFilename(),
  );
}

function downloadVendorImportWorklistCsv() {
  downloadCsv(
    buildMarketVendorImportWorklistCsv(filteredMarkets.value),
    marketVendorImportWorklistCsvFilename(),
  );
}

function downloadAreaReadinessCsv() {
  downloadCsv(
    buildMarketAreaReadinessCsv(areaReadiness.value),
    marketAreaReadinessCsvFilename(),
  );
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

onMounted(() => {
  loadMarkets();
  loadJoinRequests();
});
</script>
