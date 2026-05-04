/**
 * Currency formatting utilities for MakanMasak platform
 *
 * Provides a shared currency configuration and formatting functions
 * that all apps (admin dashboard, customer app, etc.) can use.
 * Data sourced from REGION_CONFIGS in queue-core but focused on currency only.
 */

/** Supported currency codes — matches CurrencyCode in shared-types */
export type CurrencyCode = "TWD" | "MYR" | "VND";

export interface CurrencyFormatConfig {
  symbol: string;
  position: "before" | "after";
  space: boolean;
  decimals: number;
  locale: string;
}

/**
 * Currency configuration mapping.
 * Each supported CurrencyCode maps to its display formatting rules.
 */
export const CURRENCY_CONFIGS: Record<CurrencyCode, CurrencyFormatConfig> = {
  TWD: {
    symbol: "NT$",
    position: "before",
    space: false,
    decimals: 0,
    locale: "zh-TW",
  },
  MYR: {
    symbol: "RM",
    position: "before",
    space: true,
    decimals: 2,
    locale: "ms-MY",
  },
  VND: {
    symbol: "\u20AB",
    position: "after",
    space: true,
    decimals: 0,
    locale: "vi-VN",
  },
};

/** Default currency when restaurant has no setting */
export const DEFAULT_CURRENCY: CurrencyCode = "TWD";

/**
 * Format an amount with full currency display using Intl.NumberFormat.
 *
 * @param amount - The numeric amount to format
 * @param currency - Currency code (defaults to MYR)
 * @returns Formatted string like "RM 12.50", "NT$350", "100,000 \u20AB"
 */
export const formatCurrency = (
  amount: number,
  currency: CurrencyCode = DEFAULT_CURRENCY,
): string => {
  const config = CURRENCY_CONFIGS[currency];
  if (!config) return amount.toString();

  const formatter = new Intl.NumberFormat(config.locale, {
    minimumFractionDigits: config.decimals,
    maximumFractionDigits: config.decimals,
  });

  const formatted = formatter.format(amount);
  const space = config.space ? " " : "";

  if (config.position === "before") {
    return `${config.symbol}${space}${formatted}`;
  }
  return `${formatted}${space}${config.symbol}`;
};

/**
 * Quick lookup for a currency's display symbol.
 */
export const getCurrencySymbol = (
  currency: CurrencyCode = DEFAULT_CURRENCY,
): string => {
  return CURRENCY_CONFIGS[currency]?.symbol ?? currency;
};

/**
 * Get the full format config for a currency code.
 */
export const getCurrencyConfig = (
  currency: CurrencyCode = DEFAULT_CURRENCY,
): CurrencyFormatConfig | undefined => {
  return CURRENCY_CONFIGS[currency];
};
