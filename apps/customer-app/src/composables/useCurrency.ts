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
   * Format a cents amount using the current restaurant's currency.
   * Note: Customer app stores prices in cents; this converts to dollars first.
   */
  const formatPrice = (cents: number): string => {
    if (typeof cents !== "number" || isNaN(cents)) {
      return sharedFormatCurrency(0, currencyCode.value);
    }
    const dollars = cents / 100;
    return sharedFormatCurrency(dollars, currencyCode.value);
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
