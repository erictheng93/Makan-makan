import { computed } from "vue";
import type { CurrencyCode } from "@makanmakan/shared-types";
import {
  formatCurrency as sharedFormatCurrency,
  getCurrencySymbol as sharedGetCurrencySymbol,
  DEFAULT_CURRENCY,
} from "@makanmakan/utils";
import { useAppStore } from "@/stores/app";

/**
 * Composable for currency formatting in customer app components.
 * Reads currency from the current restaurant's settings.
 *
 * Usage:
 * ```vue
 * const { formatPrice, currencySymbol } = useCurrency()
 * // In template: {{ formatPrice(1250) }}  → "RM 12.50"
 * ```
 */
export function useCurrency() {
  const appStore = useAppStore();

  const currencyCode = computed<CurrencyCode>(() => {
    const code = appStore.currentRestaurant?.settings?.currency;
    return (code as CurrencyCode) || DEFAULT_CURRENCY;
  });

  const currencySymbol = computed(() =>
    sharedGetCurrencySymbol(currencyCode.value),
  );

  /**
   * Format a price amount using the current restaurant's currency.
   * Prices in the database are stored as dollar values (e.g. 320 = NT$320).
   */
  const formatPrice = (amount: number): string => {
    if (typeof amount !== "number" || isNaN(amount)) {
      return sharedFormatCurrency(0, currencyCode.value);
    }
    return sharedFormatCurrency(amount, currencyCode.value);
  };

  /**
   * Format a dollar amount directly (no cents conversion).
   */
  const formatAmount = (amount: number): string => {
    return sharedFormatCurrency(amount, currencyCode.value);
  };

  return {
    formatPrice,
    formatAmount,
    currencySymbol,
    currencyCode,
  };
}
