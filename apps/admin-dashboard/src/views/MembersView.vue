<template>
  <main class="min-h-full space-y-6 bg-[#F2F2F7] p-5">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-3xl font-bold text-[#1C1C1E]">
          {{ t("pages.members") }}
        </h1>
        <p class="mt-1 text-sm text-[#8E8E93]">查看在本店有消費紀錄的顧客</p>
      </div>
    </header>

    <section class="grid grid-cols-1 gap-4 md:grid-cols-4">
      <article
        v-for="card in statCards"
        :key="card.label"
        class="rounded-2xl bg-white p-5 shadow-ios-card"
      >
        <p class="text-xs text-[#8E8E93]">{{ card.label }}</p>
        <p class="mt-2 text-2xl font-semibold tabular-nums text-[#1C1C1E]">
          {{ card.value }}
        </p>
      </article>
    </section>

    <section class="rounded-2xl bg-white p-5 shadow-ios-card">
      <label class="sr-only" for="member-search">搜尋會員</label>
      <input
        id="member-search"
        v-model="search"
        type="search"
        placeholder="搜尋姓名；手機與 Email 需輸入完整值"
        class="w-full rounded-xl border-0 bg-[#F2F2F7] px-3 py-2.5 text-sm text-[#1C1C1E] focus:ring-2 focus:ring-[#007AFF]/30"
        @input="debouncedLoad"
      />
    </section>

    <section class="overflow-hidden rounded-2xl bg-white shadow-ios-card">
      <div
        v-if="loading"
        class="p-12 text-center text-sm text-[#8E8E93]"
        aria-busy="true"
      >
        {{ t("common.loading") }}
      </div>
      <div
        v-else-if="members.length === 0"
        class="p-12 text-center text-sm text-[#8E8E93]"
      >
        尚無會員資料
      </div>
      <div v-else class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-100">
          <thead>
            <tr
              class="text-left text-xs font-medium uppercase tracking-wider text-[#8E8E93]"
            >
              <th class="px-6 py-3">會員</th>
              <th class="px-6 py-3">聯絡方式</th>
              <th class="px-6 py-3">本店訂單</th>
              <th class="px-6 py-3">本店消費</th>
              <th class="px-6 py-3">最後消費</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="member in members"
              :key="member.memberId"
              :data-testid="`member-row-${member.memberId}`"
              :data-status="member.status"
              class="transition-colors duration-200 hover:bg-[#F2F2F7]"
            >
              <td class="px-6 py-4 text-sm font-medium text-[#1C1C1E]">
                {{ member.displayName }}
              </td>
              <td class="px-6 py-4 text-sm text-[#8E8E93]">
                <div>{{ member.maskedPhone ?? "—" }}</div>
                <div>{{ member.maskedEmail ?? "—" }}</div>
              </td>
              <td class="px-6 py-4 text-sm text-[#1C1C1E]">
                {{ member.orderCount }}
                <span class="text-xs text-[#8E8E93]"
                  >取消 {{ member.cancelledOrderCount }}</span
                >
              </td>
              <td class="px-6 py-4 text-sm tabular-nums text-[#1C1C1E]">
                {{ formatPrice(member.totalSpentCents / 100) }}
              </td>
              <td class="px-6 py-4 text-sm text-[#8E8E93]">
                {{ formatDate(member.lastOrderAt) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <footer
        v-if="pagination.pages > 1"
        class="flex items-center justify-between p-4 text-sm text-[#8E8E93]"
      >
        <span>共 {{ pagination.total }} 筆</span>
        <div class="flex gap-2">
          <button
            class="rounded-full bg-gray-100 px-4 py-2 disabled:opacity-40"
            :disabled="page === 1"
            @click="changePage(page - 1)"
          >
            {{ t("common.previous") }}</button
          ><button
            class="rounded-full bg-gray-100 px-4 py-2 disabled:opacity-40"
            :disabled="page === pagination.pages"
            @click="changePage(page + 1)"
          >
            {{ t("common.next") }}
          </button>
        </div>
      </footer>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "@/i18n";
import { useAuthStore } from "@/stores/auth";
import { useCurrency } from "@/composables/useCurrency";
import {
  membersService,
  type MemberListItem,
  type MemberStats,
} from "@/services/membersService";

const { t } = useI18n();
const authStore = useAuthStore();
const { formatPrice } = useCurrency();
const members = ref<MemberListItem[]>([]);
const stats = ref<MemberStats>({
  totalMembers: 0,
  newThisMonth: 0,
  repeatRate: 0,
  avgOrderValueCents: 0,
});
const pagination = ref({ total: 0, page: 1, limit: 20, pages: 1 });
const page = ref(1);
const search = ref("");
const loading = ref(false);
let searchTimer: ReturnType<typeof setTimeout> | undefined;

const statCards = computed(() => [
  { label: "總會員數", value: stats.value.totalMembers },
  { label: "本月新增", value: stats.value.newThisMonth },
  {
    label: "回頭客比例",
    value: `${Math.round(stats.value.repeatRate * 100)}%`,
  },
  {
    label: "平均客單價",
    value: formatPrice(stats.value.avgOrderValueCents / 100),
  },
]);

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat().format(new Date(value)) : "—";
}
async function load() {
  const restaurantId = authStore.restaurantId;
  if (!restaurantId) return;
  loading.value = true;
  try {
    const [list, memberStats] = await Promise.all([
      membersService.list(String(restaurantId), {
        page: page.value,
        limit: 20,
        search: search.value || undefined,
      }),
      membersService.stats(String(restaurantId)),
    ]);
    members.value = list.data;
    pagination.value = list.pagination;
    stats.value = memberStats;
  } finally {
    loading.value = false;
  }
}
function debouncedLoad() {
  page.value = 1;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(load, 300);
}
function changePage(nextPage: number) {
  page.value = nextPage;
  void load();
}
onMounted(() => void load());
</script>
