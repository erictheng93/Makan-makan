<template>
  <div class="min-h-screen bg-gray-50 py-8">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <!-- Header with Language Switcher -->
      <div class="bg-white rounded-lg shadow-sm border p-6 mb-8">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900">
              {{ $t("dashboard.title") }}
            </h1>
            <p class="text-gray-600 mt-1">
              {{ $t("common.description") }}: MakanMakan i18n Demo
            </p>
          </div>
          <LanguageSwitcher @locale-changed="onLocaleChanged" />
        </div>
      </div>

      <!-- Navigation Demo -->
      <div class="bg-white rounded-lg shadow-sm border p-6 mb-8">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">
          {{ $t("nav.dashboard") }}
        </h2>
        <nav class="flex flex-wrap gap-4">
          <button
            v-for="navItem in navItems"
            :key="navItem"
            class="px-4 py-2 bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 transition-colors"
          >
            {{ $t(`nav.${navItem}`) }}
          </button>
        </nav>
      </div>

      <!-- Actions Demo -->
      <div class="bg-white rounded-lg shadow-sm border p-6 mb-8">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">
          {{ $t("common.actions") || "Common Actions" }}
        </h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            v-for="action in commonActions"
            :key="action"
            class="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            @click="showActionMessage(action)"
          >
            {{ $t(`common.${action}`) }}
          </button>
        </div>
      </div>

      <!-- Backup Management Demo -->
      <div class="bg-white rounded-lg shadow-sm border p-6 mb-8">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">
          {{ $t("backup.title") }}
        </h2>
        <div class="space-y-4">
          <div
            class="flex items-center justify-between p-4 bg-gray-50 rounded-md"
          >
            <div>
              <h3 class="font-medium">{{ $t("backup.autoBackup") }}</h3>
              <p class="text-sm text-gray-600">
                {{ $t("backup.backupStatus") }}: {{ $t("common.active") }}
              </p>
            </div>
            <button
              class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              {{ $t("backup.createBackup") }}
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              class="p-4 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              {{ $t("backup.backupHistory") }}
            </button>
            <button
              class="p-4 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              {{ $t("backup.restoreBackup") }}
            </button>
            <button
              class="p-4 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              {{ $t("backup.downloadBackup") }}
            </button>
          </div>
        </div>
      </div>

      <!-- Orders Demo -->
      <div class="bg-white rounded-lg shadow-sm border p-6 mb-8">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">
          {{ $t("orders.title") }}
        </h2>

        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {{ $t("orders.orderNumber") }}
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {{ $t("orders.customer") }}
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {{ $t("orders.table") }}
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {{ $t("common.status") }}
                </th>
                <th
                  class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {{ $t("orders.total") }}
                </th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="order in demoOrders" :key="order.id">
                <td
                  class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
                >
                  #{{ order.id }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ order.customer }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ order.table }}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span
                    class="inline-flex px-2 py-1 text-xs font-semibold rounded-full"
                    :class="getStatusClass(order.status)"
                  >
                    {{ $t(`orders.status.${order.status}`) }}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {{ formatCurrency(order.total) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Validation Demo -->
      <div class="bg-white rounded-lg shadow-sm border p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">
          {{ $t("validation.title") || "Form Validation" }}
        </h2>

        <form class="space-y-4" @submit.prevent="submitForm">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              {{ $t("common.name") }}
            </label>
            <input
              v-model="form.name"
              type="text"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              :placeholder="$t('common.name')"
            />
            <p v-if="!form.name" class="text-sm text-red-600 mt-1">
              {{ $t("validation.required") }}
            </p>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              {{ $t("validation.email") }}
            </label>
            <input
              v-model="form.email"
              type="email"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              :placeholder="$t('validation.email')"
            />
          </div>

          <div class="flex space-x-4">
            <button
              type="submit"
              class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              {{ $t("common.save") }}
            </button>
            <button
              type="button"
              class="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              @click="resetForm"
            >
              {{ $t("common.cancel") }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import LanguageSwitcher from "../components/LanguageSwitcher.vue";
// TODO: Fix i18n types
// import type { SupportedLocale } from '@makanmakan/i18n'

// Composables
const { t, locale } = useI18n();

// Data
const navItems = [
  "dashboard",
  "restaurants",
  "users",
  "analytics",
  "settings",
  "backup",
];
const commonActions = ["create", "edit", "delete", "view", "search"];

const form = ref({
  name: "",
  email: "",
});

const demoOrders = ref([
  {
    id: "001",
    customer: "John Doe",
    table: "A1",
    status: "pending",
    total: 45.5,
  },
  {
    id: "002",
    customer: "Jane Smith",
    table: "B2",
    status: "preparing",
    total: 32.25,
  },
  {
    id: "003",
    customer: "Bob Wilson",
    table: "C3",
    status: "ready",
    total: 67.8,
  },
  {
    id: "004",
    customer: "Alice Brown",
    table: "A2",
    status: "served",
    total: 28.9,
  },
]);

// Methods
const onLocaleChanged = (newLocale: string) => {
  console.log("Locale changed to:", newLocale);
  // Optional: Add any additional logic when locale changes
};

const showActionMessage = (action: string) => {
  alert(`${t("common." + action)} ${t("common.success")}!`);
};

const getStatusClass = (status: string) => {
  const classes = {
    pending: "bg-yellow-100 text-yellow-800",
    preparing: "bg-blue-100 text-blue-800",
    ready: "bg-green-100 text-green-800",
    served: "bg-gray-100 text-gray-800",
    cancelled: "bg-red-100 text-red-800",
  };
  return classes[status as keyof typeof classes] || "bg-gray-100 text-gray-800";
};

const formatCurrency = (amount: number) => {
  // This would use the current locale's currency formatting
  return new Intl.NumberFormat(locale.value, {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

const submitForm = () => {
  if (form.value.name && form.value.email) {
    alert(`${t("messages.saveSuccess")}!`);
  } else {
    alert(`${t("validation.required")}`);
  }
};

const resetForm = () => {
  form.value = { name: "", email: "" };
};
</script>
